from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import ScheduleType, UserRole
from app.core.permissions import can_create_task_in_group, get_accessible_group_ids
from app.db.session import get_db
from app.models.recurring_task import RecurringTaskTemplate
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.recurring_task import RecurringTaskCreate, RecurringTaskRead, RecurringTaskUpdate
from app.services.ai_service import ModerationError, process_fields
from app.services.recurring_service import compute_next_run

router = APIRouter(prefix="/recurring-tasks", tags=["recurring-tasks"])


def validate_recurring_schedule(
    schedule_type: ScheduleType,
    cron_expression: str | None,
    start_date,
    end_date,
) -> None:
    if schedule_type == ScheduleType.CRON and not cron_expression:
        raise HTTPException(status_code=400, detail="Для расписания cron укажите выражение cron")
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="Дата начала не может быть позже даты окончания")


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
    validate_recurring_schedule(data.schedule_type, data.cron_expression, data.start_date, data.end_date)
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
        start_date=data.start_date,
        end_date=data.end_date,
        interval=data.interval,
        weekdays=data.weekdays,
        month_days=data.month_days,
        run_at=data.run_at,
        due_days=data.due_days,
        next_run_at=compute_next_run(
            RecurringTaskTemplate(
                schedule_type=data.schedule_type,
                cron_expression=data.cron_expression,
                start_date=data.start_date,
                interval=data.interval,
                weekdays=data.weekdays,
                month_days=data.month_days,
                run_at=data.run_at,
            )
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
    payload = data.model_dump(exclude_unset=True)
    new_schedule_type = payload.get("schedule_type", template.schedule_type)
    new_cron = payload.get("cron_expression", template.cron_expression)
    new_start = payload.get("start_date", template.start_date)
    new_end = payload.get("end_date", template.end_date)
    validate_recurring_schedule(new_schedule_type, new_cron, new_start, new_end)
    for key, value in payload.items():
        setattr(template, key, value)
    if any(k in payload for k in ("schedule_type", "cron_expression", "start_date", "interval", "weekdays", "month_days", "run_at")):
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
