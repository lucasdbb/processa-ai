"""expand feedback fields for modal v1

Revision ID: cc596c2a5301
Revises: 37e3b1997c17
Create Date: 2026-04-08 21:40:47.433793

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cc596c2a5301"
down_revision: Union[str, None] = "37e3b1997c17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.feedback
            ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating BETWEEN 1 AND 5),
            ADD COLUMN IF NOT EXISTS category TEXT CHECK (
                category IN ('ux', 'bug_report', 'performance', 'feature_request', 'content')
            ),
            ADD COLUMN IF NOT EXISTS adaptive_answer TEXT,
            ADD COLUMN IF NOT EXISTS reference_code TEXT;

        UPDATE public.feedback
        SET reference_code = 'FB-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
        WHERE reference_code IS NULL;

        ALTER TABLE public.feedback
            ALTER COLUMN reference_code SET NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_reference_code
        ON public.feedback(reference_code);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS idx_feedback_reference_code;

        ALTER TABLE public.feedback
            DROP COLUMN IF EXISTS reference_code,
            DROP COLUMN IF EXISTS adaptive_answer,
            DROP COLUMN IF EXISTS category,
            DROP COLUMN IF EXISTS rating;
        """
    )
