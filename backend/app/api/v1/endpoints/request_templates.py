from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import UserRole
from app.core.permissions import can_manage_group, get_creatable_group_ids
from app.db.session import get_db
from app.models.category import Category
from app.models.group import Group
from app.models.request_template import RequestTemplate
from app.models.user import User
from app.schemas.request_template import RequestTemplateCreate, RequestTemplateRead, RequestTemplateUpdate
from app.services.ai_service import ModerationError, process_fields
from app.services.request_template_service import validate_template_groups

router = APIRouter(prefix="/request-templates", tags=["request-templates"])


async def _enrich_list(db: AsyncSession, templates: list[RequestTemplate]) -> list[RequestTemplateRead]:
    if not templates:
        return []
    group_ids = {t.target_group_id for t in templates}
    category_ids = {t.category_id for t in templates}
    groups = {
        g.id: g.name
        for g in (await db.execute(select(Group).where(Group.id.in_(group_ids)))).scalars().all()
    }
    categories = {
        c.id: c.name
        for c in (await db.execute(select(Category).where(Category.id.in_(category_ids)))).scalars().all()
    }
    result = []
    for t in templates:
        data = RequestTemplateRead.model_validate(t)
        data.group_name = groups.get(t.target_group_id)
        data.category_name = categories.get(t.category_id)
        result.append(data)
    return result


@router.get("", response_model=list[RequestTemplateRead])
async def list_request_templates(
    include_inactive: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(RequestTemplate).order_by(RequestTemplate.sort_order, RequestTemplate.name)
    if not include_inactive:
        q = q.where(RequestTemplate.is_active == True)
    if user.role != UserRole.SUPERADMIN:
        ids = await get_creatable_group_ids(db, user)
        if not ids:
            return []
        q = q.where(RequestTemplate.target_group_id.in_(ids))
    result = await db.execute(q)
    return await _enrich_list(db, list(result.scalars().all()))


@router.post("", response_model=RequestTemplateRead)
async def create_request_template(
    request: Request,
    data: RequestTemplateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_manage_group(db, user, data.target_group_id):
        raise HTTPException(status_code=403, detail="Нет прав создавать шаблоны в этой группе")
    await validate_template_groups(db, data.target_group_id, data.category_id)
    fields = {"name": data.name, "title": data.title}
    if data.description:
        fields["description"] = data.description
    try:
        processed, _ = await process_fields(
            db,
            user.id,
            fields,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    template = RequestTemplate(
        name=processed["name"],
        title=processed["title"],
        description=processed.get("description"),
        target_group_id=data.target_group_id,
        category_id=data.category_id,
        default_assignee_id=data.default_assignee_id,
        priority=data.priority,
        sort_order=data.sort_order,
        created_by_id=user.id,
    )
    db.add(template)
    await db.flush()
    enriched = await _enrich_list(db, [template])
    return enriched[0]


@router.patch("/{template_id}", response_model=RequestTemplateRead)
async def update_request_template(
    template_id: int,
    data: RequestTemplateUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await db.get(RequestTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    if not await can_manage_group(db, user, template.target_group_id):
        raise HTTPException(status_code=403, detail="Нет прав")
    update = data.model_dump(exclude_unset=True)
    target_group_id = update.get("target_group_id", template.target_group_id)
    category_id = update.get("category_id", template.category_id)
    if "target_group_id" in update or "category_id" in update:
        await validate_template_groups(db, target_group_id, category_id)
    text_fields = {
        k: update[k]
        for k in ("name", "title", "description")
        if k in update and update[k]
    }
    if text_fields:
        try:
            processed, _ = await process_fields(
                db,
                user.id,
                text_fields,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
            update.update(processed)
        except ModerationError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    for key, value in update.items():
        setattr(template, key, value)
    await db.flush()
    enriched = await _enrich_list(db, [template])
    return enriched[0]


@router.post("/{template_id}/activate", response_model=RequestTemplateRead)
async def activate_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await db.get(RequestTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    if not await can_manage_group(db, user, template.target_group_id):
        raise HTTPException(status_code=403, detail="Нет прав")
    template.is_active = True
    enriched = await _enrich_list(db, [template])
    return enriched[0]


@router.post("/{template_id}/deactivate", response_model=RequestTemplateRead)
async def deactivate_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await db.get(RequestTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    if not await can_manage_group(db, user, template.target_group_id):
        raise HTTPException(status_code=403, detail="Нет прав")
    template.is_active = False
    enriched = await _enrich_list(db, [template])
    return enriched[0]
