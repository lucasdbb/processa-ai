"""change deadlines due_date from date to timestamptz

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-02-08 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.deadlines
            ALTER COLUMN due_date TYPE TIMESTAMPTZ
            USING due_date::timestamptz;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.deadlines
            ALTER COLUMN due_date TYPE DATE
            USING due_date::date;
    """)
