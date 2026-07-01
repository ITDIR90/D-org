import logging
from email.message import EmailMessage

import aiosmtplib
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import UserActionType
from app.services.audit_service import log_user_action

logger = logging.getLogger(__name__)


async def send_email(
    db: AsyncSession,
    user_id: int | None,
    to_email: str,
    subject: str,
    body: str,
    ip_address: str | None = None,
) -> bool:
    settings = get_settings()
    if not settings.EMAIL_ENABLED:
        return False
    if not settings.SMTP_HOST or not settings.SMTP_FROM:
        return False

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=settings.SMTP_USE_TLS,
        )
        await log_user_action(
            db,
            user_id=user_id,
            action=UserActionType.EMAIL_SENT,
            details=f"Email to {to_email}: {subject}",
            ip_address=ip_address,
        )
        return True
    except Exception as e:
        logger.exception("Email send failed")
        await log_user_action(
            db,
            user_id=user_id,
            action=UserActionType.EMAIL_ERROR,
            details=str(e)[:500],
            ip_address=ip_address,
        )
        return False
