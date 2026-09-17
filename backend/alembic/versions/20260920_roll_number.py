"""Add roll_number to studentprofile.

Revision ID: 20260920_roll_number
Revises: 20260920_degree_level_enum
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa


revision = "20260920_roll_number"
down_revision = "20260920_degree_level_enum"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("studentprofile", sa.Column("roll_number", sa.String(), nullable=True))
    op.create_unique_constraint("studentprofile_roll_number_key", "studentprofile", ["roll_number"])


def downgrade() -> None:
    op.drop_constraint("studentprofile_roll_number_key", "studentprofile", type_="unique")
    op.drop_column("studentprofile", "roll_number")
