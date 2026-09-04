from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import EntityType
from app.core.permissions import can_view_task, is_group_admin
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.task import Task
from app.models.task_attachment import TaskAttachment
from app.models.user import User
from app.schemas.attachment import TaskAttachmentRead
from app.services.attachment_service import (
    can_manage_attachments,
    delete_attachment,
    get_attachment_or_404,
    load_attachment_bytes,
    save_attachment,
)
from app.services.audit_service import log_task_change
from app.services.task_service import get_task_or_404

router = APIRouter(prefix="/tasks", tags=["tasks-attachments"])

_bearer = HTTPBearer(auto_error=False)


@router.post("/{task_id}/attachments", response_model=TaskAttachmentRead, status_code=201)
async def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await get_task_or_404(db, task_id)
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    if not can_manage_attachments(user, task) and not await is_group_admin(db, user, task.target_group_id):
        raise HTTPException(status_code=403, detail="Прикреплять изображения может автор, исполнитель или администратор группы")
    try:
        attachment = await save_attachment(db, task, user, file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await log_task_change(db, EntityType.TASK, task.id, "attachment", None, attachment.original_name, user.id)
    return _to_read(attachment)


@router.get("/{task_id}/attachments", response_model=list[TaskAttachmentRead])
async def list_attachments(
    task_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await get_task_or_404(db, task_id)
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    result = await db.execute(
        select(TaskAttachment)
        .where(TaskAttachment.task_id == task_id)
        .order_by(TaskAttachment.created_at)
    )
    return [_to_read(a) for a in result.scalars().all()]


@router.delete("/{task_id}/attachments/{attachment_id}")
async def remove_attachment(
    task_id: int,
    attachment_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await get_task_or_404(db, task_id)
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    try:
        attachment = await get_attachment_or_404(db, attachment_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Вложение не найдено")
    if not can_manage_attachments(user, task) and not await is_group_admin(db, user, task.target_group_id):
        raise HTTPException(status_code=403, detail="Удалять изображения может автор, исполнитель или администратор группы")
    await delete_attachment(db, user, task, attachment)
    await log_task_change(db, EntityType.TASK, task.id, "attachment_deleted", attachment.original_name, None, user.id)
    return {"message": "Вложение удалено"}


@router.get("/{task_id}/attachments/{attachment_id}/file")
async def download_attachment(
    task_id: int,
    attachment_id: int,
    token: str | None = Query(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """Отдача файла. Для <img> — токен в query-параметре `token`; иначе — Authorization header."""
    resolved_user: User | None = None
    raw_token: str | None = None
    if credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if raw_token:
        payload = decode_access_token(raw_token)
        if payload and "sub" in payload:
            res = await db.execute(select(User).where(User.id == int(payload["sub"])))
            resolved_user = res.scalar_one_or_none()

    if resolved_user is None or not resolved_user.is_active:
        raise HTTPException(status_code=401, detail="Требуется авторизация")

    task = await get_task_or_404(db, task_id)
    if not await can_view_task(db, resolved_user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    try:
        attachment = await get_attachment_or_404(db, attachment_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Вложение не найдено")
    try:
        data = load_attachment_bytes(attachment)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Файл вложения отсутствует")
    return Response(
        content=data,
        media_type=attachment.content_type,
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )


def _to_read(attachment: TaskAttachment) -> TaskAttachmentRead:
    return TaskAttachmentRead(
        id=attachment.id,
        task_id=attachment.task_id,
        original_name=attachment.original_name,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
        created_at=attachment.created_at or datetime.now(),
        url=f"/api/v1/tasks/{attachment.task_id}/attachments/{attachment.id}/file",
    )
