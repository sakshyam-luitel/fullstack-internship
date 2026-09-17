"""Add document metadata columns to defenses (final thesis submission).

Revision ID: 20260921_defense_file
Revises: 20260920_file_metadata
Create Date: 2026-09-21
"""

from alembic import op
import sqlalchemy as sa


revision = "20260921_defense_file"
down_revision = "20260920_file_metadata"
branch_labels = None
depends_on = None

FILE_METADATA_COLUMNS = [
    ("file_path", sa.String()),
    ("original_filename", sa.String()),
    ("file_size_bytes", sa.Integer()),
    ("content_type", sa.String()),
    ("uploaded_at", sa.TIMESTAMP(timezone=True)),
    ("checksum", sa.String()),
]


def upgrade() -> None:
    for column_name, column_type in FILE_METADATA_COLUMNS:
        op.add_column("defenses", sa.Column(column_name, column_type, nullable=True))


def downgrade() -> None:
    for column_name, _ in FILE_METADATA_COLUMNS:
        op.drop_column("defenses", column_name)
