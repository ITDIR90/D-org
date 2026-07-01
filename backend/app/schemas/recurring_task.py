from datetime import datetime

from pydantic import BaseModel, ConfigDict

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
    due_days: int = 2


class RecurringTaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    default_assignee_id: int | None = None
    priority: TaskPriority | None = None
    schedule_type: ScheduleType | None = None
    cron_expression: str | None = None
    due_days: int | None = None


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
    due_days: int
    is_active: bool
    last_run_at: datetime | None
    next_run_at: datetime | None
    created_at: datetime
    updated_at: datetime
