from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import EntityType, UserActionType, UserRole
from app.core.permissions import can_manage_group, get_creatable_group_ids
from app.db.session import get_db
from app.models.group import Group
from app.models.user import User
from app.schemas.group import GroupCreate, GroupRead, GroupUpdate
from app.services.audit_service import log_user_action

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=list[GroupRead])
async def list_groups(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == UserRole.SUPERADMIN:
        result = await db.execute(select(Group).where(Group.is_active == True).order_by(Group.name))
    else:
        ids = await get_creatable_group_ids(db, user)
        if not ids:
            return []
        result = await db.execute(select(Group).where(Group.id.in_(ids), Group.is_active == True).order_by(Group.name))
    return result.scalars().all()


@router.post("", response_model=GroupRead)
async def create_group(
    request: Request,
    data: GroupCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Только супер-администратор может создавать группы")
    group = Group(name=data.name, description=data.description)
    db.add(group)
    await db.flush()
    await log_user_action(
        db, user.id, UserActionType.GROUP_CREATE, EntityType.GROUP, group.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return group


@router.patch("/{group_id}", response_model=GroupRead)
async def update_group(
    group_id: int,
    data: GroupUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if user.role != UserRole.SUPERADMIN and not await can_manage_group(db, user, group_id):
        raise HTTPException(status_code=403, detail="Нет прав")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(group, key, value)
    await log_user_action(
        db, user.id, UserActionType.GROUP_UPDATE, EntityType.GROUP, group.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return group
