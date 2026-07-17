import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import EntityType, NotificationType
from app.models.notification import Notification
from app.models.task import Task
from app.models.user import User, UserGroupMembership
from app.services.notification_delivery import deliver_notification

logger = logging.getLogger(__name__)

# Telegram/MAX: запас относительно лимита ~4096 символов на сообщение целиком
_MAX_DESCRIPTION_CHARS = 2500


def format_task_description_block(description: str | None) -> str:
    text = (description or "").strip()
    if not text:
        return ""
    if len(text) > _MAX_DESCRIPTION_CHARS:
        text = text[: _MAX_DESCRIPTION_CHARS - 1].rstrip() + "…"
    return f"\n\nОписание:\n{text}"


def format_new_task_message(task: Task) -> str:
    base = f"Появилась новая задача №{task.number}: «{task.title}»"
    return base + format_task_description_block(task.description)


async def create_notification(
    db: AsyncSession,
    user_id: int,
    ntype: NotificationType,
    title: str,
    message: str,
    entity_type: EntityType | None = None,
    entity_id: int | None = None,
    recipient: User | None = None,
    send_email_to: User | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(notification)
    await db.flush()

    target = recipient or send_email_to
    if target:
        push_data = {
            "notificationId": str(notification.id),
            "type": ntype.value,
            "entityType": entity_type.value if entity_type else "",
            "entityId": str(entity_id) if entity_id is not None else "",
        }
        try:
            await deliver_notification(db, target, title, message, push_data=push_data)
        except Exception:
            logger.exception("Failed to deliver notification %s to user %s", notification.id, target.id)
    return notification


async def notify_group_members_new_task(
    db: AsyncSession,
    task: Task,
    *,
    exclude_user_ids: set[int] | None = None,
) -> None:
    """Notify all active group members about a new task (except excluded users, usually the author)."""
    exclude = exclude_user_ids or set()
    result = await db.execute(
        select(User)
        .join(UserGroupMembership, UserGroupMembership.user_id == User.id)
        .where(
            UserGroupMembership.group_id == task.target_group_id,
            User.is_active == True,
        )
        .distinct()
    )
    members = result.scalars().all()
    if not members:
        return

    await db.refresh(task)
    title = "Новая задача в группе"
    message = format_new_task_message(task)

    for member in members:
        if member.id in exclude:
            continue
        try:
            await create_notification(
                db,
                member.id,
                NotificationType.TASK_CREATED,
                title,
                message,
                EntityType.TASK,
                task.id,
                member,
            )
        except Exception:
            logger.exception(
                "Failed to notify user %s about new task %s in group %s",
                member.id,
                task.id,
                task.target_group_id,
            )
