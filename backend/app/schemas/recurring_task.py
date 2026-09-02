from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import ScheduleType, TaskPriority


class RecurringTaskCreate(BaseModel):
    title: str
    description: str | None = None
    target_group_id: int
    category_id: int
    default_assignee_id: int | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    schedule_type: ScheduleType
    cron_expression: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    interval: int = Field(default=1, ge=1, le=365)
    weekdays: list[int] | None = None
    month_days: list[int] | None = None
    run_at: str | None = None
    due_days: int = Field(default=2, ge=0, le=365)


class RecurringTaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    default_assignee_id: int | None = None
    priority: TaskPriority | None = None
    schedule_type: ScheduleType | None = None
    cron_expression: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    interval: int | None = Field(default=None, ge=1, le=365)
    weekdays: list[int] | None = None
    month_days: list[int] | None = None
    run_at: str | None = None
    due_days: int | None = Field(default=None, ge=0, le=365)


class RecurringTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    author_id: int
    target_group_id: int
    category_id: int
    default_assignee_id: int | None
    priority: TaskPriority
    schedule_type: ScheduleType
    cron_expression: str | None
    start_date: date | None
    end_date: date | None
    interval: int
    weekdays: list[int] | None
    month_days: list[int] | None
    run_at: str | None
    due_days: int
    is_active: bool
    last_run_at: datetime | None
    next_run_at: datetime | None
    created_at: datetime
    updated_at: datetime
