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


class DirectChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    recipient_id: int
    text: str
    created_at: datetime
    updated_at: datetime
    sender_name: str | None = None


class ChatContactRead(BaseModel):
    id: int
    full_name: str


class DirectThreadRead(BaseModel):
    user_id: int
    full_name: str
    last_message_text: str
    last_message_at: datetime
    last_message_is_mine: bool
