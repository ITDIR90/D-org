from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TaskAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime
    uploaded_by_name: str | None = None
    url: str | None = None
