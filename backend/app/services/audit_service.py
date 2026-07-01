from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import EntityType, UserActionType
from app.models.logs import TaskChangeLog, UserActionLog


async def log_task_change(
    db: AsyncSession,
    entity_type: EntityType,
    entity_id: int,
    field_name: str,
    old_value,
    new_value,
    changed_by_id: int,
) -> None:
    log = TaskChangeLog(
        entity_type=entity_type,
        entity_id=entity_id,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        changed_by_id=changed_by_id,
    )
    db.add(log)


async def log_user_action(
    db: AsyncSession,
    user_id: int | None,
    action: UserActionType,
    entity_type: EntityType | None = None,
    entity_id: int | None = None,
    details: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    log = UserActionLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)


async def log_field_changes(
    db: AsyncSession,
    entity_type: EntityType,
    entity_id: int,
    old_obj,
    new_data: dict,
    tracked_fields: list[str],
    changed_by_id: int,
) -> None:
    for field in tracked_fields:
        if field in new_data:
            old_val = getattr(old_obj, field, None)
            new_val = new_data[field]
            if str(old_val) != str(new_val):
                await log_task_change(db, entity_type, entity_id, field, old_val, new_val, changed_by_id)
