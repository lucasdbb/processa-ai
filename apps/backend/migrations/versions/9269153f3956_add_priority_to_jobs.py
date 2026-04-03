"""add_priority_to_jobs

Adds a priority column to public.jobs so higher-priority jobs (calculators=8,
AI=7) are dequeued before lower-priority ones (RAG=2, translation=1).
Updates the dequeue index to include priority.

Revision ID: 9269153f3956
Revises: aa1bb2cc3dd4
Create Date: 2026-04-03 07:30:10.514519

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '9269153f3956'
down_revision: Union[str, None] = 'aa1bb2cc3dd4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add priority column (higher = dequeued first, default 0)
    op.execute("""
        ALTER TABLE public.jobs
        ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
    """)

    # Backfill existing rows based on job_type
    op.execute("""
        UPDATE public.jobs SET priority = CASE
            WHEN job_type LIKE 'calculator_%' THEN 8
            WHEN job_type = 'parse_cnis' THEN 8
            WHEN job_type = 'rag_ingest' THEN 2
            WHEN job_type = 'translate_timeline_event' THEN 1
            ELSE 7
        END;
    """)

    # Replace the dequeue index to include priority (DESC) for correct ordering
    op.execute("DROP INDEX IF EXISTS ix_jobs_dequeue;")
    op.execute("""
        CREATE INDEX ix_jobs_dequeue
        ON public.jobs(queue, priority DESC, created_at ASC)
        WHERE status = 'queued';
    """)


def downgrade() -> None:
    # Restore original dequeue index
    op.execute("DROP INDEX IF EXISTS ix_jobs_dequeue;")
    op.execute("""
        CREATE INDEX ix_jobs_dequeue
        ON public.jobs(queue, created_at)
        WHERE status = 'queued';
    """)

    # Drop priority column
    op.execute("ALTER TABLE public.jobs DROP COLUMN IF EXISTS priority;")
