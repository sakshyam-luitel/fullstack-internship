"""Record the panel's verdict on a defense: feedback and whether to redefend.

Revision ID: 20260927_defense_outcome
Revises: 20260926_defense_planning
Create Date: 2026-09-27

Checks before each step, like 20260926_defense_planning: create_all may already
have created parts of this schema.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260927_defense_outcome"
down_revision = "20260926_defense_planning"
branch_labels = None
depends_on = None


def _columns(inspector, table):
    return {column["name"] for column in inspector.get_columns(table)}


def _foreign_keys(inspector, table):
    return {key.get("name") for key in inspector.get_foreign_keys(table)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = _columns(inspector, "defenses")

    if "outcome_comments" not in columns:
        op.add_column("defenses", sa.Column("outcome_comments", sa.String(), nullable=True))
    if "outcome_recorded_at" not in columns:
        op.add_column("defenses", sa.Column("outcome_recorded_at", sa.TIMESTAMP(timezone=True), nullable=True))
    if "outcome_recorded_by" not in columns:
        op.add_column("defenses", sa.Column("outcome_recorded_by", sa.Uuid(), nullable=True))
    if "defenses_outcome_recorded_by_fkey" not in _foreign_keys(inspector, "defenses"):
        op.create_foreign_key("defenses_outcome_recorded_by_fkey", "defenses", "users", ["outcome_recorded_by"], ["id"])
    if "requires_redefense" not in columns:
        op.add_column("defenses", sa.Column("requires_redefense", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # Outcomes recorded before this migration have no date on them; the row was
    # only ever written by an admin deciding the outcome, so created_at is the
    # closest thing on record.
    op.execute("UPDATE defenses SET outcome_recorded_at = created_at WHERE current_status <> 'pending' AND outcome_recorded_at IS NULL")


def downgrade() -> None:
    op.drop_column("defenses", "requires_redefense")
    op.drop_constraint("defenses_outcome_recorded_by_fkey", "defenses", type_="foreignkey")
    op.drop_column("defenses", "outcome_recorded_by")
    op.drop_column("defenses", "outcome_recorded_at")
    op.drop_column("defenses", "outcome_comments")
