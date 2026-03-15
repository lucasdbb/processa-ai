"""add_whatsapp_opt_in_to_profiles

Adds whatsapp_opt_in boolean column to profiles table
for users to opt into WhatsApp deadline notifications.

Revision ID: d9x0y1z2a3b4
Revises: c8w9x0y1z2a3
Create Date: 2026-03-15 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d9x0y1z2a3b4"
down_revision: Union[str, None] = "c8w9x0y1z2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE public.profiles
        DROP COLUMN IF EXISTS whatsapp_opt_in;
    """)
