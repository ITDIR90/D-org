from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import EntityType, NotificationType
from app.models.notification import Notification
from app.models.user import User
from app.services.notification_delivery import deliver_notification


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
        await deliver_notification(db, target, title, message)
    return notification
