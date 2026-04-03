"""unify_jobs_tables

Unifica ai_jobs + worker_jobs + job_queue em uma única tabela `jobs` que
serve como status tracker E fila (FOR UPDATE SKIP LOCKED).
Unifica ai_job_events + worker_job_events em `job_events`.
Atualiza generated_documents para usar apenas job_id (remove worker_job_id).
Corrige bug do parse_cnis (prefixo cnis: não era reconhecido pelo endpoint de status).

Revision ID: aa1bb2cc3dd4
Revises: d4e5f6_prev_calc
Create Date: 2026-04-02 20:22:35.194221

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "aa1bb2cc3dd4"
down_revision: Union[str, None] = "d4e5f6_prev_calc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create unified jobs table (status tracker + queue)
    op.execute("""
        CREATE TABLE public.jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_type TEXT NOT NULL,
            queue TEXT NOT NULL DEFAULT 'jobs',
            status TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled', 'dead')),
            progress INTEGER NOT NULL DEFAULT 0
                CHECK (progress >= 0 AND progress <= 100),
            user_id TEXT,
            client_id TEXT,
            request_payload JSONB,
            result_payload JSONB,
            error TEXT,
            claimed_at TIMESTAMPTZ,
            retries INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            finished_at TIMESTAMPTZ
        );

        CREATE INDEX ix_jobs_dequeue ON public.jobs(queue, created_at) WHERE status = 'queued';
        CREATE INDEX ix_jobs_user_status ON public.jobs(user_id, status);
        CREATE INDEX ix_jobs_type ON public.jobs(job_type);
        CREATE INDEX ix_jobs_reaper ON public.jobs(claimed_at) WHERE status = 'processing';

        ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
    """)

    # 2. Create unified job_events table
    op.execute("""
        CREATE TABLE public.job_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            message TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX ix_job_events_job ON public.job_events(job_id);

        ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
    """)

    # 3. Migrate ai_jobs → jobs (endpoint_key becomes job_type)
    op.execute("""
        INSERT INTO public.jobs (id, job_type, queue, status, progress, user_id, client_id,
                                 request_payload, result_payload, error,
                                 retries, created_at, started_at, finished_at)
        SELECT id, endpoint_key, 'jobs', status, progress, user_id, client_id,
               request_payload, result_payload, error,
               0, created_at, started_at, finished_at
        FROM public.ai_jobs
        ON CONFLICT (id) DO NOTHING;
    """)

    # 4. Migrate worker_jobs → jobs
    op.execute("""
        INSERT INTO public.jobs (id, job_type, queue, status, progress, user_id, client_id,
                                 request_payload, result_payload, error,
                                 retries, created_at, started_at, finished_at)
        SELECT id, job_type, 'jobs', status, progress, user_id, client_id,
               request_payload, result_payload, error,
               0, created_at, started_at, finished_at
        FROM public.worker_jobs
        ON CONFLICT (id) DO NOTHING;
    """)

    # 5. Migrate ai_job_events → job_events
    op.execute("""
        INSERT INTO public.job_events (job_id, event_type, message, payload, created_at)
        SELECT job_id, event_type, message, payload, created_at
        FROM public.ai_job_events
        WHERE job_id IN (SELECT id FROM public.jobs);
    """)

    # 6. Migrate worker_job_events → job_events
    op.execute("""
        INSERT INTO public.job_events (job_id, event_type, message, payload, created_at)
        SELECT job_id, event_type, message, payload, created_at
        FROM public.worker_job_events
        WHERE job_id IN (SELECT id FROM public.jobs);
    """)

    # 7. Drop old FK constraints BEFORE copying data (avoids FK violation)
    op.execute("""
        ALTER TABLE public.generated_documents
            DROP CONSTRAINT IF EXISTS generated_documents_job_id_fkey;
        ALTER TABLE public.generated_documents
            DROP CONSTRAINT IF EXISTS fk_generated_documents_job_id;
        ALTER TABLE public.generated_documents
            DROP CONSTRAINT IF EXISTS generated_documents_worker_job_id_fkey;
    """)

    # 8. Copy worker_job_id → job_id (now safe, no FK blocking)
    op.execute("""
        UPDATE public.generated_documents
        SET job_id = worker_job_id
        WHERE worker_job_id IS NOT NULL AND job_id IS NULL;
    """)

    # Drop worker_job_id column
    op.execute("""
        DROP INDEX IF EXISTS ix_generated_documents_worker_job;
        ALTER TABLE public.generated_documents DROP COLUMN IF EXISTS worker_job_id;
    """)

    # Add new FK to unified jobs table
    op.execute("""
        ALTER TABLE public.generated_documents
            ADD CONSTRAINT fk_generated_documents_job_id
            FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
    """)

    # Update source CHECK constraint to allow any value (no longer just 'ai'/'calculator')
    op.execute("""
        ALTER TABLE public.generated_documents
            DROP CONSTRAINT IF EXISTS generated_documents_source_check;
    """)

    # 8. Drop old tables (events first due to FK)
    op.execute("DROP TABLE IF EXISTS public.ai_job_events CASCADE;")
    op.execute("DROP TABLE IF EXISTS public.worker_job_events CASCADE;")
    op.execute("DROP TABLE IF EXISTS public.ai_jobs CASCADE;")
    op.execute("DROP TABLE IF EXISTS public.worker_jobs CASCADE;")
    op.execute("DROP TABLE IF EXISTS public.job_queue CASCADE;")


def downgrade() -> None:
    # Recreate job_queue
    op.execute("""
        CREATE TABLE public.job_queue (
            id BIGSERIAL PRIMARY KEY,
            queue TEXT NOT NULL DEFAULT 'jobs',
            payload JSONB NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            claimed_at TIMESTAMPTZ,
            retries INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX idx_job_queue_fetch ON public.job_queue(queue, id);
    """)

    # Recreate ai_jobs
    op.execute("""
        CREATE TABLE public.ai_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            endpoint_key TEXT NOT NULL,
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
        ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
    """)

    # Recreate ai_job_events
    op.execute("""
        CREATE TABLE public.ai_job_events (
            id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            job_id UUID NOT NULL REFERENCES public.ai_jobs(id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            message TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # Recreate worker_jobs
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
        ALTER TABLE public.worker_jobs ENABLE ROW LEVEL SECURITY;
    """)

    # Recreate worker_job_events
    op.execute("""
        CREATE TABLE public.worker_job_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID NOT NULL REFERENCES public.worker_jobs(id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            message TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # Re-add worker_job_id to generated_documents
    op.execute("""
        ALTER TABLE public.generated_documents
            ADD COLUMN worker_job_id UUID
            REFERENCES public.worker_jobs(id) ON DELETE SET NULL;
    """)

    # Drop unified tables
    op.execute("DROP TABLE IF EXISTS public.job_events CASCADE;")
    op.execute("DROP TABLE IF EXISTS public.jobs CASCADE;")
