from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.report import CompletedTasksReport, EmployeeEfficiencyReport
from app.services.report_service import (
    get_completed_tasks_report,
    get_employee_efficiency_report,
)
from app.services.report_service import export_completed_tasks_xlsx

router = APIRouter(prefix="/reports", tags=["reports"])


def _parse_date(value: str, field: str) -> datetime:
    try:
        d = date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Некорректная дата '{field}': {value}")
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


@router.get("/employee-efficiency", response_model=EmployeeEfficiencyReport)
async def employee_efficiency(
    period_days: int = Query(default=30, ge=1, le=365),
    group_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_employee_efficiency_report(db, user, period_days=period_days, group_id=group_id)


@router.get("/completed-tasks", response_model=CompletedTasksReport)
async def completed_tasks(
    date_from: str = Query(description="Начало периода (YYYY-MM-DD)"),
    date_to: str = Query(description="Конец периода (YYYY-MM-DD, включительно)"),
    group_id: int | None = Query(default=None),
    user_id: int | None = Query(default=None),
    category_id: int | None = Query(default=None),
    group_by: str = Query(default="category", description="Группировка строк: 'category' или 'user'"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dt_from = _parse_date(date_from, "date_from")
    # включительный конец периода
    dt_to = datetime.combine(date.fromisoformat(date_to), time.max, tzinfo=timezone.utc)
    return await get_completed_tasks_report(
        db,
        user,
        date_from=dt_from,
        date_to=dt_to,
        group_id=group_id,
        user_id=user_id,
        category_id=category_id,
        group_by=group_by,
    )


@router.get("/completed-tasks/export")
async def completed_tasks_export(
    date_from: str = Query(description="Начало периода (YYYY-MM-DD)"),
    date_to: str = Query(description="Конец периода (YYYY-MM-DD, включительно)"),
    group_id: int | None = Query(default=None),
    user_id: int | None = Query(default=None),
    category_id: int | None = Query(default=None),
    group_by: str = Query(default="category", description="Группировка строк: 'category' или 'user'"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dt_from = _parse_date(date_from, "date_from")
    dt_to = datetime.combine(date.fromisoformat(date_to), time.max, tzinfo=timezone.utc)
    report = await get_completed_tasks_report(
        db,
        user,
        date_from=dt_from,
        date_to=dt_to,
        group_id=group_id,
        user_id=user_id,
        category_id=category_id,
        group_by=group_by,
    )
    payload, filename = export_completed_tasks_xlsx(report)
    return Response(
        content=payload,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
