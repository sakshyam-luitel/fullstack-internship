"""Add avatar_url to users for profile picture uploads.

Revision ID: 20260916_user_avatar_url
Revises: 20260916_candidate_status
Create Date: 2026-09-16
"""

from alembic import op
import sqlalchemy as sa


revision = "20260916_user_avatar_url"
down_revision = "20260916_candidate_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
