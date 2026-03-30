"""add_waitlist_referral_columns

Revision ID: d7e8f9a1b2c3
Revises: c6d7e8f9a1b2
Create Date: 2026-03-30 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7e8f9a1b2c3"
down_revision: Union[str, None] = "c6d7e8f9a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE public.waitlist
            ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
            ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.waitlist(id);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_referral_code
            ON public.waitlist (referral_code);

        CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by
            ON public.waitlist (referred_by);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS public.idx_waitlist_referred_by;
        DROP INDEX IF EXISTS public.idx_waitlist_referral_code;
        ALTER TABLE public.waitlist
            DROP COLUMN IF EXISTS referred_by,
            DROP COLUMN IF EXISTS referral_code;
    """)
