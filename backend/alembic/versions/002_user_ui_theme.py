"""user ui_theme

Revision ID: 002
Revises: 001
Create Date: 2026-06-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ui_theme_enum = sa.Enum("light", "dark", "neon", name="ui_theme")


def upgrade() -> None:
    ui_theme_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "users",
        sa.Column("ui_theme", ui_theme_enum, nullable=False, server_default="light"),
    )


def downgrade() -> None:
    op.drop_column("users", "ui_theme")
    ui_theme_enum.drop(op.get_bind(), checkfirst=True)
