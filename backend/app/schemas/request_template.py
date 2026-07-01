from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import TaskPriority


class RequestTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    target_group_id: int
    category_id: int
    default_assignee_id: int | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    sort_order: int = 0


class RequestTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    target_group_id: int | None = None
    category_id: int | None = None
    default_assignee_id: int | None = None
    priority: TaskPriority | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class RequestTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    title: str
    description: str | None
    target_group_id: int
    category_id: int
    default_assignee_id: int | None
    priority: TaskPriority
    is_active: bool
    sort_order: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    group_name: str | None = None
    category_name: str | None = None
