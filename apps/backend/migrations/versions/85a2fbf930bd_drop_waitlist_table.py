"""drop_waitlist_table

Revision ID: 85a2fbf930bd
Revises: ae32439a3e58
Create Date: 2026-04-06 21:04:08.907040

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "85a2fbf930bd"
down_revision: Union[str, None] = "ae32439a3e58"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS public.idx_waitlist_referred_by;
        DROP INDEX IF EXISTS public.idx_waitlist_referral_code;
        DROP INDEX IF EXISTS public.idx_waitlist_email;
        DROP TABLE IF EXISTS public.waitlist;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.waitlist (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT,
            utm_source TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            referral_code TEXT UNIQUE,
            referred_by UUID REFERENCES public.waitlist(id)
        );

        ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

        CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist (email);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_referral_code
            ON public.waitlist (referral_code);
        CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by
            ON public.waitlist (referred_by);
        """
    )
