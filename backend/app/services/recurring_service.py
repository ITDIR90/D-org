from datetime import date, datetime, time, timedelta, timezone
from logging import getLogger
from zoneinfo import ZoneInfo

from croniter import croniter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ScheduleType, TaskStatus
from app.db.session import async_session
from app.models.recurring_task import RecurringTaskTemplate
from app.models.task import Task
from app.services.business_days import compute_default_due_at
from app.services.notification_service import notify_group_members_new_task

logger = getLogger(__name__)

# Внутренние расчёты расписания ведутся в часовом поясе Москвы (согласовано с due-датами).
_TZ = ZoneInfo("Europe/Moscow")


def _run_parts(run_at: str | None) -> tuple[int, int]:
    if not run_at:
        return 0, 0
    try:
        h, m = run_at.split(":")
        return int(h), int(m)
    except (ValueError, TypeError):
        return 0, 0


def _local(dt: datetime) -> datetime:
    return dt.astimezone(_TZ)


def _candidate_utc(d: date, h: int, m: int) -> datetime:
    return datetime(d.year, d.month, d.day, h, m, tzinfo=_TZ).astimezone(timezone.utc)


def _compute_constructor(
    template: RecurringTaskTemplate,
    after: datetime,
) -> datetime:
    """Вычисление следующей даты запуска для расписания-конструктора
    (daily/weekly/monthly). Аналог формы-конструктора из 1С."""
    interval = template.interval or 1
    if interval < 1:
        interval = 1
    h, m = _run_parts(template.run_at)
    after_local = _local(after)
    # Якорь для step-сетки: начало периода действия, если задано, иначе "сейчас".
    anchor = template.start_date or after_local.date()

    if template.schedule_type == ScheduleType.DAILY:
        # каждые N дней
        ref = anchor
        d = after_local.date() + timedelta(days=1)
        for _ in range(370 * interval + 370):
            if (d - ref).days % interval == 0:
                cand = _candidate_utc(d, h, m)
                if cand > after:
                    return cand
            d += timedelta(days=1)
        return after + timedelta(days=interval)

    if template.schedule_type == ScheduleType.WEEKLY:
        weekdays = template.weekdays or [after_local.weekday()]
        weekdays = {int(w) for w in weekdays if 0 <= int(w) <= 6}
        if not weekdays:
            weekdays = {after_local.weekday()}
        ref_monday = anchor - timedelta(days=anchor.weekday())
        d = after_local.date() + timedelta(days=1)
        for _ in range(370 * interval + 370):
            if d.weekday() in weekdays:
                week_monday = d - timedelta(days=d.weekday())
                week_diff = (week_monday - ref_monday).days // 7
                if week_diff >= 0 and week_diff % interval == 0:
                    cand = _candidate_utc(d, h, m)
                    if cand > after:
                        return cand
            d += timedelta(days=1)
        return after + timedelta(weeks=interval)

    # MONTHLY
    month_days = template.month_days or [anchor.day]
    month_days = {int(v) for v in month_days if 1 <= int(v) <= 31}
    if not month_days:
        month_days = {anchor.day}
    d = after_local.date() + timedelta(days=1)
    for _ in range(400 * interval + 400):
        if d.day in month_days:
            month_diff = (d.year - anchor.year) * 12 + (d.month - anchor.month)
            if month_diff >= 0 and month_diff % interval == 0:
                cand = _candidate_utc(d, h, m)
                if cand > after:
                    return cand
        d += timedelta(days=1)
    return after + timedelta(days=30)


def compute_next_run(template: RecurringTaskTemplate, from_dt: datetime | None = None) -> datetime:
    now = from_dt or datetime.now(timezone.utc)
    if template.schedule_type == ScheduleType.CRON and template.cron_expression:
        cron = croniter(template.cron_expression, now)
        return cron.get_next(datetime).astimezone(timezone.utc)
    return _compute_constructor(template, now)


def _is_active_now(template: RecurringTaskTemplate) -> bool:
    """Проверка периода действия шаблона (по московской локальной дате)."""
    now_local = _local(datetime.now(timezone.utc)).date()
    if template.start_date and now_local < template.start_date:
        return False
    if template.end_date and now_local > template.end_date:
        return False
    return True


async def create_task_from_template(db: AsyncSession, template: RecurringTaskTemplate) -> Task | None:
    if not template.is_active:
        return None
    now = datetime.now(timezone.utc)
    if not _is_active_now(template):
        # Период действия ещё не наступил или уже закончился.
        now_local = _local(now).date()
        if template.end_date and now_local > template.end_date:
            template.is_active = False
            logger.info("Recurring template #%s deactivated: end_date passed", template.id)
        elif template.start_date and now_local < template.start_date:
            # Период ещё не начался — сдвигаем следующий запуск, чтобы не обрабатывать
            # шаблон впустую каждую минуту.
            template.next_run_at = compute_next_run(template, now)
            logger.info("Recurring template #%s period not started, next run at %s",
                        template.id, template.next_run_at)
        return None

    due_at = compute_default_due_at(now, template.due_days or 2)
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

    logger.info(
        "Created task #%s from recurring template #%s (next run at %s)",
        task.id, template.id, template.next_run_at,
    )
    await notify_group_members_new_task(db, task, exclude_user_ids={template.author_id})
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
        if templates:
            logger.info(
                "Recurring scheduler processed %d template(s) at %s", len(templates), now,
            )
