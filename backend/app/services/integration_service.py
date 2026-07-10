from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import EntityType, NotificationType, TaskStatus, UserActionType
from app.core.permissions import can_create_task_in_group, get_user_member_group_ids
from app.models.category import Category
from app.models.task import Task
from app.models.user import User
from app.schemas.integration import IntegrationRequestCreate, IntegrationRequestRead

EXTERNAL_SOURCE = "onec"


def _build_description(data: IntegrationRequestCreate) -> str | None:
    lines: list[str] = []
    if data.description:
        lines.append(data.description.strip())
    contact_lines: list[str] = []
    if data.contact_name:
        contact_lines.append(f"Контакт: {data.contact_name}")
    if data.contact_phone:
        contact_lines.append(f"Телефон: {data.contact_phone}")
    if data.contact_email:
        contact_lines.append(f"Email: {data.contact_email}")
    if contact_lines:
        lines.append("\n".join(contact_lines))
    if not lines:
        return None
    return "\n\n".join(lines)


async def get_integration_user(db: AsyncSession) -> User:
    settings = get_settings()
    if not settings.INTEGRATION_USER_ID:
        raise HTTPException(status_code=503, detail="INTEGRATION_USER_ID не настроен на сервере")
    user = await db.get(User, settings.INTEGRATION_USER_ID)
    if not user or not user.is_active:
        raise HTTPException(status_code=503, detail="Пользователь интеграции не найден или неактивен")
    return user


async def find_task_by_external_id(db: AsyncSession, external_id: str) -> Task | None:
    result = await db.execute(
        select(Task).where(
            Task.external_source == EXTERNAL_SOURCE,
            Task.external_id == external_id,
        )
    )
    return result.scalar_one_or_none()


async def create_integration_request(
    db: AsyncSession,
    data: IntegrationRequestCreate,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> IntegrationRequestRead:
    existing = await find_task_by_external_id(db, data.external_id)
    if existing:
        return IntegrationRequestRead(
            id=existing.id,
            number=existing.number,
            external_id=existing.external_id or data.external_id,
            title=existing.title,
            status=existing.status,
            created_at=existing.created_at,
            already_exists=True,
        )

    user = await get_integration_user(db)
    if not await can_create_task_in_group(db, user, data.target_group_id):
        raise HTTPException(
            status_code=403,
            detail="Пользователь интеграции не может создавать заявки в указанной группе",
        )

    cat_result = await db.execute(select(Category).where(Category.id == data.category_id))
    category = cat_result.scalar_one_or_none()
    if not category or category.group_id != data.target_group_id:
        raise HTTPException(status_code=400, detail="Категория не принадлежит группе")

    now = datetime.now(timezone.utc)
    if data.due_at:
        due_at = data.due_at
    elif category.default_due_days:
        due_at = now + timedelta(days=category.default_due_days)
    else:
        due_at = now + timedelta(days=2)

    member_groups = await get_user_member_group_ids(db, user.id)
    author_group_id = data.target_group_id
    if member_groups:
        author_group_id = next(iter(member_groups))

    task = Task(
        title=data.title,
        description=_build_description(data),
        author_id=user.id,
        author_group_id=author_group_id,
        target_group_id=data.target_group_id,
        category_id=data.category_id,
        due_at=due_at,
        notify_before_minutes=60,
        assignee_id=None,
        priority=data.priority,
        status=TaskStatus.NEW,
        external_source=EXTERNAL_SOURCE,
        external_id=data.external_id,
    )
    db.add(task)
    await db.flush()

    from app.services.audit_service import log_user_action

    await log_user_action(
        db,
        user.id,
        UserActionType.TASK_CREATE,
        EntityType.TASK,
        task.id,
        details=f"Интеграция 1С: {data.external_id}",
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return IntegrationRequestRead(
        id=task.id,
        number=task.number,
        external_id=task.external_id or data.external_id,
        title=task.title,
        status=task.status,
        created_at=task.created_at,
        already_exists=False,
    )
