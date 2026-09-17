"""Convert degreeprograms.level to a native DegreeLevel enum.

Existing free-text values are remapped as part of the type change:
undergraduate -> bachelors, postgraduate -> masters, doctoral -> phd.

Revision ID: 20260920_degree_level_enum
Revises: 20260919_user_degree
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa


revision = "20260920_degree_level_enum"
down_revision = "20260919_user_degree"
branch_labels = None
depends_on = None


LEVEL_CASE_SQL = (
    "CASE level "
    "WHEN 'undergraduate' THEN 'bachelors' "
    "WHEN 'postgraduate' THEN 'masters' "
    "WHEN 'doctoral' THEN 'phd' "
    "ELSE level "
    "END::degreelevel"
)


def upgrade() -> None:
    op.alter_column(
        "degreeprograms",
        "level",
        existing_type=sa.VARCHAR(),
        type_=sa.Enum("bachelors", "masters", "phd", name="degreelevel"),
        existing_nullable=False,
        postgresql_using=LEVEL_CASE_SQL,
    )


def downgrade() -> None:
    op.alter_column(
        "degreeprograms",
        "level",
        existing_type=sa.Enum("bachelors", "masters", "phd", name="degreelevel"),
        type_=sa.VARCHAR(),
        existing_nullable=False,
    )
