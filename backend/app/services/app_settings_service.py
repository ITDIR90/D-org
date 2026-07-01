from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.app_setting import AppSetting

AI_ENABLED_KEY = "ai_enabled"


def _parse_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in ("true", "1", "yes")


async def get_setting(db: AsyncSession, key: str) -> str | None:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else None


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    await db.commit()


async def get_ai_enabled(db: AsyncSession) -> bool:
    stored = await get_setting(db, AI_ENABLED_KEY)
    if stored is None:
        return get_settings().AI_ENABLED
    return _parse_bool(stored)


async def set_ai_enabled(db: AsyncSession, enabled: bool) -> None:
    await set_setting(db, AI_ENABLED_KEY, "true" if enabled else "false")
