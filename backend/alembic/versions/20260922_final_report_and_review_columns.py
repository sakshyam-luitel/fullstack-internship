"""Add final-report columns to papers, and review columns to progressreports.

Revision ID: 20260922_final_report_review
Revises: 20260922_submission_windows
Create Date: 2026-09-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260922_final_report_review"
down_revision = "20260922_submission_windows"
branch_labels = None
depends_on = None

PAPERS_COLUMNS = [
    ("final_report_file_path", sa.String()),
    ("final_report_original_filename", sa.String()),
    ("final_report_file_size_bytes", sa.Integer()),
    ("final_report_content_type", sa.String()),
    ("final_report_uploaded_at", sa.TIMESTAMP(timezone=True)),
    ("final_report_checksum", sa.String()),
    ("final_report_status", sa.String()),
    ("final_report_review_comment", sa.String()),
]


def upgrade() -> None:
    for column_name, column_type in PAPERS_COLUMNS:
        op.add_column("papers", sa.Column(column_name, column_type, nullable=True))
    op.add_column("papers", sa.Column("final_report_reviewed_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True))

    op.add_column("progressreports", sa.Column("review_comment", sa.String(), nullable=True))
    op.add_column("progressreports", sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("progressreports", "reviewed_by")
    op.drop_column("progressreports", "review_comment")

    op.drop_column("papers", "final_report_reviewed_by")
    for column_name, _ in PAPERS_COLUMNS:
        op.drop_column("papers", column_name)
