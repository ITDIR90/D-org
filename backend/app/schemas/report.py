from pydantic import BaseModel, Field


class EmployeeEfficiencyRow(BaseModel):
    user_id: int
    full_name: str
    completed_count: int
    avg_completion_hours: float | None = None
    on_time_count: int = 0
    on_time_percent: float | None = None
    avg_overdue_hours: float | None = None


class EmployeeEfficiencyReport(BaseModel):
    period_days: int
    group_id: int | None = None
    rows: list[EmployeeEfficiencyRow] = Field(default_factory=list)
