from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.enums import ProjectStatus, TaskPriority


class ProjectCreate(BaseModel):
    title: str
    description: str | None = None
    group_id: int
    responsible_id: int | None = None
    due_at: datetime | None = None
    priority: TaskPriority = TaskPriority.MEDIUM


class ProjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    responsible_id: int | None = None
    due_at: datetime | None = None
    priority: TaskPriority | None = None
    spent_hours: float | None = None
    status: ProjectStatus | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    group_id: int
    author_id: int
    responsible_id: int | None
    due_at: datetime | None
    completed_at: datetime | None
    priority: TaskPriority
    status: ProjectStatus
    spent_hours: float | None
    created_at: datetime
    updated_at: datetime
    group_name: str | None = None
    author_name: str | None = None


class SubtaskCreate(BaseModel):
    title: str
    description: str | None = None
    assignee_id: int | None = None
    due_at: datetime | None = None
    priority: TaskPriority = TaskPriority.MEDIUM


class SubtaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee_id: int | None = None
    due_at: datetime | None = None
    priority: TaskPriority | None = None
    spent_hours: float | None = None
    status: ProjectStatus | None = None


class SubtaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str | None
    author_id: int
    assignee_id: int | None
    due_at: datetime | None
    completed_at: datetime | None
    priority: TaskPriority
    status: ProjectStatus
    spent_hours: float | None
    created_at: datetime
    updated_at: datetime
    assignee_name: str | None = None
