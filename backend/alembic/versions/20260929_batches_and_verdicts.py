"""Yearly batches, per-batch phase numbering, and panel-decided defense verdicts.

Revision ID: 20260929_batches_and_verdicts
Revises: 20260928_phase_status
Create Date: 2026-09-29

Checks before each step, like 20260928_phase_status: create_all may already
have created parts of this schema.

Everything that exists today belongs to one cohort, so this creates a first
active batch and files every student profile and research phase under it. The
phase step-number index gains batch_id, so the next cohort starts at step 1
again without colliding with this one.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260929_batches_and_verdicts"
down_revision = "20260928_phase_status"
branch_labels = None
depends_on = None

FIRST_BATCH_LABEL = "Current batch"


def _tables(inspector):
    return set(inspector.get_table_names())


def _columns(inspector, table):
    return {column["name"] for column in inspector.get_columns(table)}


def _indexes(inspector, table):
    return {index["name"] for index in inspector.get_indexes(table)}


def _foreign_keys(inspector, table):
    return {key.get("name") for key in inspector.get_foreign_keys(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = _tables(inspector)

    batch_status = sa.Enum("active", "archived", name="batchstatus")
    batch_status.create(bind, checkfirst=True)
    verdict_type = sa.Enum("accept", "reject", name="defenseverdicttype")
    verdict_type.create(bind, checkfirst=True)

    if "batches" not in tables:
        op.create_table(
            "batches",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("label", sa.String(), nullable=False),
            sa.Column("status", batch_status, nullable=False, server_default=sa.text("'active'")),
            sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("archived_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("archived_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
    if "batches_single_active_key" not in _indexes(sa.inspect(bind), "batches"):
        op.create_index(
            "batches_single_active_key", "batches", ["status"],
            unique=True, postgresql_where=sa.text("status = 'active'"),
        )

    if "defenseverdicts" not in tables:
        op.create_table(
            "defenseverdicts",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("defense_id", sa.Uuid(), sa.ForeignKey("defenses.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "professor_id", sa.Uuid(),
                sa.ForeignKey("professorprofile.user_id", ondelete="CASCADE"), nullable=False,
            ),
            sa.Column("verdict", verdict_type, nullable=False),
            sa.Column("comments", sa.String(), nullable=True),
            sa.Column("submitted_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("defense_id", "professor_id", name="defenseverdicts_defense_professor_key"),
        )

    inspector = sa.inspect(bind)
    if "batch_id" not in _columns(inspector, "studentprofile"):
        op.add_column("studentprofile", sa.Column("batch_id", sa.Uuid(), nullable=True))
    if "studentprofile_batch_id_fkey" not in _foreign_keys(inspector, "studentprofile"):
        op.create_foreign_key("studentprofile_batch_id_fkey", "studentprofile", "batches", ["batch_id"], ["id"])
    if "batch_id" not in _columns(inspector, "researchphases"):
        op.add_column("researchphases", sa.Column("batch_id", sa.Uuid(), nullable=True))
    if "researchphases_batch_id_fkey" not in _foreign_keys(inspector, "researchphases"):
        op.create_foreign_key("researchphases_batch_id_fkey", "researchphases", "batches", ["batch_id"], ["id"])

    # Everything already in the system is one cohort's work.
    op.execute(
        f"""
        INSERT INTO batches (id, label, status)
        SELECT gen_random_uuid(), '{FIRST_BATCH_LABEL}', 'active'
        WHERE NOT EXISTS (SELECT 1 FROM batches)
        """
    )
    op.execute(
        "UPDATE studentprofile SET batch_id = (SELECT id FROM batches WHERE status = 'active' LIMIT 1) WHERE batch_id IS NULL"
    )
    op.execute(
        "UPDATE researchphases SET batch_id = (SELECT id FROM batches WHERE status = 'active' LIMIT 1) WHERE batch_id IS NULL"
    )

    # Step numbers restart for each cohort, so the uniqueness rule is per batch.
    if "researchphases_active_sequence_key" in _indexes(sa.inspect(bind), "researchphases"):
        op.drop_index("researchphases_active_sequence_key", table_name="researchphases")
    op.create_index(
        "researchphases_active_sequence_key", "researchphases",
        ["batch_id", "department_id", "degree_level", "sequence_number"],
        unique=True, postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("researchphases_active_sequence_key", table_name="researchphases")
    op.create_index(
        "researchphases_active_sequence_key", "researchphases",
        ["department_id", "degree_level", "sequence_number"],
        unique=True, postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_constraint("researchphases_batch_id_fkey", "researchphases", type_="foreignkey")
    op.drop_column("researchphases", "batch_id")
    op.drop_constraint("studentprofile_batch_id_fkey", "studentprofile", type_="foreignkey")
    op.drop_column("studentprofile", "batch_id")
    op.drop_table("defenseverdicts")
    op.drop_index("batches_single_active_key", table_name="batches")
    op.drop_table("batches")
    sa.Enum(name="defenseverdicttype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="batchstatus").drop(op.get_bind(), checkfirst=True)
