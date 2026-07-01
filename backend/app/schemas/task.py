from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import TaskPriority, TaskStatus


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    target_group_id: int
    category_id: int
    due_at: datetime | None = None
    assignee_id: int | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    notify_before_minutes: int = Field(default=60, ge=0, le=10080)


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_at: datetime | None = None
    assignee_id: int | None = None
    priority: TaskPriority | None = None
    spent_hours: float | None = None
    status: TaskStatus | None = None
    notify_before_minutes: int | None = Field(default=None, ge=0, le=10080)


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    author_id: int
    author_group_id: int
    target_group_id: int
    category_id: int
    due_at: datetime
    notify_before_minutes: int
    assignee_id: int | None
    completed_at: datetime | None
    priority: TaskPriority
    status: TaskStatus
    spent_hours: float | None
    source_recurring_template_id: int | None
    cancelled_at: datetime | None
    cancelled_by_id: int | None
    created_at: datetime
    updated_at: datetime
    is_overdue: bool = False
    author_name: str | None = None
    assignee_name: str | None = None
    category_name: str | None = None
    target_group_name: str | None = None


class CommentCreate(BaseModel):
    text: str = Field(min_length=1)


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: str
    entity_id: int
    author_id: int
    text: str
    created_at: datetime
    updated_at: datetime
    author_name: str | None = None
