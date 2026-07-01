from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.enums import EntityType, NotificationType


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    type: NotificationType
    title: str
    message: str
    entity_type: EntityType | None
    entity_id: int | None
    is_read: bool
    created_at: datetime


class NotificationTestResult(BaseModel):
    channels: dict
    user: dict
    delivery: dict
