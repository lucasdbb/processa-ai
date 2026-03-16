"""add_progress_to_rag_documents

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-03-16 17:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "j5k6l7m8n9o0"
down_revision: Union[str, None] = "i4j5k6l7m8n9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE public.rag_documents
            ADD COLUMN IF NOT EXISTS progress SMALLINT NOT NULL DEFAULT 0;
        ALTER TABLE public.rag_documents
            ADD COLUMN IF NOT EXISTS progress_message TEXT;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS progress_message;
        ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS progress;
    """)
