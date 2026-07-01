from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    data: T | None = None
    message: str | None = None
    ai_corrected: bool = False


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int


class MessageResponse(BaseModel):
    message: str
    ai_corrected: bool = False
