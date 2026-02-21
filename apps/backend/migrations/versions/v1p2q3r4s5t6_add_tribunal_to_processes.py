"""add_tribunal_to_processes

Revision ID: v1p2q3r4s5t6
Revises: u0o1p2q3r4s5
Create Date: 2026-02-20 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "v1p2q3r4s5t6"
down_revision: Union[str, None] = "u0o1p2q3r4s5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            ADD COLUMN IF NOT EXISTS tribunal TEXT;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            DROP COLUMN IF EXISTS tribunal;
    """)
