from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.recurring_service import process_due_templates
from app.services.scheduled_notification_service import process_due_reminders, process_overdue_digests

scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(process_due_templates, "interval", minutes=1, id="recurring_tasks")
        scheduler.add_job(process_due_reminders, "interval", minutes=1, id="due_reminders")
        scheduler.add_job(process_overdue_digests, "interval", minutes=1, id="overdue_digests")
        scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
