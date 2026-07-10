from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import TaskPriority, TaskStatus


class IntegrationRequestCreate(BaseModel):
    """Заявка из 1С."""

    external_id: str = Field(min_length=1, max_length=200, description="Уникальный ID документа в 1С")
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    target_group_id: int
    category_id: int
    due_at: datetime | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    contact_name: str | None = Field(default=None, max_length=200)
    contact_phone: str | None = Field(default=None, max_length=50)
    contact_email: str | None = Field(default=None, max_length=255)


class IntegrationRequestRead(BaseModel):
    id: int
    number: int
    external_id: str
    title: str
    status: TaskStatus
    created_at: datetime
    already_exists: bool = False
