"""push notifications device tokens

Revision ID: 008
Revises: 007
Create Date: 2026-07-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("notify_via_push", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "user_device_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(255), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "token", name="uq_user_device_token"),
    )
    op.create_index("ix_user_device_tokens_user_id", "user_device_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_device_tokens_user_id", table_name="user_device_tokens")
    op.drop_table("user_device_tokens")
    op.drop_column("users", "notify_via_push")
