"""Add document metadata columns to proposals and progressreports.

Revision ID: 20260920_file_metadata
Revises: 20260920_roll_number
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa


revision = "20260920_file_metadata"
down_revision = "20260920_roll_number"
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
    for table in ("proposals", "progressreports"):
        for column_name, column_type in FILE_METADATA_COLUMNS:
            op.add_column(table, sa.Column(column_name, column_type, nullable=True))


def downgrade() -> None:
    for table in ("proposals", "progressreports"):
        for column_name, _ in FILE_METADATA_COLUMNS:
            op.drop_column(table, column_name)
