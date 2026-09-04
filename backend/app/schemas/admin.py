from datetime import datetime

from pydantic import BaseModel


class MediaItemRead(BaseModel):
    id: int
    task_id: int
    task_number: int | None = None
    task_title: str | None = None
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime
    uploaded_by_name: str | None = None
    url: str | None = None


class MediaStatsRead(BaseModel):
    total_count: int
    total_bytes: int
    orphan_files: int
    orphan_files_bytes: int
    orphan_records: int


class MediaCleanupResult(BaseModel):
    deleted_records: int
    freed_bytes: int


class DbStatsRead(BaseModel):
    database_name: str
    total_bytes: int
    tables_count: int
    rows_total: int


class OrphanFileRead(BaseModel):
    stored_name: str
    size_bytes: int


class ArchivedTaskRead(BaseModel):
    id: int
    number: int
    title: str
    category_name: str | None = None
    target_group_name: str | None = None
    author_name: str | None = None
    assignee_name: str | None = None
    updated_at: datetime | None = None
    attachments_count: int
    comments_count: int
    change_logs_count: int
    notifications_count: int
    total_bytes: int
    total_related: int


class ArchivedTasksSummary(BaseModel):
    count: int
    total_bytes: int
    total_related: int


class PurgeResult(BaseModel):
    purged_tasks: int
    deleted_tasks: int
    deleted_attachments: int
    freed_bytes: int
