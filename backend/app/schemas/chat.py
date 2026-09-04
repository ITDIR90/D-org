from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreate(BaseModel):
    text: str = Field(min_length=1)


class GroupChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    author_id: int
    text: str
    created_at: datetime
    updated_at: datetime
    author_name: str | None = None


class ChatContactRead(BaseModel):
    id: int
    full_name: str
