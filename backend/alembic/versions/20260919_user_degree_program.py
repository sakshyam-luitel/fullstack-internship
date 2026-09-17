"""Add degree_program_id to users, set at student account creation.

Revision ID: 20260919_user_degree
Revises: 20260918_proposal_delete
Create Date: 2026-09-19
"""

from alembic import op
import sqlalchemy as sa


revision = "20260919_user_degree"
down_revision = "20260918_proposal_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("degree_program_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "users_degree_program_id_fkey",
        "users",
        "degreeprograms",
        ["degree_program_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("users_degree_program_id_fkey", "users", type_="foreignkey")
    op.drop_column("users", "degree_program_id")
