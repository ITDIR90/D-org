"""widen device push token column

Revision ID: 011
Revises: 010
Create Date: 2026-07-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "user_device_tokens",
        "token",
        existing_type=sa.String(255),
        type_=sa.String(512),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "user_device_tokens",
        "token",
        existing_type=sa.String(512),
        type_=sa.String(255),
        existing_nullable=False,
    )
