"""create_job_queue_table

Revision ID: 0782bc4ec0db
Revises: 978d770ae76f
Create Date: 2026-03-17 17:39:19.245656

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0782bc4ec0db"
down_revision: Union[str, None] = "978d770ae76f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE public.job_queue (
            id         BIGSERIAL PRIMARY KEY,
            queue      TEXT NOT NULL DEFAULT 'jobs',
            payload    JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_job_queue_fetch ON public.job_queue (queue, id);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS public.idx_job_queue_fetch;
        DROP TABLE IF EXISTS public.job_queue;
    """)
