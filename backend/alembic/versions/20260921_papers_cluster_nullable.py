"""Make papers.cluster_id nullable — a proposal can be assigned without a cluster.

Revision ID: 20260921_papers_cluster_null
Revises: 20260921_defense_file
Create Date: 2026-09-21
"""

from alembic import op
import sqlalchemy as sa


revision = "20260921_papers_cluster_null"
down_revision = "20260921_defense_file"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("papers", "cluster_id", existing_type=sa.Uuid(), nullable=True)


def downgrade() -> None:
    op.alter_column("papers", "cluster_id", existing_type=sa.Uuid(), nullable=False)
