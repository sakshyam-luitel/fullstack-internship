"""Add student_response/responded_by to proposals for the feedback-response flow.

Revision ID: 20260917_student_response
Revises: 20260916_user_avatar_url
Create Date: 2026-09-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260917_student_response"
down_revision = "20260916_user_avatar_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("proposals", sa.Column("student_response", sa.String(), nullable=True))
    op.add_column("proposals", sa.Column("responded_by", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "proposals_responded_by_fkey",
        "proposals",
        "users",
        ["responded_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("proposals_responded_by_fkey", "proposals", type_="foreignkey")
    op.drop_column("proposals", "responded_by")
    op.drop_column("proposals", "student_response")
