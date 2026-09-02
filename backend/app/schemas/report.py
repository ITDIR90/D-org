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


class CompletedTaskReportRow(BaseModel):
    task_id: int
    number: int
    title: str
    completed_at: str  # ISO datetime (UTC)
    completed_day: str  # YYYY-MM-DD (localised grouping key)
    assignee_id: int | None
    assignee_name: str
    author_id: int | None
    author_name: str
    category_id: int
    category_name: str
    group_id: int
    group_name: str
    due_at: str | None
    priority: str | None


class CompletedTasksMatrixCell(BaseModel):
    day: str  # YYYY-MM-DD
    count: int
    task_ids: list[int] = Field(default_factory=list)


class CompletedTaskMatrixRow(BaseModel):
    row_id: int
    row_name: str
    total: int
    cells: list[CompletedTasksMatrixCell] = Field(default_factory=list)


class CompletedTasksReport(BaseModel):
    date_from: str
    date_to: str
    group_id: int | None = None
    user_id: int | None = None
    category_id: int | None = None
    group_by: str = "category"  # 'category' | 'user'
    total: int
    days: list[str] = Field(default_factory=list)  # все дни периода (YYYY-MM-DD)
    rows: list[CompletedTaskMatrixRow] = Field(default_factory=list)
    day_totals: list[int] = Field(default_factory=list)  # итог задач по каждому дню
    tasks: list[CompletedTaskReportRow] = Field(default_factory=list)  # детализация для popup
