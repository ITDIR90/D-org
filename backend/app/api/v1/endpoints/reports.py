from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.report import EmployeeEfficiencyReport
from app.services.report_service import get_employee_efficiency_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/employee-efficiency", response_model=EmployeeEfficiencyReport)
async def employee_efficiency(
    period_days: int = Query(default=30, ge=1, le=365),
    group_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_employee_efficiency_report(db, user, period_days=period_days, group_id=group_id)
