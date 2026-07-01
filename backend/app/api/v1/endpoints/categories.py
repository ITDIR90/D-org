from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import EntityType, UserActionType, UserRole
from app.core.permissions import can_manage_group, get_accessible_group_ids, get_creatable_group_ids
from app.db.session import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.services.audit_service import log_user_action

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    group_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Category).where(Category.is_active == True)
    if group_id:
        q = q.where(Category.group_id == group_id)
    elif user.role != UserRole.SUPERADMIN:
        ids = await get_creatable_group_ids(db, user)
        if not ids:
            return []
        q = q.where(Category.group_id.in_(ids))
    result = await db.execute(q.order_by(Category.name))
    return result.scalars().all()


@router.post("", response_model=CategoryRead)
async def create_category(
    request: Request,
    data: CategoryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_manage_group(db, user, data.group_id):
        raise HTTPException(status_code=403, detail="Нет прав")
    cat = Category(**data.model_dump())
    db.add(cat)
    await db.flush()
    await log_user_action(
        db, user.id, UserActionType.CATEGORY_CREATE, EntityType.CATEGORY, cat.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return cat


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cat = await db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    if not await can_manage_group(db, user, cat.group_id):
        raise HTTPException(status_code=403, detail="Нет прав")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, key, value)
    await log_user_action(
        db, user.id, UserActionType.CATEGORY_UPDATE, EntityType.CATEGORY, cat.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return cat
