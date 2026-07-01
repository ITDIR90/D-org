import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.user import User
from app.services.email_service import send_email
from app.services.telegram_service import send_telegram_message, telegram_configured

logger = logging.getLogger(__name__)


def get_channels_status() -> dict:
    settings = get_settings()
    email_ready = bool(settings.EMAIL_ENABLED and settings.SMTP_HOST and settings.SMTP_FROM)
    telegram_ready = telegram_configured()
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


async def deliver_notification(
    db: AsyncSession,
    recipient: User,
    subject: str,
    body: str,
) -> dict:
    fresh = await db.get(User, recipient.id)
    user = fresh or recipient
    result = {"email": False, "telegram": False, "skipped": []}

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

    return result


async def send_test_notification(db: AsyncSession, user: User) -> dict:
    subject = "Тестовое уведомление D-органайзер"
    body = "Если вы видите это сообщение — канал уведомлений работает."
    delivery = await deliver_notification(db, user, subject, body)
    return {
        "channels": get_channels_status(),
        "user": {
            "email": user.email,
            "notify_via_email": user.notify_via_email,
            "notify_via_telegram": user.notify_via_telegram,
            "telegram_chat_id": bool(user.telegram_chat_id),
        },
        "delivery": delivery,
    }
