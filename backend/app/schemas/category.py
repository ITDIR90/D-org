from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryCreate(BaseModel):
    group_id: int
    name: str
    default_due_days: int | None = None
    requires_author_confirmation: bool = False


class CategoryUpdate(BaseModel):
    name: str | None = None
    default_due_days: int | None = None
    requires_author_confirmation: bool | None = None
    is_active: bool | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    name: str
    default_due_days: int | None
    requires_author_confirmation: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
