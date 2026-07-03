from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.device_token import DeviceTokenRegister, DeviceTokenUnregister
from app.schemas.notification import NotificationRead, NotificationTestResult
from app.services.notification_delivery import get_channels_status, send_test_notification
from app.services.push_service import register_device_token, unregister_device_token

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/channels")
async def notification_channels(user: User = Depends(get_current_user)):
    return get_channels_status()


@router.post("/test", response_model=NotificationTestResult)
async def test_notification(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await send_test_notification(db, user)


@router.post("/device-token")
async def register_push_token(
    data: DeviceTokenRegister,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await register_device_token(db, user.id, data.token, data.platform)
    return {"message": "Токен зарегистрирован"}


@router.post("/device-token/remove")
async def remove_push_token(
    data: DeviceTokenUnregister,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await unregister_device_token(db, user.id, data.token)
    return {"message": "Токен удалён"}


@router.get("", response_model=list[NotificationRead])
async def list_notifications(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(100)
    )
    return result.scalars().all()


@router.post("/{notification_id}/read")
async def mark_read(notification_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    n = await db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        return {"message": "Не найдено"}
    n.is_read = True
    return {"message": "Прочитано"}


@router.post("/read-all")
async def mark_all_read(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(Notification).where(Notification.user_id == user.id).values(is_read=True)
    )
    return {"message": "Все уведомления прочитаны"}
