from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import EntityType, NotificationType, TaskPriority, TaskStatus, UserActionType, UserRole
from app.core.permissions import (
    can_archive_task,
    can_create_task_in_group,
    can_view_task,
    get_accessible_group_ids,
    get_user_admin_group_ids,
    get_user_member_group_ids,
    is_admin_user,
    is_group_admin,
    is_request_only,
)
from app.models.category import Category
from app.models.group import Group
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.ai_service import ModerationError, process_fields
from app.services.audit_service import log_field_changes, log_task_change, log_user_action
from app.services.duplicate_message_service import DuplicateTaskError, assert_task_not_duplicate
from app.services.notification_service import create_notification, notify_group_members_new_task


def enrich_task(task: Task) -> TaskRead:
    now = datetime.now(timezone.utc)
    is_overdue = (
        task.status not in (TaskStatus.DONE, TaskStatus.CANCELLED, TaskStatus.ARCHIVED)
        and task.due_at.replace(tzinfo=timezone.utc) < now
    )
    data = TaskRead.model_validate(task)
    data.is_overdue = is_overdue
    if task.author:
        data.author_name = task.author.full_name
    if task.assignee:
        data.assignee_name = task.assignee.full_name
    if task.category:
        data.category_name = task.category.name
    return data


async def list_tasks_query(db: AsyncSession, user: User, **filters):
    q = select(Task).options(
        selectinload(Task.author),
        selectinload(Task.assignee),
        selectinload(Task.category),
    )
    if user.role != UserRole.SUPERADMIN:
        if is_request_only(user):
            q = q.where(Task.author_id == user.id)
        else:
            accessible = await get_accessible_group_ids(db, user)
            q = q.where(
                or_(
                    Task.target_group_id.in_(accessible),
                    Task.author_id == user.id,
                )
            )
    if filters.get("my_tasks"):
        q = q.where(Task.assignee_id == user.id)
    if filters.get("created_by_me"):
        q = q.where(Task.author_id == user.id)
    if filters.get("unassigned"):
        q = q.where(Task.status == TaskStatus.NEW)
    if filters.get("overdue"):
        now = datetime.now(timezone.utc)
        q = q.where(
            Task.due_at < now,
            Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED, TaskStatus.ARCHIVED]),
        )
    if filters.get("awaiting_confirmation"):
        q = q.where(Task.status == TaskStatus.WAITING_AUTHOR_CONFIRMATION, Task.author_id == user.id)
    if filters.get("group_id"):
        q = q.where(Task.target_group_id == filters["group_id"])
    if filters.get("my_group"):
        accessible = await get_accessible_group_ids(db, user)
        if accessible:
            q = q.where(Task.target_group_id.in_(accessible))
    if filters.get("archived"):
        if not is_admin_user(user):
            raise HTTPException(status_code=403, detail="Архив доступен только администраторам")
        q = q.where(Task.status == TaskStatus.ARCHIVED)
        if user.role == UserRole.GROUP_ADMIN:
            admin_groups = await get_user_admin_group_ids(db, user)
            if admin_groups:
                q = q.where(Task.target_group_id.in_(admin_groups))
            else:
                q = q.where(Task.id == -1)
    elif filters.get("status"):
        q = q.where(Task.status == filters["status"])
    else:
        q = q.where(Task.status != TaskStatus.ARCHIVED)
    if filters.get("active_only"):
        q = q.where(
            Task.status.notin_([
                TaskStatus.DONE,
                TaskStatus.CANCELLED,
                TaskStatus.ARCHIVED,
            ])
        )
    result = await db.execute(q.order_by(Task.created_at.desc()))
    return result.scalars().all()


async def get_user_task_target_group_ids(db, user_id):
    from app.core.permissions import get_user_task_target_group_ids as _get
    return await _get(db, user_id)


async def get_task_or_404(db: AsyncSession, task_id: int) -> Task:
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.author), selectinload(Task.assignee), selectinload(Task.category))
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return task


