"""Turn notifications into in-app messages tied to research phases.

Revision ID: 20260924_timeline_notifications
Revises: 20260923_research_phases
Create Date: 2026-09-24

Checks before each step for the same reason as 20260923_research_phases:
create_all at startup may already have created the table in its new shape.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260924_timeline_notifications"
down_revision = "20260923_research_phases"
branch_labels = None
depends_on = None


def _columns(inspector, table) -> dict:
    return {item["name"]: item for item in inspector.get_columns(table)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = _columns(inspector, "notifications")

    # Phase announcements go out before most students have a paper at all.
    if not columns["paper_id"]["nullable"]:
        op.alter_column("notifications", "paper_id", existing_type=sa.Uuid(), nullable=True)
    if "phase_id" not in columns:
        op.add_column("notifications", sa.Column("phase_id", sa.Uuid(), nullable=True))
    if not any(item.get("name") == "notifications_phase_id_fkey" for item in inspector.get_foreign_keys("notifications")):
        op.create_foreign_key("notifications_phase_id_fkey", "notifications", "researchphases", ["phase_id"], ["id"], ondelete="SET NULL")
    if "title" not in columns:
        op.add_column("notifications", sa.Column("title", sa.String(), nullable=False, server_default=sa.text("''")))
    if "message" not in columns:
        op.add_column("notifications", sa.Column("message", sa.String(), nullable=False, server_default=sa.text("''")))
    if "is_read" not in columns:
        op.add_column("notifications", sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    if not any(index["name"] == "notifications_user_created_idx" for index in inspector.get_indexes("notifications")):
        op.create_index("notifications_user_created_idx", "notifications", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("notifications_user_created_idx", table_name="notifications")
    op.drop_column("notifications", "is_read")
    op.drop_column("notifications", "message")
    op.drop_column("notifications", "title")
    op.drop_constraint("notifications_phase_id_fkey", "notifications", type_="foreignkey")
    op.drop_column("notifications", "phase_id")
    op.execute("DELETE FROM notifications WHERE paper_id IS NULL")
    op.alter_column("notifications", "paper_id", existing_type=sa.Uuid(), nullable=False)
