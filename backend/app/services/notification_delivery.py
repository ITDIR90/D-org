import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.user import User
from app.services.email_service import send_email
from app.services.max_service import max_configured, send_max_message
from app.services.push_service import push_configured, send_push_to_user, _push_reason
from app.services.telegram_service import send_telegram_message, telegram_configured

logger = logging.getLogger(__name__)


def get_channels_status() -> dict:
    settings = get_settings()
    email_ready = bool(settings.EMAIL_ENABLED and settings.SMTP_HOST and settings.SMTP_FROM)
    telegram_ready = telegram_configured()
    max_ready = max_configured()
    push_ready = push_configured()
    return {
        "email": {
            "enabled": settings.EMAIL_ENABLED,
            "ready": email_ready,
            "reason": None if email_ready else _email_reason(settings),
        },
        "telegram": {
            "enabled": settings.TELEGRAM_ENABLED,
            "ready": telegram_ready,
            "reason": None if telegram_ready else _telegram_reason(settings),
        },
        "max": {
            "enabled": settings.MAX_ENABLED,
            "ready": max_ready,
            "reason": None if max_ready else _max_reason(settings),
        },
        "push": {
            "enabled": settings.PUSH_ENABLED,
            "ready": push_ready,
            "reason": None if push_ready else _push_reason(),
        },
    }


def _email_reason(settings) -> str:
    if not settings.EMAIL_ENABLED:
        return "EMAIL_ENABLED=false в .env"
    if not settings.SMTP_HOST:
        return "Не задан SMTP_HOST"
    if not settings.SMTP_FROM:
        return "Не задан SMTP_FROM"
    return "Почта не настроена"


def _telegram_reason(settings) -> str:
    if not settings.TELEGRAM_ENABLED:
        return "TELEGRAM_ENABLED=false в .env"
    if not settings.TELEGRAM_BOT_TOKEN.strip():
        return "Не задан TELEGRAM_BOT_TOKEN"
    return "Telegram не настроен"


def _max_reason(settings) -> str:
    if not settings.MAX_ENABLED:
        return "MAX_ENABLED=false в .env"
    if not settings.MAX_GATEWAY_URL.strip():
        return "Не задан MAX_GATEWAY_URL"
    if not settings.MAX_GATEWAY_TOKEN.strip():
        return "Не задан MAX_GATEWAY_TOKEN"
    return "MAX не настроен"


async def deliver_notification(
    db: AsyncSession,
    recipient: User,
    subject: str,
    body: str,
    push_data: dict | None = None,
) -> dict:
    fresh = await db.get(User, recipient.id)
    user = fresh or recipient
    result = {"email": False, "telegram": False, "max": False, "push": False, "skipped": []}

    if user.notify_via_email and user.email:
        sent = await send_email(
            db,
            user_id=user.id,
            to_email=user.email,
            subject=subject,
            body=body,
        )
        result["email"] = sent
        if not sent:
            channels = get_channels_status()
            reason = channels["email"]["reason"] or "ошибка отправки"
            result["skipped"].append(f"email: {reason}")
            logger.warning("Email not sent to user %s: %s", user.id, reason)
    elif user.notify_via_email:
        result["skipped"].append("email: не указан адрес")
    else:
        result["skipped"].append("email: отключено в профиле")

    if user.notify_via_telegram and user.telegram_chat_id:
        sent = await send_telegram_message(
            db,
            user_id=user.id,
            chat_id=user.telegram_chat_id.strip(),
            text=f"{subject}\n\n{body}",
        )
        result["telegram"] = sent
        if not sent:
            channels = get_channels_status()
            reason = channels["telegram"]["reason"] or "ошибка отправки"
            result["skipped"].append(f"telegram: {reason}")
            logger.warning("Telegram not sent to user %s: %s", user.id, reason)
    elif user.notify_via_telegram:
        result["skipped"].append("telegram: не указан chat_id")
    else:
        result["skipped"].append("telegram: отключено в профиле")

    if user.notify_via_max and user.max_user_id:
        sent = await send_max_message(
            db,
            user_id=user.id,
            max_user_id=user.max_user_id,
            text=f"{subject}\n\n{body}",
        )
        result["max"] = sent
        if not sent:
            channels = get_channels_status()
            reason = channels["max"]["reason"] or "ошибка отправки"
            result["skipped"].append(f"max: {reason}")
            logger.warning("MAX not sent to user %s: %s", user.id, reason)
    elif user.notify_via_max:
        result["skipped"].append("max: не указан user_id")
    else:
        result["skipped"].append("max: отключено в профиле")

    if user.notify_via_push:
        sent = await send_push_to_user(db, user.id, subject, body, push_data)
        result["push"] = sent
        if not sent:
            result["skipped"].append("push: нет зарегистрированных устройств или ошибка отправки")
    else:
        result["skipped"].append("push: отключено в профиле")

    return result


async def send_test_notification(db: AsyncSession, user: User) -> dict:
    subject = "Тестовое уведомление D-органайзер"
    body = "Если вы видите это сообщение — канал уведомлений работает."
    delivery = await deliver_notification(
        db,
        user,
        subject,
        body,
        push_data={"type": "test"},
    )
    return {
        "channels": get_channels_status(),
        "user": {
            "email": user.email,
            "notify_via_email": user.notify_via_email,
            "notify_via_telegram": user.notify_via_telegram,
            "notify_via_max": user.notify_via_max,
            "notify_via_push": user.notify_via_push,
            "telegram_chat_id": bool(user.telegram_chat_id),
            "max_user_id": bool(user.max_user_id),
        },
        "delivery": delivery,
    }
