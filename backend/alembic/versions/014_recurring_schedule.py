"""add recurring schedule constructor & validity period

Revision ID: 014
Revises: 013
Create Date: 2026-09-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recurring_task_templates",
        sa.Column("start_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "recurring_task_templates",
        sa.Column("end_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "recurring_task_templates",
        sa.Column("interval", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "recurring_task_templates",
        sa.Column("weekdays", sa.JSON(), nullable=True),
    )
    op.add_column(
        "recurring_task_templates",
        sa.Column("month_days", sa.JSON(), nullable=True),
    )
    op.add_column(
        "recurring_task_templates",
        sa.Column("run_at", sa.String(length=5), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("recurring_task_templates", "run_at")
    op.drop_column("recurring_task_templates", "month_days")
    op.drop_column("recurring_task_templates", "weekdays")
    op.drop_column("recurring_task_templates", "interval")
    op.drop_column("recurring_task_templates", "end_date")
    op.drop_column("recurring_task_templates", "start_date")
