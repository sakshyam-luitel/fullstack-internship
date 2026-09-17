"""Add status to proposalcandidates for the invite/accept/reject flow.

Revision ID: 20260916_candidate_status
Revises: 20260915_proposal_review
Create Date: 2026-09-16
"""

from alembic import op
import sqlalchemy as sa


revision = "20260916_candidate_status"
down_revision = "20260915_proposal_review"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposalcandidates",
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
    )


def downgrade() -> None:
    op.drop_column("proposalcandidates", "status")
