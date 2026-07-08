"""task global number and user printer

Revision ID: 009
Revises: 008
Create Date: 2026-07-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS task_number_seq")

    op.add_column("tasks", sa.Column("number", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE tasks AS t
        SET number = s.rn
        FROM (
            SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
            FROM tasks
        ) AS s
        WHERE t.id = s.id
        """
    )
    op.execute(
        "SELECT setval('task_number_seq', COALESCE((SELECT MAX(number) FROM tasks), 0) + 1, false)"
    )
    op.alter_column(
        "tasks",
        "number",
        server_default=sa.text("nextval('task_number_seq')"),
        nullable=False,
    )
    op.create_unique_constraint("uq_tasks_number", "tasks", ["number"])

    op.add_column("users", sa.Column("printer", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "printer")
    op.drop_constraint("uq_tasks_number", "tasks", type_="unique")
    op.drop_column("tasks", "number")
    op.execute("DROP SEQUENCE IF EXISTS task_number_seq")
