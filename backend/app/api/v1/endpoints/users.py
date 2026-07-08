from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_superadmin
from app.core.enums import EntityType, UserActionType, UserRole
from app.core.permissions import can_manage_users, get_user_task_target_group_ids
from app.db.session import get_db
from app.models.user import User
from app.core.security import get_password_hash
from app.schemas.user import UserCreate, UserRead, UserUpdate, ResetPasswordRequest
from app.services.audit_service import log_user_action
from app.services.user_service import create_user_record, list_users_for_actor, resolve_role_groups, sync_user_groups, user_to_read

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
async def list_users(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    users = await list_users_for_actor(db, user)
    return [await user_to_read(db, u) for u in users]


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: int, actor: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if actor.role != UserRole.SUPERADMIN and actor.id != user_id:
        if not await can_manage_users(db, actor):
            raise HTTPException(status_code=403, detail="Нет доступа")
    return await user_to_read(db, target)


@router.post("", response_model=UserRead)
async def create_user(
    request: Request,
    data: UserCreate,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_manage_users(db, actor) and actor.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Нет прав создавать пользователей")
    if actor.role != UserRole.SUPERADMIN and data.role == UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Нельзя назначить роль супер-администратора")
    if actor.role == UserRole.GROUP_ADMIN and data.role == UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Нельзя назначить роль супер-администратора")
    user = await create_user_record(db, data)
    await log_user_action(
        db, actor.id, UserActionType.USER_CREATE, EntityType.USER, user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return await user_to_read(db, user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    data: UserUpdate,
    request: Request,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if actor.role != UserRole.SUPERADMIN and actor.id != user_id:
        if not await can_manage_users(db, actor):
            raise HTTPException(status_code=403, detail="Нет доступа")
    if actor.role != UserRole.SUPERADMIN and data.role == UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Нельзя назначить роль супер-администратора")
    update = data.model_dump(exclude_unset=True)
    if actor.id != user_id:
        for key in ("notify_via_email", "notify_via_telegram", "notify_via_push", "telegram_chat_id"):
            update.pop(key, None)
    can_manage = actor.role == UserRole.SUPERADMIN or await can_manage_users(db, actor)
    if not can_manage:
        update.pop("printer", None)
    for key in ("member_group_ids", "task_target_group_ids"):
        update.pop(key, None)
    for key, value in update.items():
        setattr(target, key, value)
    effective_role = target.role
    if data.member_group_ids is not None or data.task_target_group_ids is not None or data.role is not None:
        if effective_role == UserRole.REQUEST_ONLY:
            target_ids = data.task_target_group_ids
            if target_ids is None:
                target_ids = list(await get_user_task_target_group_ids(db, target.id))
            member_ids, target_ids = resolve_role_groups(effective_role, [], target_ids)
            await sync_user_groups(db, target, member_ids, target_ids)
        else:
            await sync_user_groups(db, target, data.member_group_ids, data.task_target_group_ids)
    await db.flush()
    await log_user_action(
        db, actor.id, UserActionType.USER_UPDATE, EntityType.USER, target.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return await user_to_read(db, target)


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    request: Request,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_manage_users(db, actor) and actor.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Нет прав")
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    target.is_active = False
    await log_user_action(
        db, actor.id, UserActionType.USER_DEACTIVATE, EntityType.USER, target.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": "Доступ закрыт"}


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: int,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if actor.role != UserRole.SUPERADMIN and not await can_manage_users(db, actor):
        raise HTTPException(status_code=403, detail="Нет прав")
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    target.is_active = True
    return {"message": "Доступ восстановлен"}


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    data: ResetPasswordRequest,
    request: Request,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if actor.role != UserRole.SUPERADMIN and actor.id != user_id:
        if not await can_manage_users(db, actor):
            raise HTTPException(status_code=403, detail="Нет прав сменить пароль")
    target.password_hash = get_password_hash(data.new_password)
    await log_user_action(
        db, actor.id, UserActionType.USER_UPDATE, EntityType.USER, target.id,
        details="Смена пароля",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": "Пароль изменён"}
