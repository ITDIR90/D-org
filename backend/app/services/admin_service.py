from __future__ import annotations

import asyncio
import logging
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import EntityType, TaskStatus
from app.models.category import Category
from app.models.comment import Comment
from app.models.group import Group
from app.models.logs import TaskChangeLog
from app.models.notification import Notification
from app.models.task import Task
from app.models.task_attachment import TaskAttachment
from app.models.user import User

_UPLOAD_DIR = Path(get_settings().UPLOAD_DIR).resolve()

logger = logging.getLogger(__name__)


def _attachment_abspath(stored_name: str) -> Path:
    return _UPLOAD_DIR / stored_name


def _scan_disk_files() -> dict[str, int]:
    """stored_name -> size_bytes for every file currently on disk."""
    out: dict[str, int] = {}
    if not _UPLOAD_DIR.is_dir():
        return out
    for p in _UPLOAD_DIR.iterdir():
        if p.is_file():
            try:
                out[p.name] = p.stat().st_size
            except OSError:
                continue
    return out


def _size_of(name: str) -> int:
    try:
        return (_UPLOAD_DIR / name).stat().st_size
    except OSError:
        return 0


async def get_db_stats(db: AsyncSession) -> dict:
    """Общий размер базы данных + число таблиц и суммарное количество строк."""
    database_name = get_settings().DATABASE_URL.rsplit("/", 1)[-1]

    total_bytes = (await db.execute(
        text("SELECT pg_database_size(current_database())")
    )).scalar_one() or 0

    tables_count = (await db.execute(
        text("""
            SELECT count(*) FROM pg_catalog.pg_tables
            WHERE schemaname = 'public'
        """)
    )).scalar_one() or 0

    rows_total = (await db.execute(
        text("""
            SELECT coalesce(sum(n_live_tup), 0)
            FROM pg_catalog.pg_stat_user_tables
        """)
    )).scalar_one() or 0

    return {
        "database_name": database_name,
        "total_bytes": int(total_bytes),
        "tables_count": int(tables_count),
        "rows_total": int(rows_total),
    }


def _pg_dump_env(settings) -> tuple[list[str], dict]:
    """Разбирает DATABASE_URL (postgresql+asyncpg://user:pass@host:port/db) в (args, env)."""
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
    parsed = urllib.parse.urlparse(url)
    args = [
        "pg_dump",
        "--host", parsed.hostname or "localhost",
        "--port", str(parsed.port or 5432),
        "--username", urllib.parse.unquote(parsed.username or ""),
        "--dbname", parsed.path.lstrip("/"),
        "--format", "plain",
        "--create",
        "--clean",
        "--if-exists",
        "--no-owner",
    ]
    env = {
        "PGPASSWORD": urllib.parse.unquote(parsed.password or ""),
        "PATH": "/usr/bin:/bin:/usr/local/bin",
    }
    return args, env


async def generate_backup(settings) -> tuple[str, asyncio.subprocess.Process, asyncio.Task, list[str]]:
    """Запускает pg_dump и возвращает (filename, процесс, таска-чтения stderr, args)."""
    parsed = urllib.parse.urlparse(
        settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
    )
    args, env = _pg_dump_env(settings)
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stderr_task = asyncio.create_task(proc.stderr.read())
    filename = f"{parsed.path.lstrip('/')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    return filename, proc, stderr_task, args




async def get_media_stats(db: AsyncSession) -> dict:
    records = (await db.execute(select(func.count(TaskAttachment.id)))).scalar() or 0
    total_bytes = (await db.execute(select(func.coalesce(func.sum(TaskAttachment.size_bytes), 0)))).scalar() or 0

    disk = _scan_disk_files()
    result = await db.execute(select(TaskAttachment.stored_name))
    stored_names = {row[0] for row in result.all()}

    orphan_files = sorted(set(disk) - stored_names)
    orphan_file_bytes = sum(disk.get(n, 0) for n in orphan_files)
    orphan_records = len(stored_names - set(disk))

    return {
        "total_count": int(records),
        "total_bytes": int(total_bytes),
        "orphan_files": len(orphan_files),
        "orphan_files_bytes": orphan_file_bytes,
        "orphan_records": orphan_records,
    }


