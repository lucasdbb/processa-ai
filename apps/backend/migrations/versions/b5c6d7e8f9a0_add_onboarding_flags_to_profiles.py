"""add_onboarding_flags_to_profiles

Revision ID: b5c6d7e8f9a0
Revises: a34f1447b00a
Create Date: 2026-03-28 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, None] = "a34f1447b00a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS has_used_ai_tool BOOLEAN NOT NULL DEFAULT FALSE;
    """)
    op.execute("""
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS has_used_calculator BOOLEAN NOT NULL DEFAULT FALSE;
    """)
    op.execute("""
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS checklist_dismissed BOOLEAN NOT NULL DEFAULT FALSE;
    """)
    op.execute("""
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS checklist_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE public.profiles DROP COLUMN IF EXISTS has_used_ai_tool;")
    op.execute("ALTER TABLE public.profiles DROP COLUMN IF EXISTS has_used_calculator;")
    op.execute("ALTER TABLE public.profiles DROP COLUMN IF EXISTS checklist_dismissed;")
    op.execute("ALTER TABLE public.profiles DROP COLUMN IF EXISTS checklist_bonus_claimed;")
