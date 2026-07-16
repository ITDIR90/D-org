from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.chat import DirectChatMessage, GroupChatMessage
from app.models.comment import Comment
from app.models.task import Task


class DuplicateMessageError(Exception):
    """Пользователь повторно отправил то же сообщение слишком быстро."""


class DuplicateTaskError(Exception):
    """Пользователь повторно создал ту же задачу слишком быстро."""


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


async def assert_task_not_duplicate(
    db: AsyncSession,
    user_id: int,
    title: str,
    target_group_id: int,
    *,
    category_id: int | None = None,
    window_seconds: int | None = None,
) -> None:
    normalized = normalize_message_text(title)
    if not normalized:
        return

    settings = get_settings()
    window = window_seconds if window_seconds is not None else settings.DUPLICATE_TASK_WINDOW_SECONDS
    since = datetime.now(timezone.utc) - timedelta(seconds=window)

    result = await db.execute(
        select(Task.title, Task.category_id)
        .where(
            Task.author_id == user_id,
            Task.target_group_id == target_group_id,
            Task.created_at >= since,
        )
        .order_by(Task.created_at.desc())
        .limit(30)
    )
    for existing_title, existing_category_id in result.all():
        if normalize_message_text(existing_title) != normalized:
            continue
        if category_id is not None and existing_category_id != category_id:
            continue
        raise DuplicateTaskError(
            f"Такая же задача уже создана недавно. Подождите {window} сек. "
            "Если это другая заявка — измените название."
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
