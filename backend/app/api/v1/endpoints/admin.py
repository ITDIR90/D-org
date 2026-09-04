import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_superadmin
from app.core.config import get_settings
from app.core.enums import TaskStatus
from app.db.session import get_db
from app.models.task import Task
from app.models.task_attachment import TaskAttachment
from app.models.user import User
from app.schemas.admin import (
    ArchivedTaskRead,
    ArchivedTasksSummary,
    DbStatsRead,
    MediaCleanupResult,
    MediaItemRead,
    MediaStatsRead,
    OrphanFileRead,
    PurgeResult,
)
from app.services.admin_service import (
    _attachment_abspath,
    delete_orphan_files,
    generate_backup,
    get_db_stats,
    get_media_stats,
    list_archived_tasks,
    list_media,
    list_orphan_files,
    purge_task,
    purge_tasks,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_superadmin(user: User = Depends(get_superadmin)) -> User:
    return user


@router.get("/media", response_model=list[MediaItemRead])
async def admin_list_media(
    older_than_days: int | None = Query(default=None, ge=1),
    task_id: int | None = Query(default=None, ge=1),
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    items, _ = await list_media(db, older_than_days=older_than_days, task_id=task_id)
    return items


@router.get("/media/stats", response_model=MediaStatsRead)
async def admin_media_stats(
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    return await get_media_stats(db)


@router.get("/db/stats", response_model=DbStatsRead)
async def admin_db_stats(
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    return await get_db_stats(db)


@router.get("/db/backup")
async def admin_db_backup(
    _: User = Depends(_require_superadmin),
):
    settings = get_settings()
    filename, proc, stderr_task, args = await generate_backup(settings)

    async def iter_dump():
        stderr = b""
        try:
            while True:
                chunk = await proc.stdout.read(65536)
                if not chunk:
                    break
                yield chunk
            returncode = await proc.wait()
            if returncode != 0:
                try:
                    stderr = await asyncio.wait_for(stderr_task, timeout=5)
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    stderr = b""
                raise HTTPException(
                    status_code=502,
                    detail=f"Ошибка создания резервной копии (код {returncode}). stderr: {stderr.decode(errors='ignore')[:500]}",
                )
        finally:
            if proc.returncode is None:
                proc.kill()
                await proc.wait()
            try:
                stderr_task.cancel()
            except asyncio.CancelledError:
                pass

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    return StreamingResponse(
        iter_dump(),
        media_type="application/sql",
        headers=headers,
    )


@router.get("/media/orphans", response_model=list[OrphanFileRead])
async def admin_list_orphans(
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    return await list_orphan_files(db)


@router.delete("/media/orphans", response_model=MediaCleanupResult)
async def admin_delete_orphans(
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    files = await list_orphan_files(db)
    freed = await delete_orphan_files([f["stored_name"] for f in files])
    return MediaCleanupResult(deleted_records=0, freed_bytes=freed)


@router.delete("/media/{attachment_id}", response_model=MediaCleanupResult)
async def admin_delete_media_one(
    attachment_id: int,
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    attachment = (await db.execute(
        select(TaskAttachment).where(TaskAttachment.id == attachment_id)
    )).scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Вложение не найдено")
    stored = attachment.stored_name
    freed = attachment.size_bytes
    await db.delete(attachment)
    _delete_file(stored)
    return MediaCleanupResult(deleted_records=1, freed_bytes=freed)


@router.delete("/media", response_model=MediaCleanupResult)
async def admin_delete_media_batch(
    older_than_days: int | None = Query(default=None, ge=1),
    task_id: int | None = Query(default=None, ge=1),
    ids: list[int] | None = Query(default=None),
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timedelta, timezone

    if task_id is None and older_than_days is None and not ids:
        raise HTTPException(
            status_code=400,
            detail="Укажите хотя бы один фильтр: task_id, older_than_days или ids",
        )
    query = select(TaskAttachment)
    if task_id is not None:
        query = query.where(TaskAttachment.task_id == task_id)
    if older_than_days is not None and older_than_days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        query = query.where(TaskAttachment.created_at < cutoff)
    if ids:
        query = query.where(TaskAttachment.id.in_(ids))
    atts = (await db.execute(query)).scalars().all()
    if not atts:
        return MediaCleanupResult(deleted_records=0, freed_bytes=0)
    stored_names = [a.stored_name for a in atts]
    freed = sum(a.size_bytes for a in atts)
    for a in atts:
        await db.delete(a)
    for s in stored_names:
        _delete_file(s)
    return MediaCleanupResult(deleted_records=len(atts), freed_bytes=freed)


def _delete_file(stored_name: str) -> None:
    p = _attachment_abspath(stored_name)
    if p.is_file():
        try:
            p.unlink()
        except OSError:
            pass


@router.get("/tasks/archived", response_model=list[ArchivedTaskRead])
async def admin_list_archived(
    older_than_days: int | None = Query(default=None, ge=1),
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    items, _, _, _ = await list_archived_tasks(db, older_than_days=older_than_days)
    return items


@router.get("/tasks/archived/summary", response_model=ArchivedTasksSummary)
async def admin_archived_summary(
    older_than_days: int | None = Query(default=None, ge=1),
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    items, total_bytes, total_related, count = await list_archived_tasks(db, older_than_days=older_than_days)
    return ArchivedTasksSummary(count=count, total_bytes=total_bytes, total_related=total_related)


@router.delete("/tasks/{task_id}/purge", response_model=PurgeResult)
async def admin_purge_task(
    task_id: int,
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    task = (await db.execute(
        select(Task).where(Task.id == task_id, Task.status == TaskStatus.ARCHIVED)
    )).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Архивная задача не найдена")
    result = await purge_task(db, task)
    return result


@router.delete("/tasks/purge", response_model=PurgeResult)
async def admin_purge_tasks_batch(
    ids: list[int] = Query(...),
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    if not ids:
        return PurgeResult(purged_tasks=0, deleted_tasks=0, deleted_attachments=0, freed_bytes=0)
    result = await purge_tasks(db, ids)
    return result
