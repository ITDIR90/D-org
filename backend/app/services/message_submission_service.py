from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_service import AIResult, ModerationError, process_text
from app.services.duplicate_message_service import assert_message_not_duplicate


async def process_user_message(
    db: AsyncSession,
    user_id: int,
    text: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AIResult:
    """Проверка на дубликат + модерация/коррекция текста сообщения."""
    await assert_message_not_duplicate(db, user_id, text)
    return await process_text(db, user_id, text, ip_address, user_agent)


__all__ = ["process_user_message", "ModerationError"]
