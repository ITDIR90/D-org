from pydantic import BaseModel


class AiStatus(BaseModel):
    enabled: bool
    ready: bool
    provider: str
    key_hint: str
    reason: str | None = None
    model: str | None = None
    base_url: str | None = None
    moderation: bool | None = None
    fail_open: bool | None = None


class SystemSettingsResponse(BaseModel):
    ai_enabled: bool
    ai_status: AiStatus


class SystemSettingsUpdate(BaseModel):
    ai_enabled: bool
