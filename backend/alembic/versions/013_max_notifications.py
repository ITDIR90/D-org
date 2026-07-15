"""add max messenger notification fields

Revision ID: 013
Revises: 012
Create Date: 2026-07-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("notify_via_max", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("max_user_id", sa.BigInteger(), nullable=True),
    )
    op.execute("ALTER TYPE user_action_type ADD VALUE IF NOT EXISTS 'max_sent'")
    op.execute("ALTER TYPE user_action_type ADD VALUE IF NOT EXISTS 'max_error'")


def downgrade() -> None:
    op.drop_column("users", "max_user_id")
    op.drop_column("users", "notify_via_max")
