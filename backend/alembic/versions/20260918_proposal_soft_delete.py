"""Add deleted_at/deleted_by to proposals for admin-only soft delete.

Revision ID: 20260918_proposal_delete
Revises: 20260917_student_response
Create Date: 2026-09-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20260918_proposal_delete"
down_revision = "20260917_student_response"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("proposals", sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("proposals", sa.Column("deleted_by", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "proposals_deleted_by_fkey",
        "proposals",
        "users",
        ["deleted_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("proposals_deleted_by_fkey", "proposals", type_="foreignkey")
    op.drop_column("proposals", "deleted_by")
    op.drop_column("proposals", "deleted_at")
