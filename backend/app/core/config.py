from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        if not v:
            raise ValueError("SECRET_KEY must be set")
        if v == "change-me":
            # Can't access APP_ENV here easily, just warn
            raise ValueError("SECRET_KEY cannot be 'change-me'")
        return v

    @field_validator("DEFAULT_SUPERADMIN_PASSWORD")
    @classmethod
    def validate_superadmin_password(cls, v: str) -> str:
        if not v:
            raise ValueError("DEFAULT_SUPERADMIN_PASSWORD must be set")
        return v

    APP_NAME: str = "Digital-органайзер"
    APP_SHORT_NAME: str = "D-органайзер"
    APP_TAGLINE: str = "единый центр задач, проектов и коммуникаций"
    APP_ENV: str = "development"
    SECRET_KEY: str = ""
    JWT_EXPIRE_MINUTES: int = 30
    DATABASE_URL: str = "postgresql+asyncpg://helpdesk:helpdesk@db:5432/helpdesk"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True
    EMAIL_ENABLED: bool = False

    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""
    AI_PROVIDER: str = "auto"
    AI_ENABLED: bool = False
    AI_MODEL: str = ""

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_ENABLED: bool = False

    MAX_ENABLED: bool = False
    MAX_GATEWAY_URL: str = ""
    MAX_GATEWAY_TOKEN: str = ""

    PUSH_ENABLED: bool = True
    EXPO_ACCESS_TOKEN: str = ""

    DEFAULT_SUPERADMIN_EMAIL: str = "admin@example.com"
    DEFAULT_SUPERADMIN_PASSWORD: str = ""

    DUPLICATE_MESSAGE_WINDOW_SECONDS: int = 30
    DUPLICATE_TASK_WINDOW_SECONDS: int = 60

    INTEGRATION_API_ENABLED: bool = False
    INTEGRATION_API_KEY: str = ""
    INTEGRATION_USER_ID: int = 0

    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
