from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import ScheduleType, TaskPriority, pg_enum
from app.db.base import Base


class RecurringTaskTemplate(Base):
    __tablename__ = "recurring_task_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    target_group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    default_assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    priority: Mapped[TaskPriority] = mapped_column(
        pg_enum(TaskPriority, "recurring_priority", create_type=False), default=TaskPriority.MEDIUM
    )
    schedule_type: Mapped[ScheduleType] = mapped_column(pg_enum(ScheduleType, "schedule_type"))
    cron_expression: Mapped[str | None] = mapped_column(String(100))
    due_days: Mapped[int] = mapped_column(Integer, default=2)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
