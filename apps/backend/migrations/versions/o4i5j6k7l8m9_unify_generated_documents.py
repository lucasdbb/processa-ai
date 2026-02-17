"""unify_generated_documents

Unifica ai_worker.documents e calc_engine.documents em public.generated_documents.
Ambas tinham estrutura quase identica (bucket, storage_path, filename, checksum, etc).
A diferença era apenas a FK: job_id vs calculation_id.

office_api.documents NÃO é afetada (modelo diferente, orientado a gestão de escritório).

Revision ID: o4i5j6k7l8m9
Revises: n3h4i5j6k7l8
Create Date: 2026-02-17 13:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "o4i5j6k7l8m9"
down_revision: Union[str, None] = "n3h4i5j6k7l8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old tables (dados de teste, não precisa migrar)
    op.execute("DROP TABLE IF EXISTS ai_worker.documents CASCADE;")
    op.execute("DROP TABLE IF EXISTS calc_engine.documents CASCADE;")

    # Create unified table
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.generated_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source TEXT NOT NULL CHECK (source IN ('ai', 'calculator')),
            job_id UUID REFERENCES ai_worker.jobs(id) ON DELETE SET NULL,
            calculation_id UUID REFERENCES calc_engine.calculations(id)
                ON DELETE SET NULL,
            user_id TEXT NOT NULL,
            client_id TEXT,
            document_type TEXT NOT NULL,
            bucket TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            filename TEXT NOT NULL,
            checksum_sha256 TEXT,
            size_bytes BIGINT,
            mime_type TEXT NOT NULL DEFAULT 'application/pdf',
            metadata JSONB,
            linked_document_id UUID REFERENCES public.generated_documents(id)
                ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_generated_documents_bucket_path
                UNIQUE (bucket, storage_path)
        );

        CREATE INDEX IF NOT EXISTS ix_generated_documents_user_created
            ON public.generated_documents(user_id, created_at);
        CREATE INDEX IF NOT EXISTS ix_generated_documents_job
            ON public.generated_documents(job_id) WHERE job_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS ix_generated_documents_calc
            ON public.generated_documents(calculation_id)
            WHERE calculation_id IS NOT NULL;

        ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.generated_documents CASCADE;")

    # Recreate ai_worker.documents
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_worker.documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID,
            user_id TEXT NOT NULL,
            client_id TEXT,
            document_type TEXT NOT NULL,
            bucket TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            filename TEXT NOT NULL,
            checksum_sha256 TEXT,
            size_bytes BIGINT,
            mime_type TEXT NOT NULL DEFAULT 'application/pdf',
            metadata JSONB,
            linked_document_id UUID REFERENCES ai_worker.documents(id)
                ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_ai_worker_documents_job_id
                FOREIGN KEY (job_id) REFERENCES ai_worker.jobs(id)
                ON DELETE SET NULL,
            CONSTRAINT uq_ai_worker_documents_bucket_path
                UNIQUE (bucket, storage_path)
        );

        CREATE INDEX IF NOT EXISTS ix_ai_worker_documents_user_id_created_at
            ON ai_worker.documents(user_id, created_at);

        ALTER TABLE ai_worker.documents ENABLE ROW LEVEL SECURITY;
    """)

    # Recreate calc_engine.documents
    op.execute("""
        CREATE TABLE IF NOT EXISTS calc_engine.documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            calculation_id UUID,
            user_id TEXT NOT NULL,
            client_id TEXT,
            document_type TEXT NOT NULL,
            bucket TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            filename TEXT NOT NULL,
            checksum_sha256 TEXT,
            size_bytes BIGINT,
            mime_type TEXT NOT NULL DEFAULT 'application/pdf',
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_calc_engine_documents_calculation_id
                FOREIGN KEY (calculation_id)
                REFERENCES calc_engine.calculations(id)
                ON DELETE SET NULL,
            CONSTRAINT uq_calc_engine_documents_bucket_path
                UNIQUE (bucket, storage_path)
        );

        CREATE INDEX IF NOT EXISTS ix_calc_engine_documents_user_id_created_at
            ON calc_engine.documents(user_id, created_at);

        ALTER TABLE calc_engine.documents ENABLE ROW LEVEL SECURITY;
    """)
