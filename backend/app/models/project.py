from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ProjectStatus, TaskPriority, pg_enum
from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    responsible_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    priority: Mapped[TaskPriority] = mapped_column(
        pg_enum(TaskPriority, "project_priority", create_type=False), default=TaskPriority.MEDIUM
    )
    status: Mapped[ProjectStatus] = mapped_column(
        pg_enum(ProjectStatus, "project_status"), default=ProjectStatus.NEW
    )
    spent_hours: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    author: Mapped["User"] = relationship(foreign_keys=[author_id])
    responsible: Mapped["User | None"] = relationship(foreign_keys=[responsible_id])
    subtasks: Mapped[list["ProjectSubtask"]] = relationship(back_populates="project")


class ProjectSubtask(Base):
    __tablename__ = "project_subtasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    priority: Mapped[TaskPriority] = mapped_column(
        pg_enum(TaskPriority, "subtask_priority", create_type=False), default=TaskPriority.MEDIUM
    )
    status: Mapped[ProjectStatus] = mapped_column(
        pg_enum(ProjectStatus, "subtask_status", create_type=False), default=ProjectStatus.NEW
    )
    spent_hours: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="subtasks")
    author: Mapped["User"] = relationship(foreign_keys=[author_id])
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assignee_id])
