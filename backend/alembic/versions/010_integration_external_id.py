"""task external references for integrations

Revision ID: 010
Revises: 009
Create Date: 2026-07-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("external_source", sa.String(length=50), nullable=True))
    op.add_column("tasks", sa.Column("external_id", sa.String(length=200), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("source_request_template_id", sa.Integer(), sa.ForeignKey("request_templates.id"), nullable=True),
    )
    op.create_index(
        "uq_tasks_external_ref",
        "tasks",
        ["external_source", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_source IS NOT NULL AND external_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_tasks_external_ref", table_name="tasks")
    op.drop_column("tasks", "source_request_template_id")
    op.drop_column("tasks", "external_id")
    op.drop_column("tasks", "external_source")
