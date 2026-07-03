from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.enums import UserRole

UiThemeValue = Literal["light", "dark", "neon"]


class UserBase(BaseModel):
    last_name: str
    first_name: str
    middle_name: str | None = None
    nickname: str
    timezone: str = "Europe/Moscow"
    ui_theme: UiThemeValue = "light"
    email: EmailStr
    notify_via_email: bool = True
    notify_via_telegram: bool = False
    notify_via_push: bool = True
    telegram_chat_id: str | None = None
    role: UserRole = UserRole.USER


class UserCreate(UserBase):
    password: str = Field(min_length=6)
    member_group_ids: list[int] = []
    task_target_group_ids: list[int] = []


class UserUpdate(BaseModel):
    last_name: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    nickname: str | None = None
    timezone: str | None = None
    ui_theme: UiThemeValue | None = None
    email: EmailStr | None = None
    notify_via_email: bool | None = None
    notify_via_telegram: bool | None = None
    notify_via_push: bool | None = None
    telegram_chat_id: str | None = None
    role: UserRole | None = None
    member_group_ids: list[int] | None = None
    task_target_group_ids: list[int] | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=6)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    member_group_ids: list[int] = []
    admin_group_ids: list[int] = []
    task_target_group_ids: list[int] = []
    full_name: str = ""
