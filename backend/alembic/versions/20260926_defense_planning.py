"""Soft-deletable research phases, and defenses for every phase type.

Revision ID: 20260926_defense_planning
Revises: 20260925_backfill_papers
Create Date: 2026-09-26

Checks before each step, like 20260923_research_phases: create_all may already
have created parts of this schema.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260926_defense_planning"
down_revision = "20260925_backfill_papers"
branch_labels = None
depends_on = None


def _columns(inspector, table):
    return {column["name"]: column for column in inspector.get_columns(table)}


def _foreign_keys(inspector, table):
    return {key.get("name") for key in inspector.get_foreign_keys(table)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    phase_columns = _columns(inspector, "researchphases")
    if "deleted_at" not in phase_columns:
        op.add_column("researchphases", sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))
    if "deleted_by" not in phase_columns:
        op.add_column("researchphases", sa.Column("deleted_by", sa.Uuid(), nullable=True))
    if "researchphases_deleted_by_fkey" not in _foreign_keys(inspector, "researchphases"):
        op.create_foreign_key("researchphases_deleted_by_fkey", "researchphases", "users", ["deleted_by"], ["id"])
    unique_names = {constraint["name"] for constraint in inspector.get_unique_constraints("researchphases")}
    if "researchphases_department_level_sequence_key" in unique_names:
        op.drop_constraint("researchphases_department_level_sequence_key", "researchphases", type_="unique")
    if "researchphases_active_sequence_key" not in {index["name"] for index in inspector.get_indexes("researchphases")}:
        op.create_index(
            "researchphases_active_sequence_key", "researchphases", ["department_id", "degree_level", "sequence_number"],
            unique=True, postgresql_where=sa.text("deleted_at IS NULL"),
        )

    defense_columns = _columns(inspector, "defenses")
    if not defense_columns["paper_id"]["nullable"]:
        op.alter_column("defenses", "paper_id", existing_type=sa.Uuid(), nullable=True)
    for column, table in (("proposal_id", "proposals"), ("progress_report_id", "progressreports")):
        if column not in defense_columns:
            op.add_column("defenses", sa.Column(column, sa.Uuid(), nullable=True))
        name = f"defenses_{column}_fkey"
        if name not in _foreign_keys(inspector, "defenses"):
            op.create_foreign_key(name, "defenses", table, [column], ["id"], ondelete="CASCADE")

    if "defense_id" not in _columns(inspector, "notifications"):
        op.add_column("notifications", sa.Column("defense_id", sa.Uuid(), nullable=True))
    if "notifications_defense_id_fkey" not in _foreign_keys(inspector, "notifications"):
        op.create_foreign_key("notifications_defense_id_fkey", "notifications", "defenses", ["defense_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("notifications_defense_id_fkey", "notifications", type_="foreignkey")
    op.drop_column("notifications", "defense_id")
    for column in ("progress_report_id", "proposal_id"):
        op.drop_constraint(f"defenses_{column}_fkey", "defenses", type_="foreignkey")
        op.drop_column("defenses", column)
    op.execute("DELETE FROM defenses WHERE paper_id IS NULL")
    op.alter_column("defenses", "paper_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_index("researchphases_active_sequence_key", table_name="researchphases")
    op.execute("DELETE FROM researchphases WHERE deleted_at IS NOT NULL AND id NOT IN (SELECT phase_id FROM submissionhistory)")
    op.create_unique_constraint("researchphases_department_level_sequence_key", "researchphases", ["department_id", "degree_level", "sequence_number"])
    op.drop_constraint("researchphases_deleted_by_fkey", "researchphases", type_="foreignkey")
    op.drop_column("researchphases", "deleted_by")
    op.drop_column("researchphases", "deleted_at")
