"""add_process_category

Revision ID: a6u7v8w9x0y1
Revises: z5t6u7v8w9x0
Create Date: 2026-02-26 11:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a6u7v8w9x0y1"
down_revision: Union[str, None] = "z5t6u7v8w9x0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            ADD COLUMN IF NOT EXISTS process_category TEXT NOT NULL DEFAULT 'judicial'
            CHECK (process_category IN ('judicial', 'administrative'));
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            DROP COLUMN IF EXISTS process_category;
    """)
