from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.enums import EntityType, NotificationType, ProjectStatus, UserActionType, UserRole
from app.core.permissions import can_create_project, can_view_group_chat, get_accessible_group_ids
from app.db.session import get_db
from app.models.comment import Comment
from app.models.project import Project, ProjectSubtask
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate, SubtaskCreate, SubtaskRead, SubtaskUpdate
from app.schemas.task import CommentCreate, CommentRead
from app.services.ai_service import ModerationError, process_fields
from app.services.duplicate_message_service import DuplicateMessageError
from app.services.message_submission_service import process_user_message
from app.services.audit_service import log_field_changes, log_task_change, log_user_action
from app.services.notification_service import create_notification

router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=list[ProjectRead])
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Project).options(selectinload(Project.author))
    if user.role != UserRole.SUPERADMIN:
        ids = await get_accessible_group_ids(db, user)
        q = q.where(Project.group_id.in_(ids))
    result = await db.execute(q.order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    out = []
    for p in projects:
        pr = ProjectRead.model_validate(p)
        if p.author:
            pr.author_name = p.author.full_name
        out.append(pr)
    return out


@router.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(project_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if user.role != UserRole.SUPERADMIN:
        ids = await get_accessible_group_ids(db, user)
        if p.group_id not in ids:
            raise HTTPException(status_code=403, detail="Нет доступа")
    pr = ProjectRead.model_validate(p)
    author = await db.get(User, p.author_id)
    if author:
        pr.author_name = author.full_name
    return pr


@router.post("/projects", response_model=MessageResponse)
async def create_project(
    request: Request,
    data: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_create_project(db, user, data.group_id):
        raise HTTPException(status_code=403, detail="Нет прав создавать проекты")
    fields = {"title": data.title}
    if data.description:
        fields["description"] = data.description
    try:
        processed, ai_corrected = await process_fields(
            db, user.id, fields,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    project = Project(
        title=processed["title"],
        description=processed.get("description"),
        group_id=data.group_id,
        author_id=user.id,
        responsible_id=data.responsible_id,
        due_at=data.due_at,
        priority=data.priority,
    )
    db.add(project)
    await db.flush()
    await log_user_action(
        db, user.id, UserActionType.PROJECT_CREATE, EntityType.PROJECT, project.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return MessageResponse(message="Проект создан", ai_corrected=ai_corrected)


@router.patch("/projects/{project_id}", response_model=MessageResponse)
async def update_project(
    project_id: int,
    data: ProjectUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if user.role != UserRole.SUPERADMIN:
        ids = await get_accessible_group_ids(db, user)
        if project.group_id not in ids:
            raise HTTPException(status_code=403, detail="Нет доступа")
    update_data = data.model_dump(exclude_unset=True)
    text_fields = {}
    if "title" in update_data:
        text_fields["title"] = update_data.pop("title")
    if "description" in update_data:
        text_fields["description"] = update_data.pop("description")
    ai_corrected = False
    if text_fields:
        try:
            processed, ai_corrected = await process_fields(
                db, user.id, text_fields,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
            update_data.update(processed)
        except ModerationError as e:
            raise HTTPException(status_code=400, detail=str(e))
    await log_field_changes(
        db, EntityType.PROJECT, project.id, project, update_data,
        ["responsible_id", "due_at", "priority", "status", "spent_hours"], user.id,
    )
    for key, value in update_data.items():
        setattr(project, key, value)
    await log_user_action(
        db, user.id, UserActionType.PROJECT_UPDATE, EntityType.PROJECT, project.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return MessageResponse(message="Проект обновлён", ai_corrected=ai_corrected)


@router.post("/projects/{project_id}/comments", response_model=MessageResponse)
async def project_comment(
    project_id: int,
    data: CommentCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
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
    db.add(Comment(entity_type=EntityType.PROJECT, entity_id=project_id, author_id=user.id, text=ai_result.text))
    return MessageResponse(message="Комментарий добавлен", ai_corrected=ai_result.was_corrected)


@router.get("/projects/{project_id}/subtasks", response_model=list[SubtaskRead])
async def list_subtasks(project_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if user.role != UserRole.SUPERADMIN:
        ids = await get_accessible_group_ids(db, user)
        if project.group_id not in ids:
            raise HTTPException(status_code=403, detail="Нет доступа")
    result = await db.execute(select(ProjectSubtask).where(ProjectSubtask.project_id == project_id))
    subtasks = result.scalars().all()
    out = []
    for s in subtasks:
        sr = SubtaskRead.model_validate(s)
        if s.assignee_id:
            assignee = await db.get(User, s.assignee_id)
            if assignee:
                sr.assignee_name = assignee.full_name
        out.append(sr)
    return out


@router.post("/projects/{project_id}/subtasks", response_model=MessageResponse)
async def create_subtask(
    project_id: int,
    data: SubtaskCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    fields = {"title": data.title}
    if data.description:
        fields["description"] = data.description
    try:
        processed, ai_corrected = await process_fields(
            db, user.id, fields,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    subtask = ProjectSubtask(
        project_id=project_id,
        title=processed["title"],
        description=processed.get("description"),
        author_id=user.id,
        assignee_id=data.assignee_id,
        due_at=data.due_at,
        priority=data.priority,
    )
    db.add(subtask)
    await db.flush()
    if data.assignee_id:
        assignee = await db.get(User, data.assignee_id)
        if assignee:
            await create_notification(
                db, assignee.id, NotificationType.SUBTASK_CREATED,
                "Новая подзадача", f"Создана подзадача: {subtask.title}",
                EntityType.PROJECT_SUBTASK, subtask.id, assignee,
            )
    return MessageResponse(message="Подзадача создана", ai_corrected=ai_corrected)


@router.patch("/project-subtasks/{subtask_id}", response_model=SubtaskRead)
async def update_subtask(
    subtask_id: int,
    data: SubtaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subtask = await db.get(ProjectSubtask, subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="Подзадача не найдена")
    project = await db.get(Project, subtask.project_id)
    if user.role != UserRole.SUPERADMIN:
        ids = await get_accessible_group_ids(db, user)
        if project.group_id not in ids:
            raise HTTPException(status_code=403, detail="Нет доступа")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(subtask, key, value)
    await log_field_changes(
        db, EntityType.PROJECT_SUBTASK, subtask.id, subtask, data.model_dump(exclude_unset=True),
        ["assignee_id", "due_at", "priority", "status", "spent_hours"], user.id,
    )
    return SubtaskRead.model_validate(subtask)


@router.post("/project-subtasks/{subtask_id}/start", response_model=SubtaskRead)
async def start_subtask(subtask_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    subtask = await db.get(ProjectSubtask, subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="Подзадача не найдена")
    subtask.status = ProjectStatus.IN_PROGRESS
    await log_task_change(db, EntityType.PROJECT_SUBTASK, subtask.id, "status", ProjectStatus.NEW, ProjectStatus.IN_PROGRESS, user.id)
    return SubtaskRead.model_validate(subtask)


@router.post("/project-subtasks/{subtask_id}/complete", response_model=SubtaskRead)
async def complete_subtask(subtask_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    subtask = await db.get(ProjectSubtask, subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="Подзадача не найдена")
    subtask.status = ProjectStatus.DONE
    subtask.completed_at = datetime.now(timezone.utc)
    await log_task_change(db, EntityType.PROJECT_SUBTASK, subtask.id, "status", subtask.status, ProjectStatus.DONE, user.id)
    return SubtaskRead.model_validate(subtask)


@router.post("/project-subtasks/{subtask_id}/cancel", response_model=SubtaskRead)
async def cancel_subtask(subtask_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    subtask = await db.get(ProjectSubtask, subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="Подзадача не найдена")
    subtask.status = ProjectStatus.CANCELLED
    return SubtaskRead.model_validate(subtask)


@router.post("/project-subtasks/{subtask_id}/comments", response_model=MessageResponse)
async def subtask_comment(
    subtask_id: int,
    data: CommentCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subtask = await db.get(ProjectSubtask, subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="Подзадача не найдена")
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
    db.add(Comment(entity_type=EntityType.PROJECT_SUBTASK, entity_id=subtask_id, author_id=user.id, text=ai_result.text))
    return MessageResponse(message="Комментарий добавлен", ai_corrected=ai_result.was_corrected)