async def list_orphan_files(db: AsyncSession) -> list[dict]:
    disk = _scan_disk_files()
    result = await db.execute(select(TaskAttachment.stored_name))
    stored_names = {row[0] for row in result.all()}
    orphans = sorted(set(disk) - stored_names)
    return [{"stored_name": n, "size_bytes": disk[n]} for n in orphans]


async def list_media(
    db: AsyncSession,
    older_than_days: int | None = None,
    task_id: int | None = None,
) -> tuple[list[dict], int]:
    query = select(TaskAttachment).options(
        selectinload(TaskAttachment.task).selectinload(Task.author),
        selectinload(TaskAttachment.uploaded_by),
    )
    if older_than_days is not None and older_than_days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        query = query.where(TaskAttachment.created_at < cutoff)
    if task_id is not None:
        query = query.where(TaskAttachment.task_id == task_id)
    query = query.order_by(TaskAttachment.created_at.desc())

    rows = (await db.execute(query)).scalars().all()
    total_bytes = sum(r.size_bytes for r in rows)

    items = []
    for a in rows:
        items.append(_media_to_dict(a, a.task, a.uploaded_by))
    return items, total_bytes


def _media_to_dict(a: TaskAttachment, task: Task | None, uploader: User | None) -> dict:
    return {
        "id": a.id,
        "task_id": a.task_id,
        "task_number": task.number if task else None,
        "task_title": task.title if task else None,
        "original_name": a.original_name,
        "content_type": a.content_type,
        "size_bytes": a.size_bytes,
        "created_at": a.created_at,
        "uploaded_by_name": uploader.full_name if uploader else None,
        "url": f"/api/v1/tasks/{a.task_id}/attachments/{a.id}/file",
    }


async def delete_attachment_entities(db: AsyncSession, attachment: TaskAttachment) -> int:
    """Удаляет запись и (после commit) файл. Возвращает освобождённые байты."""
    path = _attachment_abspath(attachment.stored_name)
    await db.delete(attachment)
    return _size_of(attachment.stored_name)  # размер до удаления файла


async def delete_orphan_files(files: list[str]) -> int:
    freed = 0
    for n in files:
        p = _attachment_abspath(n)
        if p.is_file():
            freed += p.stat().st_size
            try:
                p.unlink()
            except OSError:
                logger.warning("Failed to delete orphan file: %s", n)
    return freed


async def purge_media_record_and_file(db: AsyncSession, attachment: TaskAttachment) -> int:
    return await delete_attachment_entities(db, attachment)


