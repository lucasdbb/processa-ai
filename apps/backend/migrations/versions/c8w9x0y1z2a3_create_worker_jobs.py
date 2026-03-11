"""create_worker_jobs

Cria tabelas worker_jobs e worker_job_events para jobs genéricos do worker
(calculadoras, futuros serviços) desacoplados de ai_endpoints.
Adiciona coluna worker_job_id em generated_documents.

Revision ID: c8w9x0y1z2a3
Revises: b7v8w9x0y1z2
Create Date: 2026-03-11 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c8w9x0y1z2a3"
down_revision: Union[str, None] = "b7v8w9x0y1z2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Worker jobs table (generic, no FK to ai_endpoints)
    op.execute("""
        CREATE TABLE public.worker_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
            progress INTEGER NOT NULL DEFAULT 0
                CHECK (progress >= 0 AND progress <= 100),
            user_id TEXT NOT NULL,
            client_id TEXT,
            request_payload JSONB,
            result_payload JSONB,
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            finished_at TIMESTAMPTZ
        );

        CREATE INDEX ix_worker_jobs_user_status
            ON public.worker_jobs(user_id, status);
        CREATE INDEX ix_worker_jobs_type
            ON public.worker_jobs(job_type);

        ALTER TABLE public.worker_jobs ENABLE ROW LEVEL SECURITY;
    """)

    # 2. Worker job events table
    op.execute("""
        CREATE TABLE public.worker_job_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID NOT NULL REFERENCES public.worker_jobs(id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            message TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX ix_worker_job_events_job
            ON public.worker_job_events(job_id);

        ALTER TABLE public.worker_job_events ENABLE ROW LEVEL SECURITY;
    """)

    # 3. Add worker_job_id column to generated_documents
    op.execute("""
        ALTER TABLE public.generated_documents
            ADD COLUMN worker_job_id UUID
            REFERENCES public.worker_jobs(id) ON DELETE SET NULL;

        CREATE INDEX ix_generated_documents_worker_job
            ON public.generated_documents(worker_job_id)
            WHERE worker_job_id IS NOT NULL;
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_generated_documents_worker_job;
        ALTER TABLE public.generated_documents DROP COLUMN IF EXISTS worker_job_id;
    """)
    op.execute("DROP TABLE IF EXISTS public.worker_job_events CASCADE;")
    op.execute("DROP TABLE IF EXISTS public.worker_jobs CASCADE;")
