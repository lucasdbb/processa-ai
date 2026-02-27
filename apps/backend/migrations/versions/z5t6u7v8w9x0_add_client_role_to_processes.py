"""add_client_role_to_processes

Revision ID: z5t6u7v8w9x0
Revises: y4s5t6u7v8w9
Create Date: 2026-02-26 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "z5t6u7v8w9x0"
down_revision: Union[str, None] = "y4s5t6u7v8w9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            ADD COLUMN IF NOT EXISTS client_role TEXT NOT NULL DEFAULT 'author'
            CHECK (client_role IN ('author', 'defendant'));
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            DROP COLUMN IF EXISTS client_role;
    """)
