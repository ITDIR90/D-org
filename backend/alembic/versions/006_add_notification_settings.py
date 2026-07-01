"""add notification preferences and task reminders

Revision ID: 006
Revises: 005
Create Date: 2026-06-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("notify_via_email", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "users",
        sa.Column("notify_via_telegram", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("telegram_chat_id", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("overdue_digest_sent_on", sa.Date(), nullable=True),
    )

    op.add_column(
        "tasks",
        sa.Column("notify_before_minutes", sa.Integer(), nullable=False, server_default="60"),
    )
    op.add_column(
        "tasks",
        sa.Column("due_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tasks", "due_reminder_sent_at")
    op.drop_column("tasks", "notify_before_minutes")
    op.drop_column("users", "overdue_digest_sent_on")
    op.drop_column("users", "telegram_chat_id")
    op.drop_column("users", "notify_via_telegram")
    op.drop_column("users", "notify_via_email")
