"""Make post user_id nullable

Revision ID: c6d9e2a4b781
Revises: f41afe00ef85
Create Date: 2026-08-18 12:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c6d9e2a4b781'
down_revision: Union[str, Sequence[str], None] = 'f41afe00ef85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'posts',
        'user_id',
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'posts',
        'user_id',
        existing_type=sa.Integer(),
        nullable=False,
    )