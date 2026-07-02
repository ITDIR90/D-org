from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import UserActionType
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from app.schemas.user import UserRead
from app.services.audit_service import log_user_action
from app.services.user_service import user_to_read

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.nickname == data.nickname))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный ник или пароль")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Доступ закрыт")
    token = create_access_token({"sub": str(user.id)})
    try:
        await log_user_action(
            db, user.id, UserActionType.LOGIN,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.flush()
    except Exception:
        await db.rollback()
    return TokenResponse(access_token=token)


@router.post("/logout")
async def logout(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await log_user_action(
        db, user.id, UserActionType.LOGOUT,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": "Выход выполнен"}


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await user_to_read(db, user)


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    user.password_hash = get_password_hash(data.new_password)
    await db.flush()
    return {"message": "Пароль изменён"}
