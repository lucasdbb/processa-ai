"""add_status_and_enrichment_to_rag_chunks

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-03-16 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h3i4j5k6l7m8"
down_revision: Union[str, None] = "g2h3i4j5k6l7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        -- Status do artigo: vigente, revogado ou alterado
        ALTER TABLE public.rag_chunks
            ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'vigente';

        -- Referência à lei que revogou/alterou (ex: "Lei nº 13.467/2017")
        ALTER TABLE public.rag_chunks
            ADD COLUMN IF NOT EXISTS revogado_por TEXT;

        -- Resumo em linguagem moderna (gerado por LLM, para dual embedding)
        ALTER TABLE public.rag_chunks
            ADD COLUMN IF NOT EXISTS resumo TEXT;

        -- Embedding do resumo (busca semântica alternativa)
        ALTER TABLE public.rag_chunks
            ADD COLUMN IF NOT EXISTS embedding_resumo vector(768);

        -- Qualidade do chunk: 0=skip embedding, 1=normal, 2=alta relevância
        ALTER TABLE public.rag_chunks
            ADD COLUMN IF NOT EXISTS quality SMALLINT NOT NULL DEFAULT 1;

        -- Tipo do documento de origem
        ALTER TABLE public.rag_chunks
            ADD COLUMN IF NOT EXISTS tipo_documento TEXT;

        CREATE INDEX IF NOT EXISTS idx_rag_chunks_status ON public.rag_chunks(status);
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_quality ON public.rag_chunks(quality) WHERE quality > 0;

        -- rag_documents: add text-based area/legislacao for LLM classification results
        ALTER TABLE public.rag_documents
            ADD COLUMN IF NOT EXISTS area TEXT;
        ALTER TABLE public.rag_documents
            ADD COLUMN IF NOT EXISTS legislacao TEXT;

        -- rag_documents: progress tracking for real-time pipeline feedback
        ALTER TABLE public.rag_documents
            ADD COLUMN IF NOT EXISTS progress SMALLINT NOT NULL DEFAULT 0;
        ALTER TABLE public.rag_documents
            ADD COLUMN IF NOT EXISTS progress_message TEXT;
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS idx_rag_chunks_quality;
        DROP INDEX IF EXISTS idx_rag_chunks_status;
        ALTER TABLE public.rag_chunks DROP COLUMN IF EXISTS tipo_documento;
        ALTER TABLE public.rag_chunks DROP COLUMN IF EXISTS quality;
        ALTER TABLE public.rag_chunks DROP COLUMN IF EXISTS embedding_resumo;
        ALTER TABLE public.rag_chunks DROP COLUMN IF EXISTS resumo;
        ALTER TABLE public.rag_chunks DROP COLUMN IF EXISTS revogado_por;
        ALTER TABLE public.rag_chunks DROP COLUMN IF EXISTS status;

        ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS progress_message;
        ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS progress;
        ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS legislacao;
        ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS area;
    """)
