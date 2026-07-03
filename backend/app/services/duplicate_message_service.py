from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.chat import DirectChatMessage, GroupChatMessage
from app.models.comment import Comment


class DuplicateMessageError(Exception):
    """Пользователь повторно отправил то же сообщение слишком быстро."""


def normalize_message_text(text: str) -> str:
    return " ".join(text.split()).casefold()


async def assert_message_not_duplicate(
    db: AsyncSession,
    user_id: int,
    text: str,
    *,
    window_seconds: int | None = None,
) -> None:
    normalized = normalize_message_text(text)
    if not normalized:
        return

    settings = get_settings()
    window = window_seconds if window_seconds is not None else settings.DUPLICATE_MESSAGE_WINDOW_SECONDS
    since = datetime.now(timezone.utc) - timedelta(seconds=window)

    recent_texts = await _recent_user_message_texts(db, user_id, since)
    if any(normalize_message_text(existing) == normalized for existing in recent_texts):
        raise DuplicateMessageError(
            f"Такое же сообщение уже отправлялось недавно. Подождите {window} сек."
        )


async def _recent_user_message_texts(
    db: AsyncSession,
    user_id: int,
    since: datetime,
) -> list[str]:
    texts: list[str] = []
    sources = (
        (Comment, Comment.author_id),
        (GroupChatMessage, GroupChatMessage.author_id),
        (DirectChatMessage, DirectChatMessage.sender_id),
    )
    for model, user_field in sources:
        result = await db.execute(
            select(model.text)
            .where(user_field == user_id, model.created_at >= since)
            .order_by(model.created_at.desc())
            .limit(50)
        )
        texts.extend(result.scalars().all())
    return texts
