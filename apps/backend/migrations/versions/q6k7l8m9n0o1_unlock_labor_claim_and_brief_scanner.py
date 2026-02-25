"""unlock_labor_claim_and_brief_scanner

Unlock labor_claim and brief_scanner AI endpoints and update their
variants to dedicated types so the frontend maps them to the correct
components.

Revision ID: q6k7l8m9n0o1
Revises: 95779e826015
Create Date: 2026-02-18 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "q6k7l8m9n0o1"
down_revision: Union[str, None] = "95779e826015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Unlock and set dedicated variant for labor_claim
    op.execute("""
        UPDATE public.ai_endpoints
        SET
            is_locked = false,
            variant = 'labor_claim'
        WHERE key = 'labor_claim';
    """)

    # Unlock and set dedicated variant for brief_scanner
    op.execute("""
        UPDATE public.ai_endpoints
        SET
            is_locked = false,
            variant = 'scanner'
        WHERE key = 'brief_scanner';
    """)


def downgrade() -> None:
    # Revert labor_claim to locked prompt variant
    op.execute("""
        UPDATE public.ai_endpoints
        SET
            is_locked = true,
            variant = 'prompt'
        WHERE key = 'labor_claim';
    """)

    # Revert brief_scanner to locked cnis variant
    op.execute("""
        UPDATE public.ai_endpoints
        SET
            is_locked = true,
            variant = 'cnis'
        WHERE key = 'brief_scanner';
    """)
