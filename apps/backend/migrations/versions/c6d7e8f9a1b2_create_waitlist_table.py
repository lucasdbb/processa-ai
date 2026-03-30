"""create_waitlist_table

Revision ID: c6d7e8f9a1b2
Revises: b5c6d7e8f9a0
Create Date: 2026-03-30 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c6d7e8f9a1b2"
down_revision: Union[str, None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.waitlist (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT,
            utm_source TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

        CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist (email);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS public.idx_waitlist_email;
        DROP TABLE IF EXISTS public.waitlist;
    """)
