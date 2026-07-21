from datetime import datetime, timedelta, timezone

from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import TaskStatus, UserRole
from app.core.permissions import get_user_admin_group_ids, is_admin_user
from app.models.task import Task
from app.models.user import User
from app.schemas.report import EmployeeEfficiencyReport, EmployeeEfficiencyRow


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _hours_between(start: datetime, end: datetime) -> float:
    return max(0.0, (_ensure_utc(end) - _ensure_utc(start)).total_seconds() / 3600)


async def get_employee_efficiency_report(
    db: AsyncSession,
    user: User,
    *,
    period_days: int = 30,
    group_id: int | None = None,
) -> EmployeeEfficiencyReport:
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Отчёт доступен только администраторам")
    if period_days < 1 or period_days > 365:
        raise HTTPException(status_code=400, detail="Период должен быть от 1 до 365 дней")

    since = datetime.now(timezone.utc) - timedelta(days=period_days)
    q = (
        select(Task)
        .options(selectinload(Task.assignee))
        .where(
            Task.status == TaskStatus.DONE,
            Task.completed_at.is_not(None),
            Task.completed_at >= since,
            Task.assignee_id.is_not(None),
        )
    )

    if group_id is not None:
        if user.role == UserRole.GROUP_ADMIN:
            admin_groups = await get_user_admin_group_ids(db, user)
            if group_id not in admin_groups:
                raise HTTPException(status_code=403, detail="Нет доступа к этой группе")
        q = q.where(Task.target_group_id == group_id)
    elif user.role == UserRole.GROUP_ADMIN:
        admin_groups = await get_user_admin_group_ids(db, user)
        if not admin_groups:
            return EmployeeEfficiencyReport(period_days=period_days, group_id=group_id, rows=[])
        q = q.where(Task.target_group_id.in_(admin_groups))

    result = await db.execute(q.order_by(Task.completed_at.desc()))
    tasks = result.scalars().all()

    stats: dict[int, dict] = defaultdict(
        lambda: {
            "full_name": "",
            "completed_count": 0,
            "completion_hours": [],
            "on_time_count": 0,
            "overdue_hours": [],
        }
    )

    for task in tasks:
        if not task.assignee_id or not task.completed_at:
            continue
        bucket = stats[task.assignee_id]
        bucket["full_name"] = task.assignee.full_name if task.assignee else f"#{task.assignee_id}"
        bucket["completed_count"] += 1
        hours = _hours_between(task.created_at, task.completed_at)
        bucket["completion_hours"].append(hours)
        due_at = _ensure_utc(task.due_at)
        completed_at = _ensure_utc(task.completed_at)
        if completed_at <= due_at:
            bucket["on_time_count"] += 1
        else:
            bucket["overdue_hours"].append(_hours_between(task.due_at, task.completed_at))

    rows: list[EmployeeEfficiencyRow] = []
    for user_id, data in stats.items():
        count = data["completed_count"]
        completion_hours = data["completion_hours"]
        overdue_hours = data["overdue_hours"]
        avg_completion = sum(completion_hours) / len(completion_hours) if completion_hours else None
        avg_overdue = sum(overdue_hours) / len(overdue_hours) if overdue_hours else None
        on_time_percent = round(data["on_time_count"] / count * 100, 1) if count else None
        rows.append(
            EmployeeEfficiencyRow(
                user_id=user_id,
                full_name=data["full_name"],
                completed_count=count,
                avg_completion_hours=round(avg_completion, 2) if avg_completion is not None else None,
                on_time_count=data["on_time_count"],
                on_time_percent=on_time_percent,
                avg_overdue_hours=round(avg_overdue, 2) if avg_overdue is not None else None,
            )
        )

    rows.sort(key=lambda r: (-r.completed_count, r.full_name.lower()))
    return EmployeeEfficiencyReport(period_days=period_days, group_id=group_id, rows=rows)
