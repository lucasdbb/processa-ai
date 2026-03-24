"""add visibility timeout columns to job_queue

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-03-23 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "k6l7m8n9o0p1"
down_revision: Union[str, None] = "0782bc4ec0db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        -- Add status, claimed_at, and retries columns for visibility timeout
        ALTER TABLE public.job_queue
            ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS claimed_at  TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS retries     INTEGER NOT NULL DEFAULT 0;

        -- Index for the reaper query (find stuck processing jobs)
        CREATE INDEX IF NOT EXISTS idx_job_queue_status_claimed
            ON public.job_queue (status, claimed_at)
            WHERE status = 'processing';

        -- Update the fetch index to include status for the new claim query
        DROP INDEX IF EXISTS public.idx_job_queue_fetch;
        CREATE INDEX idx_job_queue_fetch ON public.job_queue (queue, status, id);
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE public.job_queue
            DROP COLUMN IF EXISTS status,
            DROP COLUMN IF EXISTS claimed_at,
            DROP COLUMN IF EXISTS retries;

        DROP INDEX IF EXISTS public.idx_job_queue_status_claimed;
        DROP INDEX IF EXISTS public.idx_job_queue_fetch;
        CREATE INDEX idx_job_queue_fetch ON public.job_queue (queue, id);
    """)
