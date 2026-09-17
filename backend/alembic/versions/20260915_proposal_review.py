"""Add review_comment to proposals.

Revision ID: 20260915_proposal_review
Revises: c4294d79dbdd
Create Date: 2026-09-15
"""

from alembic import op
import sqlalchemy as sa


revision = "20260915_proposal_review"
down_revision = "c4294d79dbdd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("proposals", sa.Column("review_comment", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("proposals", "review_comment")
