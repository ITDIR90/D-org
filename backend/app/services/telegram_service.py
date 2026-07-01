import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import UserActionType
from app.services.audit_service import log_user_action

logger = logging.getLogger(__name__)


def telegram_configured() -> bool:
    settings = get_settings()
    return bool(settings.TELEGRAM_ENABLED and settings.TELEGRAM_BOT_TOKEN.strip())


async def send_telegram_message(
    db: AsyncSession,
    user_id: int | None,
    chat_id: str,
    text: str,
    ip_address: str | None = None,
) -> bool:
    settings = get_settings()
    if not telegram_configured():
        return False

    token = settings.TELEGRAM_BOT_TOKEN.strip()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            body = response.json()
            if not body.get("ok"):
                raise RuntimeError(body.get("description", "Telegram API error"))
        await log_user_action(
            db,
            user_id=user_id,
            action=UserActionType.TELEGRAM_SENT,
            details=f"Telegram to {chat_id}: {text[:120]}",
            ip_address=ip_address,
        )
        return True
    except Exception as exc:
        logger.exception("Telegram send failed")
        await log_user_action(
            db,
            user_id=user_id,
            action=UserActionType.TELEGRAM_ERROR,
            details=str(exc)[:500],
            ip_address=ip_address,
        )
        return False
