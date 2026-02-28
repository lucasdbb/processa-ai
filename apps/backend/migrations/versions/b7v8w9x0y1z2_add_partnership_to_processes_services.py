"""add_partnership_to_processes_services

Revision ID: b7v8w9x0y1z2
Revises: a6u7v8w9x0y1
Create Date: 2026-02-28 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7v8w9x0y1z2"
down_revision: Union[str, None] = "a6u7v8w9x0y1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            ADD COLUMN IF NOT EXISTS is_partnership BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS partner_lawyer TEXT,
            ADD COLUMN IF NOT EXISTS partner_percentage NUMERIC(5,2);

        ALTER TABLE office_api.services
            ADD COLUMN IF NOT EXISTS is_partnership BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS partner_lawyer TEXT,
            ADD COLUMN IF NOT EXISTS partner_percentage NUMERIC(5,2);
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.processes
            DROP COLUMN IF EXISTS is_partnership,
            DROP COLUMN IF EXISTS partner_lawyer,
            DROP COLUMN IF EXISTS partner_percentage;

        ALTER TABLE office_api.services
            DROP COLUMN IF EXISTS is_partnership,
            DROP COLUMN IF EXISTS partner_lawyer,
            DROP COLUMN IF EXISTS partner_percentage;
    """)
