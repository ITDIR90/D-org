import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import UserActionType
from app.services.audit_service import log_user_action

logger = logging.getLogger(__name__)


def max_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.MAX_ENABLED
        and settings.MAX_GATEWAY_URL.strip()
        and settings.MAX_GATEWAY_TOKEN.strip()
    )


async def send_max_message(
    db: AsyncSession,
    user_id: int | None,
    max_user_id: int,
    text: str,
    ip_address: str | None = None,
) -> bool:
    settings = get_settings()
    if not max_configured():
        return False

    url = settings.MAX_GATEWAY_URL.strip()
    token = settings.MAX_GATEWAY_TOKEN.strip()
    payload = {
        "user_id": max_user_id,
        "text": text[:4000],
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        await log_user_action(
            db,
            user_id=user_id,
            action=UserActionType.MAX_SENT,
            details=f"MAX to {max_user_id}: {text[:120]}",
            ip_address=ip_address,
        )
        return True
    except Exception as exc:
        logger.exception("MAX send failed")
        await log_user_action(
            db,
            user_id=user_id,
            action=UserActionType.MAX_ERROR,
            details=str(exc)[:500],
            ip_address=ip_address,
        )
        return False
