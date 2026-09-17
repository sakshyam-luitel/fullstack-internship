"""Create the missing paper for proposals approved before papers existed.

Revision ID: 20260925_backfill_papers
Revises: 20260924_timeline_notifications
Create Date: 2026-09-25

Approving a proposal now creates its paper (utils.ensure_paper_for_proposal).
Proposals approved before that have no paper, so their students could never
submit progress reports or a final report.
"""

import uuid

from alembic import op
import sqlalchemy as sa


revision = "20260925_backfill_papers"
down_revision = "20260924_timeline_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    orphans = bind.execute(sa.text("""
        SELECT p.id, p.supervisor_id, p.cluster_id, p.title
        FROM proposals p
        WHERE p.status IN ('approved', 'completed')
          AND p.deleted_at IS NULL
          AND p.supervisor_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM papers pa WHERE pa.proposal_id = p.id)
    """)).all()
    for proposal_id, supervisor_id, cluster_id, title in orphans:
        bind.execute(
            sa.text("""
                INSERT INTO papers (id, supervisor_id, proposal_id, cluster_id, title, status)
                VALUES (:id, :supervisor_id, :proposal_id, :cluster_id, :title, 'in_progress')
            """),
            {"id": uuid.uuid4(), "supervisor_id": supervisor_id, "proposal_id": proposal_id, "cluster_id": cluster_id, "title": title},
        )


def downgrade() -> None:
    # The backfilled rows can't be told apart from papers created by approval.
    pass
