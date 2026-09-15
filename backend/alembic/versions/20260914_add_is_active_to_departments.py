"""Add is_active to departments.

Revision ID: 20260914_departments_is_active
Revises:
Create Date: 2026-09-14
"""

from alembic import op
import sqlalchemy as sa


revision = "20260914_departments_is_active"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "departments",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("departments", "is_active")
