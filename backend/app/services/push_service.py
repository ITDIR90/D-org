import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.device_token import UserDeviceToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def push_configured() -> bool:
    return get_settings().PUSH_ENABLED


def _push_reason() -> str:
    settings = get_settings()
    if not settings.PUSH_ENABLED:
        return "PUSH_ENABLED=false в .env"
    return "Push не настроен"


async def list_user_tokens(db: AsyncSession, user_id: int) -> list[str]:
    result = await db.execute(
        select(UserDeviceToken.token).where(UserDeviceToken.user_id == user_id)
    )
    return list(result.scalars().all())


async def register_device_token(
    db: AsyncSession,
    user_id: int,
    token: str,
    platform: str,
) -> UserDeviceToken:
    token = token.strip()
    result = await db.execute(
        select(UserDeviceToken).where(
            UserDeviceToken.user_id == user_id,
            UserDeviceToken.token == token,
        )
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row:
        row.platform = platform
        row.last_used_at = now
        return row
    row = UserDeviceToken(user_id=user_id, token=token, platform=platform, last_used_at=now)
    db.add(row)
    await db.flush()
    return row


async def unregister_device_token(db: AsyncSession, user_id: int, token: str) -> None:
    await db.execute(
        delete(UserDeviceToken).where(
            UserDeviceToken.user_id == user_id,
            UserDeviceToken.token == token.strip(),
        )
    )


async def _remove_invalid_tokens(db: AsyncSession, tokens: list[str]) -> None:
    if not tokens:
        return
    await db.execute(delete(UserDeviceToken).where(UserDeviceToken.token.in_(tokens)))


async def send_push_to_user(
    db: AsyncSession,
    user_id: int,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    if not push_configured():
        return False

    tokens = await list_user_tokens(db, user_id)
    if not tokens:
        return False

    payload = {k: str(v) for k, v in (data or {}).items() if v is not None and v != ""}
    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": payload,
            "sound": "default",
            "priority": "high",
            "channelId": "default",
            "android": {
                "channelId": "default",
                "priority": "high",
            },
        }
        for token in tokens
    ]

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }
    access_token = get_settings().EXPO_ACCESS_TOKEN.strip()
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    invalid: list[str] = []
    sent_any = False

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for i in range(0, len(messages), 100):
                chunk = messages[i : i + 100]
                response = await client.post(EXPO_PUSH_URL, json=chunk, headers=headers)
                if response.status_code != 200:
                    logger.warning("Expo push HTTP %s: %s", response.status_code, response.text[:300])
                    continue
                tickets = response.json().get("data", [])
                for msg, ticket in zip(chunk, tickets):
                    if ticket.get("status") == "ok":
                        sent_any = True
                        continue
                    details = ticket.get("details") or {}
                    if details.get("error") == "DeviceNotRegistered":
                        invalid.append(msg["to"])
                    else:
                        logger.warning(
                            "Expo push error for user %s: %s",
                            user_id,
                            ticket.get("message") or ticket,
                        )
    except Exception as exc:
        logger.exception("Expo push failed for user %s: %s", user_id, exc)
        return False

    if invalid:
        await _remove_invalid_tokens(db, invalid)

    return sent_any
