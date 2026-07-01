from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import UserRole
from app.core.permissions import can_create_task_in_group, get_accessible_group_ids
from app.db.session import get_db
from app.models.recurring_task import RecurringTaskTemplate
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.recurring_task import RecurringTaskCreate, RecurringTaskRead, RecurringTaskUpdate
from app.services.ai_service import ModerationError, process_fields
from app.services.recurring_service import compute_next_run

router = APIRouter(prefix="/recurring-tasks", tags=["recurring-tasks"])


@router.get("", response_model=list[RecurringTaskRead])
async def list_recurring(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(RecurringTaskTemplate)
    if user.role != UserRole.SUPERADMIN:
        ids = await get_accessible_group_ids(db, user)
        q = q.where(RecurringTaskTemplate.target_group_id.in_(ids))
    result = await db.execute(q.order_by(RecurringTaskTemplate.id))
    return result.scalars().all()


@router.post("", response_model=MessageResponse)
async def create_recurring(
    request: Request,
    data: RecurringTaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_create_task_in_group(db, user, data.target_group_id):
        raise HTTPException(status_code=403, detail="Нет прав")
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
    template = RecurringTaskTemplate(
        title=processed["title"],
        description=processed.get("description"),
        author_id=user.id,
        target_group_id=data.target_group_id,
        category_id=data.category_id,
        default_assignee_id=data.default_assignee_id,
        priority=data.priority,
        schedule_type=data.schedule_type,
        cron_expression=data.cron_expression,
        due_days=data.due_days,
        next_run_at=compute_next_run(
            RecurringTaskTemplate(schedule_type=data.schedule_type, cron_expression=data.cron_expression)
        ),
    )
    db.add(template)
    return MessageResponse(message="Шаблон создан", ai_corrected=ai_corrected)


@router.patch("/{template_id}", response_model=RecurringTaskRead)
async def update_recurring(
    template_id: int,
    data: RecurringTaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await db.get(RecurringTaskTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    if data.schedule_type or data.cron_expression:
        template.next_run_at = compute_next_run(template)
    return template


@router.post("/{template_id}/activate")
async def activate(template_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    template = await db.get(RecurringTaskTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    template.is_active = True
    if not template.next_run_at:
        template.next_run_at = compute_next_run(template)
    return {"message": "Шаблон активирован"}


@router.post("/{template_id}/deactivate")
async def deactivate(template_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    template = await db.get(RecurringTaskTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    template.is_active = False
    return {"message": "Шаблон деактивирован"}
