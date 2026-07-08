from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import TaskPriority, TaskStatus, pg_enum
from app.db.base import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[int] = mapped_column(
        Integer,
        server_default=text("nextval('task_number_seq')"),
        unique=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    author_group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    target_group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notify_before_minutes: Mapped[int] = mapped_column(Integer, default=60)
    due_reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    priority: Mapped[TaskPriority] = mapped_column(
        pg_enum(TaskPriority, "task_priority"), default=TaskPriority.MEDIUM
    )
    status: Mapped[TaskStatus] = mapped_column(
        pg_enum(TaskStatus, "task_status"), default=TaskStatus.NEW
    )
    spent_hours: Mapped[float | None] = mapped_column(Float)
    source_recurring_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("recurring_task_templates.id")
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    author: Mapped["User"] = relationship(foreign_keys=[author_id])
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assignee_id])
    category: Mapped["Category"] = relationship()
    recurring_template: Mapped["RecurringTaskTemplate | None"] = relationship()
