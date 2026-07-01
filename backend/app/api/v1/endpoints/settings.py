from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_superadmin
from app.db.session import get_db
from app.models.user import User
from app.schemas.settings import SystemSettingsResponse, SystemSettingsUpdate
from app.services import app_settings_service
from app.services.ai_service import get_ai_status

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SystemSettingsResponse)
async def get_system_settings(
    user: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    ai_enabled = await app_settings_service.get_ai_enabled(db)
    return SystemSettingsResponse(
        ai_enabled=ai_enabled,
        ai_status=await get_ai_status(db),
    )


@router.patch("", response_model=SystemSettingsResponse)
async def update_system_settings(
    body: SystemSettingsUpdate,
    user: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    await app_settings_service.set_ai_enabled(db, body.ai_enabled)
    return SystemSettingsResponse(
        ai_enabled=body.ai_enabled,
        ai_status=await get_ai_status(db),
    )