async def validate_task_assignee(db: AsyncSession, assignee_id: int, group_id: int) -> User:
    assignee = await db.get(User, assignee_id)
    if not assignee or not assignee.is_active:
        raise HTTPException(status_code=400, detail="Ответственный не найден")
    member_groups = await get_user_member_group_ids(db, assignee_id)
    if group_id not in member_groups:
        raise HTTPException(
            status_code=400,
            detail="Ответственный должен состоять в группе-исполнителе",
        )
    return assignee


async def task_to_read(db: AsyncSession, task_id: int) -> TaskRead:
    task = await get_task_or_404(db, task_id)
    return enrich_task(task)


async def create_task(
    db: AsyncSession,
    user: User,
    data: TaskCreate,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[Task, bool]:
    if not await can_create_task_in_group(db, user, data.target_group_id):
        raise HTTPException(status_code=403, detail="Нет прав создать задачу в этой группе")

    try:
        await assert_task_not_duplicate(
            db,
            user.id,
            data.title,
            data.target_group_id,
            category_id=data.category_id,
        )
    except DuplicateTaskError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e

    cat_result = await db.execute(select(Category).where(Category.id == data.category_id))
    category = cat_result.scalar_one_or_none()
    if not category or category.group_id != data.target_group_id:
        raise HTTPException(status_code=400, detail="Категория не принадлежит группе")

    fields = {"title": data.title}
    if data.description:
        fields["description"] = data.description
    try:
        processed, ai_corrected = await process_fields(db, user.id, fields, ip_address, user_agent)
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    now = datetime.now(timezone.utc)
    if data.due_at:
        due_at = data.due_at
    elif category.default_due_days:
        due_at = now + timedelta(days=category.default_due_days)
    else:
        due_at = now + timedelta(days=2)

    if data.assignee_id:
        if user.role != UserRole.SUPERADMIN and not await is_group_admin(db, user, data.target_group_id):
            raise HTTPException(status_code=403, detail="Только администратор может назначить ответственного")
        await validate_task_assignee(db, data.assignee_id, data.target_group_id)

    member_groups = await get_user_member_group_ids(db, user.id)
    author_group_id = data.target_group_id
    if member_groups:
        author_group_id = next(iter(member_groups))

    task = Task(
        title=processed["title"],
        description=processed.get("description"),
        author_id=user.id,
        author_group_id=author_group_id,
        target_group_id=data.target_group_id,
        category_id=data.category_id,
        due_at=due_at,
        notify_before_minutes=data.notify_before_minutes,
        assignee_id=data.assignee_id,
        priority=data.priority,
        status=TaskStatus.NEW,
    )
    db.add(task)
    await db.flush()
    await notify_group_members_new_task(db, task, exclude_user_ids={user.id})
    await log_user_action(
        db, user.id, UserActionType.TASK_CREATE, EntityType.TASK, task.id, ip_address=ip_address, user_agent=user_agent
    )
    return task, ai_corrected


async def update_task(
    db: AsyncSession,
    user: User,
    task: Task,
    data: TaskUpdate,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[Task, bool]:
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа к задаче")

    can_edit = (
        user.role == UserRole.SUPERADMIN
        or task.author_id == user.id
        or task.assignee_id == user.id
        or await is_group_admin(db, user, task.target_group_id)
    )
    if not can_edit:
        raise HTTPException(status_code=403, detail="Нет прав изменить задачу")

    update_data = data.model_dump(exclude_unset=True)
    ai_corrected = False
    text_fields = {}
    if "title" in update_data:
        text_fields["title"] = update_data.pop("title")
    if "description" in update_data:
        text_fields["description"] = update_data.pop("description")
    if text_fields:
        try:
            processed, ai_corrected = await process_fields(db, user.id, text_fields, ip_address, user_agent)
            update_data.update(processed)
        except ModerationError as e:
            raise HTTPException(status_code=400, detail=str(e))

    old_assignee = task.assignee_id
    if "assignee_id" in update_data and update_data["assignee_id"] != old_assignee:
        if user.role != UserRole.SUPERADMIN and not await is_group_admin(db, user, task.target_group_id):
            raise HTTPException(status_code=403, detail="Только администратор может назначить ответственного")
        if update_data["assignee_id"]:
            await validate_task_assignee(db, update_data["assignee_id"], task.target_group_id)

    old_due = task.due_at
    old_status = task.status
    old_notify_before = task.notify_before_minutes

    if "status" in update_data and update_data["status"] == TaskStatus.ARCHIVED:
        if not await can_archive_task(db, user, task):
            raise HTTPException(status_code=403, detail="Нет прав отправить задачу в архив")

    tracked = ["due_at", "assignee_id", "priority", "status", "spent_hours", "notify_before_minutes"]
    await log_field_changes(db, EntityType.TASK, task.id, task, update_data, tracked, user.id)

    for key, value in update_data.items():
        setattr(task, key, value)

    if (
        ("due_at" in update_data and update_data["due_at"] != old_due)
        or ("notify_before_minutes" in update_data and update_data["notify_before_minutes"] != old_notify_before)
        or ("assignee_id" in update_data and update_data["assignee_id"] != old_assignee)
    ):
        task.due_reminder_sent_at = None

    if "assignee_id" in update_data and update_data["assignee_id"] != old_assignee and update_data["assignee_id"]:
        assignee = await db.get(User, update_data["assignee_id"])
        if assignee:
            await create_notification(
                db, assignee.id, NotificationType.ASSIGNED,
                "Назначение ответственным",
                f"Вам назначена задача: {task.title}",
                EntityType.TASK, task.id, assignee,
            )
    if "due_at" in update_data and update_data["due_at"] != old_due and task.assignee_id:
        assignee = await db.get(User, task.assignee_id)
        if assignee:
            await create_notification(
                db, assignee.id, NotificationType.DUE_CHANGED,
                "Изменён срок задачи",
                f"Срок задачи «{task.title}» изменён",
                EntityType.TASK, task.id, assignee,
            )
    if "status" in update_data and update_data["status"] != old_status:
        await log_user_action(
            db, user.id, UserActionType.TASK_STATUS_CHANGE, EntityType.TASK, task.id,
            details=f"{old_status} -> {update_data['status']}", ip_address=ip_address, user_agent=user_agent,
        )

    await db.flush()
    await log_user_action(db, user.id, UserActionType.TASK_UPDATE, EntityType.TASK, task.id, ip_address=ip_address, user_agent=user_agent)
    return task, ai_corrected


async def take_task(db: AsyncSession, user: User, task: Task) -> Task:
    if not await can_view_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет доступа")
    member = await get_user_member_group_ids(db, user.id)
    if task.target_group_id not in member and user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Вы не состоите в группе-исполнителе")
    if task.status not in (TaskStatus.NEW, TaskStatus.IN_PROGRESS):
        raise HTTPException(status_code=400, detail="Задачу нельзя взять в работу")
    old_assignee = task.assignee_id
    old_status = task.status
    task.assignee_id = user.id
    task.status = TaskStatus.IN_PROGRESS
    await log_task_change(db, EntityType.TASK, task.id, "assignee_id", old_assignee, user.id, user.id)
    await log_task_change(db, EntityType.TASK, task.id, "status", old_status, TaskStatus.IN_PROGRESS, user.id)
    await db.flush()
    return task


async def complete_task(db: AsyncSession, user: User, task: Task) -> Task:
    if task.assignee_id != user.id and user.role != UserRole.SUPERADMIN:
        if not await is_group_admin(db, user, task.target_group_id):
            raise HTTPException(status_code=403, detail="Нет прав выполнить задачу")
    cat = await db.get(Category, task.category_id)
    old_status = task.status
    if cat and cat.requires_author_confirmation:
        task.status = TaskStatus.WAITING_AUTHOR_CONFIRMATION
        author = await db.get(User, task.author_id)
        if author:
            await create_notification(
                db, author.id, NotificationType.AWAITING_CONFIRMATION,
                "Ожидает подтверждения",
                f"Задача «{task.title}» ожидает вашего подтверждения",
                EntityType.TASK, task.id, author,
            )
    else:
        task.status = TaskStatus.DONE
        task.completed_at = datetime.now(timezone.utc)
        author = await db.get(User, task.author_id)
        if author:
            await create_notification(
                db, author.id, NotificationType.TASK_COMPLETED,
                "Задача выполнена",
                f"Задача «{task.title}» выполнена",
                EntityType.TASK, task.id, author,
            )
    await log_task_change(db, EntityType.TASK, task.id, "status", old_status, task.status, user.id)
    await db.flush()
    return task


async def confirm_task(db: AsyncSession, user: User, task: Task) -> Task:
    if task.author_id != user.id and user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Только автор может подтвердить")
    if task.status != TaskStatus.WAITING_AUTHOR_CONFIRMATION:
        raise HTTPException(status_code=400, detail="Задача не ожидает подтверждения")
    task.status = TaskStatus.DONE
    task.completed_at = datetime.now(timezone.utc)
    await log_task_change(db, EntityType.TASK, task.id, "status", TaskStatus.WAITING_AUTHOR_CONFIRMATION, TaskStatus.DONE, user.id)
    await log_task_change(db, EntityType.TASK, task.id, "completed_at", None, task.completed_at, user.id)
    await db.flush()
    return task


async def cancel_task(db: AsyncSession, user: User, task: Task) -> Task:
    can_cancel = (
        user.role == UserRole.SUPERADMIN
        or task.author_id == user.id
        or await is_group_admin(db, user, task.target_group_id)
    )
    if not can_cancel:
        raise HTTPException(status_code=403, detail="Нет прав отменить задачу")
    old_status = task.status
    task.status = TaskStatus.CANCELLED
    task.cancelled_at = datetime.now(timezone.utc)
    task.cancelled_by_id = user.id
    await log_task_change(db, EntityType.TASK, task.id, "status", old_status, TaskStatus.CANCELLED, user.id)
    await db.flush()
    return task


async def archive_task(db: AsyncSession, user: User, task: Task) -> Task:
    if not await can_archive_task(db, user, task):
        raise HTTPException(status_code=403, detail="Нет прав отправить задачу в архив")
    if task.status == TaskStatus.ARCHIVED:
        raise HTTPException(status_code=400, detail="Задача уже в архиве")
    old_status = task.status
    task.status = TaskStatus.ARCHIVED
    await log_task_change(db, EntityType.TASK, task.id, "status", old_status, TaskStatus.ARCHIVED, user.id)
    await db.flush()
    return task


def sort_tasks_for_infopanel(tasks: list[Task]) -> list[Task]:
    priority_rank = {
        TaskPriority.FERRARI: 0,
        TaskPriority.HIGH: 1,
        TaskPriority.MEDIUM: 2,
    }

    def sort_key(task: Task):
        overdue = enrich_task(task).is_overdue
        return (
            0 if overdue else 1,
            priority_rank.get(task.priority, 9),
            task.due_at,
            -task.id,
        )

    return sorted(tasks, key=sort_key)


INFOPANEL_GROUP_ID = 1


async def list_infopanel_tasks(db: AsyncSession, group_id: int = INFOPANEL_GROUP_ID) -> list[Task]:
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.author),
            selectinload(Task.assignee),
            selectinload(Task.category),
        )
        .where(
            Task.target_group_id == group_id,
            Task.status.notin_([
                TaskStatus.DONE,
                TaskStatus.CANCELLED,
                TaskStatus.ARCHIVED,
            ]),
        )
        .order_by(Task.created_at.desc())
    )
    return list(result.scalars().all())