async def list_archived_tasks(
    db: AsyncSession,
    older_than_days: int | None = None,
    task_id: int | None = None,
) -> tuple[list[dict], int, int, int]:
    query = select(Task).options(
        selectinload(Task.category),
        selectinload(Task.target_group),
        selectinload(Task.author),
        selectinload(Task.assignee),
    ).where(Task.status == TaskStatus.ARCHIVED)
    if older_than_days is not None and older_than_days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        query = query.where(Task.updated_at < cutoff)
    if task_id is not None:
        query = query.where(Task.id == task_id)
    query = query.order_by(Task.updated_at.desc())
    rows = (await db.execute(query)).scalars().all()

    if not rows:
        return [], 0, 0, 0

    task_ids = [t.id for t in rows]

    # Subqueries for counts - one query each for all tasks
    att_subq = (
        select(TaskAttachment.task_id, func.count(TaskAttachment.id).label("att_count"), func.coalesce(func.sum(TaskAttachment.size_bytes), 0).label("att_bytes"))
        .where(TaskAttachment.task_id.in_(task_ids))
        .group_by(TaskAttachment.task_id)
        .subquery()
    )

    comment_subq = (
        select(Comment.entity_id, func.count(Comment.id).label("count"))
        .where(Comment.entity_type == EntityType.TASK, Comment.entity_id.in_(task_ids))
        .group_by(Comment.entity_id)
        .subquery()
    )

    changelog_subq = (
        select(TaskChangeLog.entity_id, func.count(TaskChangeLog.id).label("count"))
        .where(TaskChangeLog.entity_type == EntityType.TASK, TaskChangeLog.entity_id.in_(task_ids))
        .group_by(TaskChangeLog.entity_id)
        .subquery()
    )

    notif_subq = (
        select(Notification.entity_id, func.count(Notification.id).label("count"))
        .where(Notification.entity_type == EntityType.TASK, Notification.entity_id.in_(task_ids))
        .group_by(Notification.entity_id)
        .subquery()
    )

    # Execute all count queries
    att_results = (await db.execute(select(att_subq))).all()
    comment_results = (await db.execute(select(comment_subq))).all()
    changelog_results = (await db.execute(select(changelog_subq))).all()
    notif_results = (await db.execute(select(notif_subq))).all()

    att_map = {r.task_id: (r.att_count, r.att_bytes) for r in att_results}
    comment_map = {r.entity_id: r.count for r in comment_results}
    changelog_map = {r.entity_id: r.count for r in changelog_results}
    notif_map = {r.entity_id: r.count for r in notif_results}

    items = []
    total_bytes = 0
    total_related = 0
    for t in rows:
        att_count, att_bytes = att_map.get(t.id, (0, 0))
        comments_count = comment_map.get(t.id, 0)
        change_count = changelog_map.get(t.id, 0)
        notif_count = notif_map.get(t.id, 0)

        total_related += att_count + comments_count + change_count + notif_count
        total_bytes += int(att_bytes or 0)

        items.append({
            "id": t.id,
            "number": t.number,
            "title": t.title,
            "category_name": t.category.name if t.category else None,
            "target_group_name": t.target_group.name if t.target_group else None,
            "author_name": t.author.full_name if t.author else None,
            "assignee_name": t.assignee.full_name if t.assignee else None,
            "updated_at": t.updated_at,
            "attachments_count": int(att_count),
            "comments_count": int(comments_count),
            "change_logs_count": int(change_count),
            "notifications_count": int(notif_count),
            "total_bytes": int(att_bytes or 0),
            "total_related": int(att_count + comments_count + change_count + notif_count),
        })
    return items, total_bytes, total_related, len(items)


async def purge_task(db: AsyncSession, task: Task) -> dict:
    """Безвозвратно удаляет архивную задачу и всё связанное. Возвращает статистику."""
    task_id = task.id
    freed_bytes = 0

    # Вложения — удаляем записи + файлы.
    attachments = (await db.execute(
        select(TaskAttachment).where(TaskAttachment.task_id == task_id)
    )).scalars().all()
    attach_count = len(attachments)
    for a in attachments:
        freed_bytes += await delete_attachment_entities(db, a)

    # Удаляем физические файлы вложений (после удаления записей из ДБ).
    for a in attachments:
        p = _attachment_abspath(a.stored_name)
        if p.is_file():
            try:
                p.unlink()
            except OSError:
                logger.warning("Failed to delete attachment file: %s", a.stored_name)

    # Комментарии / журнал / уведомления по entity (сначала соберём id файлов не нужно — только удаляем).
    await db.execute(delete(Comment).where(
        Comment.entity_type == EntityType.TASK, Comment.entity_id == task_id))
    await db.execute(delete(TaskChangeLog).where(
        TaskChangeLog.entity_type == EntityType.TASK, TaskChangeLog.entity_id == task_id))
    await db.execute(delete(Notification).where(
        Notification.entity_type == EntityType.TASK, Notification.entity_id == task_id))

    await db.delete(task)
    return {
        "purged_tasks": 1,
        "deleted_tasks": 1,
        "deleted_attachments": attach_count,
        "freed_bytes": freed_bytes,
    }


async def purge_tasks(db: AsyncSession, task_ids: list[int]) -> dict:
    total = {
        "purged_tasks": 0,
        "deleted_tasks": 0,
        "deleted_attachments": 0,
        "freed_bytes": 0,
    }
    query = select(Task).where(Task.id.in_(task_ids))
    tasks = (await db.execute(query)).scalars().all()
    for t in tasks:
        r = await purge_task(db, t)
        for k in total:
            total[k] += r[k]
    return total
