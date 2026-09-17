"""Add submissionwindows table — per-department, per-phase open/close + deadline.

Revision ID: 20260922_submission_windows
Revises: 20260921_papers_cluster_null
Create Date: 2026-09-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260922_submission_windows"
down_revision = "20260921_papers_cluster_null"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "submissionwindows",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("department_id", sa.Uuid(), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phase", sa.String(), nullable=False),
        sa.Column("due_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("updated_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_unique_constraint(
        "submissionwindows_department_phase_key", "submissionwindows", ["department_id", "phase"]
    )


def downgrade() -> None:
    op.drop_table("submissionwindows")
