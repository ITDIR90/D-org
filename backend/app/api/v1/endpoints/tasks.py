from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import EntityType, NotificationType, TaskStatus, UserActionType, UserRole
from app.core.permissions import can_view_task, is_group_admin
from app.services.audit_service import log_task_change
from app.db.session import get_db
from app.models.comment import Comment
from app.models.logs import TaskChangeLog
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.logs import TaskChangeLogRead
from app.schemas.task import CommentCreate, CommentRead, TaskCreate, TaskRead, TaskUpdate
from app.services.ai_service import ModerationError
from app.services.duplicate_message_service import DuplicateMessageError
from app.services.message_submission_service import process_user_message
from app.services.audit_service import log_user_action
from app.services.notification_service import create_notification
from app.services.task_service import (
    cancel_task,
    complete_task,
    confirm_task,
    create_task,
    enrich_task,
    get_task_or_404,
    list_tasks_query,
    take_task,
    task_to_read,
    update_task,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskRead])
async def list_tasks(
    my_tasks: bool = False,
    created_by_me: bool = False,
    my_group: bool = False,
    unassigned: bool = False,
    overdue: bool = False,
    awaiting_confirmation: bool = False,
    group_id: int | None = None,
    status: TaskStatus | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tasks = await list_tasks_query(
        db, user,
        my_tasks=my_tasks, created_by_me=created_by_me, my_group=my_group, unassigned=unassigned,
        overdue=overdue, awaiting_confirmation=awaiting_confirmation,
        group_id=group_id, status=status,
    )
    return [enrich_task(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await get_task_or_404(db, task_id)
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return enrich_task(task)


@router.post("", response_model=MessageResponse)
async def create_task_endpoint(
    request: Request,
    data: TaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task, ai_corrected = await create_task(
        db, user, data,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return MessageResponse(message="Задача создана", ai_corrected=ai_corrected)


@router.patch("/{task_id}", response_model=MessageResponse)
async def update_task_endpoint(
    task_id: int,
    data: TaskUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await get_task_or_404(db, task_id)
    _, ai_corrected = await update_task(
        db, user, task, data,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return MessageResponse(message="Задача обновлена", ai_corrected=ai_corrected)


@router.post("/{task_id}/take", response_model=TaskRead)
async def take(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await get_task_or_404(db, task_id)
    await take_task(db, user, task)
    return await task_to_read(db, task_id)


@router.post("/{task_id}/start", response_model=TaskRead)
async def start(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await get_task_or_404(db, task_id)
    if task.assignee_id != user.id and not await is_group_admin(db, user, task.target_group_id):
        if user.role != UserRole.SUPERADMIN:
            raise HTTPException(status_code=403, detail="Нет прав")
    if task.status not in (TaskStatus.NEW, TaskStatus.IN_PROGRESS):
        raise HTTPException(status_code=400, detail="Задачу нельзя начать")
    old_status = task.status
    task.status = TaskStatus.IN_PROGRESS
    await log_task_change(db, EntityType.TASK, task.id, "status", old_status, TaskStatus.IN_PROGRESS, user.id)
    await db.flush()
    return await task_to_read(db, task_id)


@router.post("/{task_id}/complete", response_model=TaskRead)
async def complete(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await get_task_or_404(db, task_id)
    await complete_task(db, user, task)
    return await task_to_read(db, task_id)


@router.post("/{task_id}/confirm", response_model=TaskRead)
async def confirm(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await get_task_or_404(db, task_id)
    await confirm_task(db, user, task)
    return await task_to_read(db, task_id)


@router.post("/{task_id}/cancel", response_model=TaskRead)
async def cancel(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await get_task_or_404(db, task_id)
    await cancel_task(db, user, task)
    return await task_to_read(db, task_id)


@router.post("/{task_id}/comments", response_model=MessageResponse)
async def add_comment(
    task_id: int,
    data: CommentCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await get_task_or_404(db, task_id)
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    try:
        ai_result = await process_user_message(
            db, user.id, data.text,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except DuplicateMessageError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    comment = Comment(
        entity_type=EntityType.TASK, entity_id=task_id, author_id=user.id, text=ai_result.text
    )
    db.add(comment)
    if task.author_id != user.id:
        author = await db.get(User, task.author_id)
        if author:
            await create_notification(
                db, author.id, NotificationType.COMMENT_ADDED,
                "Новый комментарий", f"Комментарий к задаче «{task.title}»",
                EntityType.TASK, task.id, author,
            )
    if task.assignee_id and task.assignee_id != user.id:
        assignee = await db.get(User, task.assignee_id)
        if assignee:
            await create_notification(
                db, assignee.id, NotificationType.COMMENT_ADDED,
                "Новый комментарий", f"Комментарий к задаче «{task.title}»",
                EntityType.TASK, task.id, assignee,
            )
    return MessageResponse(
        message="Комментарий добавлен",
        ai_corrected=ai_result.was_corrected,
    )


@router.get("/{task_id}/comments", response_model=list[CommentRead])
async def list_comments(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await get_task_or_404(db, task_id)
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    result = await db.execute(
        select(Comment).where(Comment.entity_type == EntityType.TASK, Comment.entity_id == task_id)
        .order_by(Comment.created_at)
    )
    comments = result.scalars().all()
    out = []
    for c in comments:
        cr = CommentRead.model_validate(c)
        author = await db.get(User, c.author_id)
        if author:
            cr.author_name = author.full_name
        out.append(cr)
    return out


@router.get("/{task_id}/history", response_model=list[TaskChangeLogRead])
async def task_history(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await get_task_or_404(db, task_id)
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    result = await db.execute(
        select(TaskChangeLog).where(
            TaskChangeLog.entity_type == EntityType.TASK, TaskChangeLog.entity_id == task_id
        ).order_by(TaskChangeLog.changed_at.desc())
    )
    logs = result.scalars().all()
    out = []
    for log in logs:
        lr = TaskChangeLogRead.model_validate(log)
        changer = await db.get(User, log.changed_by_id)
        if changer:
            lr.changed_by_name = changer.full_name
        out.append(lr)
    return out
