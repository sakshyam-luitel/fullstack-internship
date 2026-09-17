"""Add unified research phases, append-only history, and defense panels.

Revision ID: 20260923_research_phases
Revises: 20260922_final_report_review
Create Date: 2026-09-23

Every step checks for existing objects first: main.py's create_all runs at
startup and creates these new tables (but never the new columns on existing
tables) before this migration gets a chance to, so a plain create_table would
fail while the phase_id columns would still be missing.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260923_research_phases"
down_revision = "20260922_final_report_review"
branch_labels = None
depends_on = None


def _has_column(inspector, table, column) -> bool:
    return any(item["name"] == column for item in inspector.get_columns(table))


def _has_foreign_key(inspector, table, name) -> bool:
    return any(item.get("name") == name for item in inspector.get_foreign_keys(table))


def _add_phase_fk_column(inspector, table) -> None:
    if not _has_column(inspector, table, "phase_id"):
        op.add_column(table, sa.Column("phase_id", sa.Uuid(), nullable=True))
    constraint = f"{table}_phase_id_fkey"
    if not _has_foreign_key(inspector, table, constraint):
        op.create_foreign_key(constraint, table, "researchphases", ["phase_id"], ["id"], ondelete="SET NULL")


def upgrade() -> None:
    phase_type = sa.Enum("proposal", "progress_report", "defense", name="phasetype")
    entity_type = sa.Enum("proposal", "progress_report", "defense", name="submissionentitytype")
    history_status = sa.Enum("pending", "accepted", "rejected", name="submissionstatus")
    bind = op.get_bind()
    phase_type.create(bind, checkfirst=True)
    entity_type.create(bind, checkfirst=True)
    history_status.create(bind, checkfirst=True)
    inspector = sa.inspect(bind)

    if not inspector.has_table("researchphases"):
        op.create_table(
            "researchphases",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("phase_type", postgresql.ENUM("proposal", "progress_report", "defense", name="phasetype", create_type=False), nullable=False),
            sa.Column("degree_level", postgresql.ENUM("bachelors", "masters", "phd", name="degreelevel", create_type=False), nullable=False),
            sa.Column("department_id", sa.Uuid(), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=True),
            sa.Column("label", sa.String(), nullable=False),
            sa.Column("sequence_number", sa.Integer(), nullable=False),
            sa.Column("opens_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("deadline_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("defense_date", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("grace_period_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("department_id", "degree_level", "sequence_number", name="researchphases_department_level_sequence_key"),
        )
    if not inspector.has_table("submissionhistory"):
        op.create_table(
            "submissionhistory",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("entity_type", postgresql.ENUM("proposal", "progress_report", "defense", name="submissionentitytype", create_type=False), nullable=False),
            sa.Column("entity_id", sa.Uuid(), nullable=False),
            sa.Column("phase_id", sa.Uuid(), sa.ForeignKey("researchphases.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("submitted_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("status", postgresql.ENUM("pending", "accepted", "rejected", name="submissionstatus", create_type=False), nullable=False),
            sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("comments", sa.String(), nullable=True),
            sa.Column("file_path", sa.String(), nullable=True),
            sa.Column("original_filename", sa.String(), nullable=True),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
    if not any(index["name"] == "submissionhistory_entity_created_idx" for index in inspector.get_indexes("submissionhistory")):
        op.create_index("submissionhistory_entity_created_idx", "submissionhistory", ["entity_type", "entity_id", "created_at"])

    for table in ("proposals", "progressreports", "defenses"):
        _add_phase_fk_column(inspector, table)
    if not _has_column(inspector, "defenses", "scheduled_time"):
        op.add_column("defenses", sa.Column("scheduled_time", sa.Time(), nullable=True))
    if not _has_column(inspector, "defenses", "current_status"):
        op.add_column("defenses", sa.Column("current_status", sa.String(), nullable=False, server_default=sa.text("'pending'")))

    if not inspector.has_table("defensepanels"):
        op.create_table(
            "defensepanels",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("defense_id", sa.Uuid(), sa.ForeignKey("defenses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("professor_id", sa.Uuid(), sa.ForeignKey("professorprofile.user_id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("defense_id", "professor_id", name="defensepanels_defense_professor_key"),
        )


def downgrade() -> None:
    op.drop_table("defensepanels")
    op.drop_column("defenses", "current_status")
    op.drop_column("defenses", "scheduled_time")
    op.drop_constraint("defenses_phase_id_fkey", "defenses", type_="foreignkey")
    op.drop_column("defenses", "phase_id")
    op.drop_constraint("progressreports_phase_id_fkey", "progressreports", type_="foreignkey")
    op.drop_column("progressreports", "phase_id")
    op.drop_constraint("proposals_phase_id_fkey", "proposals", type_="foreignkey")
    op.drop_column("proposals", "phase_id")
    op.drop_index("submissionhistory_entity_created_idx", table_name="submissionhistory")
    op.drop_table("submissionhistory")
    op.drop_table("researchphases")
    bind = op.get_bind()
    sa.Enum(name="submissionstatus").drop(bind, checkfirst=True)
    sa.Enum(name="submissionentitytype").drop(bind, checkfirst=True)
    sa.Enum(name="phasetype").drop(bind, checkfirst=True)
