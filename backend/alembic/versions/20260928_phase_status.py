"""Explicit phase lifecycle (pending/open/closed) and a deleted submission status.

Revision ID: 20260928_phase_status
Revises: 20260927_defense_outcome
Create Date: 2026-09-28

Checks before each step, like 20260927_defense_outcome: create_all may already
have created parts of this schema.

Backfill: a phase that has ended (its deadline, or a defense phase's day, is
past) becomes closed; of what remains, the earliest step per degree level that
has already opened becomes open, and everything else pending. That keeps the
"one open phase per level, in order" rule true of existing data without closing
rounds an admin scheduled for later — they stay pending until opened.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260928_phase_status"
down_revision = "20260927_defense_outcome"
branch_labels = None
depends_on = None


def _columns(inspector, table):
    return {column["name"] for column in inspector.get_columns(table)}


def _foreign_keys(inspector, table):
    return {key.get("name") for key in inspector.get_foreign_keys(table)}


def _enum_labels(bind, name):
    return {
        row[0]
        for row in bind.execute(
            sa.text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = :name"),
            {"name": name},
        )
    }


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    phase_status = sa.Enum("pending", "open", "closed", name="phasestatus")
    phase_status.create(bind, checkfirst=True)

    columns = _columns(inspector, "researchphases")
    if "status" not in columns:
        op.add_column(
            "researchphases",
            sa.Column("status", phase_status, nullable=False, server_default=sa.text("'pending'")),
        )
    if "closed_at" not in columns:
        op.add_column("researchphases", sa.Column("closed_at", sa.TIMESTAMP(timezone=True), nullable=True))
    if "closed_by" not in columns:
        op.add_column("researchphases", sa.Column("closed_by", sa.Uuid(), nullable=True))
    if "researchphases_closed_by_fkey" not in _foreign_keys(inspector, "researchphases"):
        op.create_foreign_key("researchphases_closed_by_fkey", "researchphases", "users", ["closed_by"], ["id"])

    # Only backfill rows still sitting on the default, so re-running this after an
    # admin has opened or closed phases by hand doesn't overwrite their decisions.
    op.execute(
        """
        UPDATE researchphases SET status = 'closed', closed_at = COALESCE(deadline_at, defense_date + interval '1 day')
        WHERE status = 'pending' AND deleted_at IS NULL
          AND ((phase_type = 'defense' AND defense_date IS NOT NULL AND now() >= defense_date + interval '1 day')
               OR (phase_type <> 'defense' AND deadline_at IS NOT NULL AND now() > deadline_at))
        """
    )
    # The earliest step per level that has already started is the one now running.
    op.execute(
        """
        UPDATE researchphases SET status = 'open'
        WHERE id IN (
            SELECT DISTINCT ON (department_id, degree_level) id
            FROM researchphases
            WHERE status = 'pending' AND deleted_at IS NULL
              AND (opens_at IS NULL OR opens_at <= now())
            ORDER BY department_id, degree_level, sequence_number, created_at
        )
        """
    )

    if "deleted" not in _enum_labels(bind, "submissionstatus"):
        op.execute("ALTER TYPE submissionstatus ADD VALUE 'deleted'")


def downgrade() -> None:
    op.drop_constraint("researchphases_closed_by_fkey", "researchphases", type_="foreignkey")
    op.drop_column("researchphases", "closed_by")
    op.drop_column("researchphases", "closed_at")
    op.drop_column("researchphases", "status")
    sa.Enum(name="phasestatus").drop(op.get_bind(), checkfirst=True)
    # Postgres cannot drop one label from an enum type, so 'deleted' stays on
    # submissionstatus. Nothing reads it once the mutation is rolled back.
