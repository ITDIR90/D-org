from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import EntityType, NotificationType, TaskStatus
from app.db.session import async_session
from app.models.task import Task
from app.models.user import User
from app.services.notification_service import create_notification

ACTIVE_STATUSES = (
    TaskStatus.NEW,
    TaskStatus.IN_PROGRESS,
    TaskStatus.WAITING_AUTHOR_CONFIRMATION,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _format_due_at(value: datetime) -> str:
    return _ensure_utc(value).astimezone(ZoneInfo("Europe/Moscow")).strftime("%d.%m.%Y %H:%M")


async def process_due_reminders() -> None:
    async with async_session() as db:
        now = _utc_now()
        result = await db.execute(
            select(Task)
            .options(selectinload(Task.assignee))
            .where(
                Task.status.in_(ACTIVE_STATUSES),
                Task.assignee_id.is_not(None),
                Task.notify_before_minutes > 0,
                Task.due_reminder_sent_at.is_(None),
                Task.due_at > now,
            )
        )
        tasks = result.scalars().all()
        changed = False
        for task in tasks:
            reminder_at = _ensure_utc(task.due_at) - timedelta(minutes=task.notify_before_minutes)
            if reminder_at > now:
                continue
            assignee = task.assignee
            if not assignee or not assignee.is_active:
                task.due_reminder_sent_at = now
                changed = True
                continue
            due_label = _format_due_at(task.due_at)
            await create_notification(
                db,
                assignee.id,
                NotificationType.DUE_REMINDER,
                "Приближается срок задачи",
                (
                    f"Задача «{task.title}» должна быть выполнена до {due_label} "
                    f"(напоминание за {task.notify_before_minutes} мин.)"
                ),
                EntityType.TASK,
                task.id,
                recipient=assignee,
            )
            task.due_reminder_sent_at = now
            changed = True
        if changed:
            await db.commit()


async def _overdue_tasks_for_user(db: AsyncSession, user_id: int) -> list[Task]:
    now = _utc_now()
    result = await db.execute(
        select(Task)
        .where(
            Task.assignee_id == user_id,
            Task.status.in_(ACTIVE_STATUSES),
            Task.due_at < now,
        )
        .order_by(Task.due_at.asc())
    )
    return list(result.scalars().all())


async def process_overdue_digests() -> None:
    async with async_session() as db:
        result = await db.execute(select(User).where(User.is_active == True))
        users = result.scalars().all()
        changed = False

        for user in users:
            if not user.notify_via_email and not user.notify_via_telegram and not user.notify_via_push:
                continue
            try:
                tz = ZoneInfo(user.timezone or "Europe/Moscow")
            except Exception:
                tz = ZoneInfo("Europe/Moscow")
            local_now = datetime.now(tz)
            if local_now.hour != 16 or local_now.minute != 0:
                continue
            today = local_now.date()
            if user.overdue_digest_sent_on == today:
                continue

            overdue = await _overdue_tasks_for_user(db, user.id)
            if overdue:
                lines = [f"{index}. {task.title} — срок {_format_due_at(task.due_at)}" for index, task in enumerate(overdue, 1)]
                count = len(overdue)
                title = "Просроченные задачи"
                message = f"У вас {count} просроченн{'ая задача' if count == 1 else 'ые задачи'}:\n" + "\n".join(lines)
                await create_notification(
                    db,
                    user.id,
                    NotificationType.OVERDUE_DIGEST,
                    title,
                    message,
                    EntityType.TASK,
                    overdue[0].id,
                    recipient=user,
                )
            user.overdue_digest_sent_on = today
            changed = True

        if changed:
            await db.commit()
