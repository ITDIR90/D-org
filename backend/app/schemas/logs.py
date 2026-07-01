from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.enums import EntityType, UserActionType


class TaskChangeLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: EntityType
    entity_id: int
    field_name: str
    old_value: str | None
    new_value: str | None
    changed_by_id: int
    changed_at: datetime
    changed_by_name: str | None = None


class UserActionLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    action: UserActionType
    entity_type: EntityType | None
    entity_id: int | None
    details: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    user_name: str | None = None
