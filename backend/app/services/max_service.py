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


def max_config_reason() -> str | None:
    settings = get_settings()
    if not settings.MAX_ENABLED:
        return "MAX_ENABLED=false в .env"
    if not settings.MAX_GATEWAY_URL.strip():
        return "Не задан MAX_GATEWAY_URL"
    if not settings.MAX_GATEWAY_TOKEN.strip():
        return "Не задан MAX_GATEWAY_TOKEN"
    return None


def _format_max_http_error(status_code: int, detail: str) -> str:
    if status_code == 403:
        return (
            "403 Forbidden: IP сервера D-org не в whitelist nginx Gateway. "
            "На сервере max.mebel-alivia.ru добавьте внешний IP D-org в "
            "/etc/nginx/sites-available/max-gateway (location /api/) и выполните "
            "nginx -t && systemctl reload nginx. "
            "Если оба сервиса на одном VPS — укажите "
            "MAX_GATEWAY_URL=http://host.docker.internal:8000/api/v1/send в .env D-org."
        )
    if status_code == 401:
        return "401 Unauthorized: неверный MAX_GATEWAY_TOKEN (INTERNAL_API_TOKEN gateway)"
    return f"HTTP {status_code}: {detail}"


async def send_max_message(
    db: AsyncSession,
    user_id: int | None,
    max_user_id: int,
    text: str,
    ip_address: str | None = None,
) -> tuple[bool, str | None]:
    settings = get_settings()
    if not max_configured():
        return False, max_config_reason() or "MAX не настроен"

    url = settings.MAX_GATEWAY_URL.strip()
    token = settings.MAX_GATEWAY_TOKEN.strip()
    payload = {
        "user_id": int(max_user_id),
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
        try:
            await log_user_action(
                db,
                user_id=user_id,
                action=UserActionType.MAX_SENT,
                details=f"MAX to {max_user_id}: {text[:120]}",
                ip_address=ip_address,
            )
        except Exception:
            logger.exception("MAX sent but audit log failed")
        return True, None
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500]
        try:
            body = exc.response.json()
            if isinstance(body.get("detail"), str):
                detail = body["detail"]
            elif body.get("detail") is not None:
                detail = str(body["detail"])[:500]
        except Exception:
            pass
        detail = _format_max_http_error(exc.response.status_code, detail)
        logger.warning("MAX send failed: %s", detail)
        try:
            await log_user_action(
                db,
                user_id=user_id,
                action=UserActionType.MAX_ERROR,
                details=detail[:500],
                ip_address=ip_address,
            )
        except Exception:
            logger.exception("MAX error audit log failed")
        return False, detail
    except Exception as exc:
        logger.exception("MAX send failed")
        try:
            await log_user_action(
                db,
                user_id=user_id,
                action=UserActionType.MAX_ERROR,
                details=str(exc)[:500],
                ip_address=ip_address,
            )
        except Exception:
            logger.exception("MAX error audit log failed")
        return False, str(exc)[:500]
