"""add_area_to_processes

Revision ID: u0o1p2q3r4s5
Revises: t9n0o1p2q3r4
Create Date: 2026-02-20 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "u0o1p2q3r4s5"
down_revision: Union[str, None] = "t9n0o1p2q3r4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            ADD COLUMN IF NOT EXISTS area TEXT;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            DROP COLUMN IF EXISTS area;
    """)
