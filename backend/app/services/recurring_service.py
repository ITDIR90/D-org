from datetime import datetime, timedelta, timezone

from croniter import croniter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ScheduleType, TaskStatus
from app.db.session import async_session
from app.models.recurring_task import RecurringTaskTemplate
from app.models.task import Task


def compute_next_run(template: RecurringTaskTemplate, from_dt: datetime | None = None) -> datetime:
    now = from_dt or datetime.now(timezone.utc)
    if template.schedule_type == ScheduleType.DAILY:
        return now + timedelta(days=1)
    if template.schedule_type == ScheduleType.WEEKLY:
        return now + timedelta(weeks=1)
    if template.schedule_type == ScheduleType.MONTHLY:
        return now + timedelta(days=30)
    if template.schedule_type == ScheduleType.CRON and template.cron_expression:
        cron = croniter(template.cron_expression, now)
        return cron.get_next(datetime).replace(tzinfo=timezone.utc)
    return now + timedelta(days=1)


async def create_task_from_template(db: AsyncSession, template: RecurringTaskTemplate) -> Task | None:
    if not template.is_active:
        return None
    now = datetime.now(timezone.utc)
    due_at = now + timedelta(days=template.due_days or 2)
    task = Task(
        title=template.title,
        description=template.description,
        author_id=template.author_id,
        author_group_id=template.target_group_id,
        target_group_id=template.target_group_id,
        category_id=template.category_id,
        due_at=due_at,
        assignee_id=template.default_assignee_id,
        priority=template.priority,
        status=TaskStatus.NEW,
        source_recurring_template_id=template.id,
    )
    db.add(task)
    template.last_run_at = now
    template.next_run_at = compute_next_run(template, now)
    await db.flush()
    return task


async def process_due_templates() -> None:
    async with async_session() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(RecurringTaskTemplate).where(
                RecurringTaskTemplate.is_active == True,
                RecurringTaskTemplate.next_run_at <= now,
            )
        )
        templates = result.scalars().all()
        for template in templates:
            await create_task_from_template(db, template)
        await db.commit()
