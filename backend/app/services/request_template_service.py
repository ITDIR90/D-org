from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category


async def validate_template_groups(
    db: AsyncSession,
    target_group_id: int,
    category_id: int,
) -> Category:
    category = await db.get(Category, category_id)
    if not category or not category.is_active:
        raise HTTPException(status_code=400, detail="Категория не найдена")
    if category.group_id != target_group_id:
        raise HTTPException(status_code=400, detail="Категория не относится к выбранной группе")
    return category
