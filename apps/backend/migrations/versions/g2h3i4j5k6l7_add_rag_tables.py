"""add_rag_tables

Revision ID: b7v8w9x0y1z2
Revises: a6u7v8w9x0y1
Create Date: 2026-03-15 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g2h3i4j5k6l7"
down_revision: Union[str, None] = "f1g2h3i4j5k6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE EXTENSION IF NOT EXISTS vector;

        -- Taxonomia: áreas do direito
        CREATE TABLE public.legal_areas (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- Taxonomia: tópicos dentro de cada área
        CREATE TABLE public.legal_topics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            area_id UUID NOT NULL REFERENCES public.legal_areas(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            keywords TEXT[] DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(area_id, slug)
        );

        -- Documentos RAG
        CREATE TABLE public.rag_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            uploaded_by UUID REFERENCES auth.users(id),
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            bucket TEXT NOT NULL DEFAULT 'documents',
            document_type TEXT NOT NULL DEFAULT 'lei_avulsa',
            is_compound BOOLEAN DEFAULT false,
            total_chunks INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            error_message TEXT,
            area_id UUID REFERENCES public.legal_areas(id),
            topic_id UUID REFERENCES public.legal_topics(id),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- Chunks com embeddings
        CREATE TABLE public.rag_chunks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id UUID NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            section_title TEXT,
            area TEXT NOT NULL,
            tema TEXT,
            legislacao TEXT,
            artigo TEXT,
            chunk_index INTEGER NOT NULL,
            embedding vector(768),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_rag_chunks_area ON public.rag_chunks(area);
        CREATE INDEX idx_rag_chunks_legislacao ON public.rag_chunks(legislacao);
        CREATE INDEX idx_rag_chunks_document ON public.rag_chunks(document_id);

        -- Keywords para roteamento Stage 1
        CREATE TABLE public.rag_keywords (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            area TEXT NOT NULL,
            tema TEXT NOT NULL,
            keywords TEXT[] NOT NULL,
            UNIQUE(area, tema)
        );

        -- Seed: áreas jurídicas iniciais
        INSERT INTO public.legal_areas (name, slug) VALUES
            ('Direito Trabalhista', 'trabalhista'),
            ('Direito Previdenciário', 'previdenciario'),
            ('Direito Civil', 'civil'),
            ('Direito Processual Civil', 'processual-civil'),
            ('Direito do Consumidor', 'consumidor'),
            ('Direito Constitucional', 'constitucional'),
            ('Direito Penal', 'penal'),
            ('Direito Administrativo', 'administrativo');
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS public.rag_keywords;
        DROP TABLE IF EXISTS public.rag_chunks;
        DROP TABLE IF EXISTS public.rag_documents;
        DROP TABLE IF EXISTS public.legal_topics;
        DROP TABLE IF EXISTS public.legal_areas;
    """)
