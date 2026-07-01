from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Digital-органайзер"
    APP_SHORT_NAME: str = "D-органайзер"
    APP_TAGLINE: str = "единый центр задач, проектов и коммуникаций"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me"
    JWT_EXPIRE_MINUTES: int = 60
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
    AI_PROVIDER: str = "auto"  # auto | openai | gemini
    AI_ENABLED: bool = False  # начальное значение до сохранения в настройках супер-админа
    AI_MODEL: str = ""

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_ENABLED: bool = False

    DEFAULT_SUPERADMIN_EMAIL: str = "admin@example.com"
    DEFAULT_SUPERADMIN_PASSWORD: str = "admin12345"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
