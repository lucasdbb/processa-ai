"""fix_process_summary_variant

Change process_summary variant from 'cnis' to 'process_summary' so
the frontend maps it to the correct ProcessSummaryTool component
instead of the CNIS analysis tool.

Revision ID: r7l8m9n0o1p2
Revises: q6k7l8m9n0o1
Create Date: 2026-02-18 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "r7l8m9n0o1p2"
down_revision: Union[str, None] = "q6k7l8m9n0o1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE public.ai_endpoints
        SET variant = 'process_summary'
        WHERE key = 'process_summary';
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE public.ai_endpoints
        SET variant = 'cnis'
        WHERE key = 'process_summary';
    """)
