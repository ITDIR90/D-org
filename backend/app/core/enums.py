import enum
from typing import Type

from sqlalchemy import Enum as SAEnum


def pg_enum(enum_class: Type[enum.Enum], name: str, **kwargs) -> SAEnum:
    """PostgreSQL enum column that stores enum values, not member names."""
    return SAEnum(
        enum_class,
        name=name,
        values_callable=lambda x: [e.value for e in x],
        **kwargs,
    )


class UserRole(str, enum.Enum):
    SUPERADMIN = "superadmin"
    GROUP_ADMIN = "group_admin"
    USER = "user"
    REQUEST_ONLY = "request_only"


class UiTheme(str, enum.Enum):
    LIGHT = "light"
    DARK = "dark"
    NEON = "neon"


class TaskPriority(str, enum.Enum):
    MEDIUM = "medium"
    HIGH = "high"
    FERRARI = "ferrari"


class TaskStatus(str, enum.Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    WAITING_AUTHOR_CONFIRMATION = "waiting_author_confirmation"
    CANCELLED = "cancelled"
    DONE = "done"


class ProjectStatus(str, enum.Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    CANCELLED = "cancelled"
    DONE = "done"


class EntityType(str, enum.Enum):
    TASK = "task"
    PROJECT = "project"
    PROJECT_SUBTASK = "project_subtask"
    USER = "user"
    GROUP = "group"
    CATEGORY = "category"
    COMMENT = "comment"
    CHAT_MESSAGE = "chat_message"
    RECURRING_TASK = "recurring_task"
    NOTIFICATION = "notification"


class NotificationType(str, enum.Enum):
    ASSIGNED = "assigned"
    DUE_CHANGED = "due_changed"
    STATUS_CHANGED = "status_changed"
    TASK_COMPLETED = "task_completed"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    COMMENT_ADDED = "comment_added"
    TASK_CREATED = "task_created"
    SUBTASK_CREATED = "subtask_created"
    DUE_REMINDER = "due_reminder"
    OVERDUE_DIGEST = "overdue_digest"


class ScheduleType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CRON = "cron"


class UserActionType(str, enum.Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    TASK_CREATE = "task_create"
    TASK_UPDATE = "task_update"
    TASK_STATUS_CHANGE = "task_status_change"
    TASK_ASSIGNEE_CHANGE = "task_assignee_change"
    PROJECT_CREATE = "project_create"
    PROJECT_UPDATE = "project_update"
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DEACTIVATE = "user_deactivate"
    CATEGORY_CREATE = "category_create"
    CATEGORY_UPDATE = "category_update"
    GROUP_CREATE = "group_create"
    GROUP_UPDATE = "group_update"
    CHAT_MESSAGE = "chat_message"
    AI_MODERATION = "ai_moderation"
    EMAIL_SENT = "email_sent"
    EMAIL_ERROR = "email_error"
    TELEGRAM_SENT = "telegram_sent"
    TELEGRAM_ERROR = "telegram_error"
