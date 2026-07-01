"""add notification enum values

Revision ID: 007
Revises: 006
Create Date: 2026-06-28

"""
from typing import Sequence, Union

from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'due_reminder'")
        op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'overdue_digest'")
        op.execute("ALTER TYPE user_action_type ADD VALUE IF NOT EXISTS 'telegram_sent'")
        op.execute("ALTER TYPE user_action_type ADD VALUE IF NOT EXISTS 'telegram_error'")


def downgrade() -> None:
    pass
