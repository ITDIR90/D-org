from __future__ import annotations

import uuid
from logging import getLogger
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.task import Task
from app.models.task_attachment import TaskAttachment
from app.models.user import User

logger = getLogger(__name__)

settings = get_settings()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


async def _read_limited(file: UploadFile) -> tuple[bytes, str | None]:
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    chunks: list[bytes] = []
    size = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        chunks.append(chunk)
        size += len(chunk)
        if size > max_bytes:
            return b"", f"Файл больше {settings.MAX_UPLOAD_SIZE_MB} МБ"
    return b"".join(chunks), None


async def save_attachment(
    db: AsyncSession,
    task: Task,
    user: User,
    file: UploadFile,
) -> TaskAttachment:
    data, err = await _read_limited(file)
    if err:
        raise ValueError(err)

    # Надёжное определение типа по самому контенту (магические байты).
    # Не полагаемся на Content-Type клиента и расширение — проверяем реальный формат.
    content_type = _detect_content_type(data)
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError("Недопустимый тип файла: принимаются только изображения (JPG, PNG, WEBP, GIF)")

    stored_name = _make_stored_name(ALLOWED_CONTENT_TYPES[content_type])
    abs_dir = Path(get_settings().UPLOAD_DIR).resolve()
    abs_dir.mkdir(parents=True, exist_ok=True)
    (abs_dir / stored_name).write_bytes(data)

    attachment = TaskAttachment(
        task_id=task.id,
        uploaded_by_id=user.id,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        content_type=content_type,
        size_bytes=len(data),
    )
    db.add(attachment)
    await db.flush()
    logger.info("Attachment #%s saved for task #%s by user #%s (%s)", attachment.id, task.id, user.id, stored_name)
    return attachment


def _make_stored_name(ext: str) -> str:
    return f"{uuid.uuid4().hex}.{ext}"


def _detect_content_type(data: bytes) -> str | None:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"GIF8":
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def get_attachment_or_404(db: AsyncSession, attachment_id: int) -> TaskAttachment:
    result = await db.execute(
        select(TaskAttachment).where(TaskAttachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise ValueError("Вложение не найдено")
    return attachment


def attachment_abspath(attachment: TaskAttachment) -> Path:
    from app.core.config import get_settings as _gs
    base = Path(_gs().UPLOAD_DIR).resolve()
    return base / attachment.stored_name


def load_attachment_bytes(attachment: TaskAttachment) -> bytes:
    path = attachment_abspath(attachment)
    if not path.is_file():
        raise FileNotFoundError("Файл вложения отсутствует")
    return path.read_bytes()


async def delete_attachment(db: AsyncSession, user: User, task: Task, attachment: TaskAttachment) -> None:
    path = attachment_abspath(attachment)
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            logger.warning("Could not remove file for attachment #%s", attachment.id)
    await db.delete(attachment)
    logger.info("Attachment #%s deleted for task #%s by user #%s", attachment.id, task.id, user.id)


def can_manage_attachments(user: User, task: Task) -> bool:
    from app.core.enums import UserRole
    if user.role == UserRole.SUPERADMIN:
        return True
    if user.role == UserRole.GROUP_ADMIN:
        return True
    return user.id == (task.assignee_id or -1) or user.id == task.author_id
