"""add_rls_chat_and_rag

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-03-16 15:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "i4j5k6l7m8n9"
down_revision: Union[str, None] = "h3i4j5k6l7m8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        -- ================================================================
        -- RAG: Taxonomia (legal_areas, legal_topics) — leitura pública
        -- ================================================================
        ALTER TABLE public.legal_areas ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "legal_areas_select" ON public.legal_areas
            FOR SELECT USING (true);

        ALTER TABLE public.legal_topics ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "legal_topics_select" ON public.legal_topics
            FOR SELECT USING (true);

        -- ================================================================
        -- RAG: Keywords — leitura pública
        -- ================================================================
        ALTER TABLE public.rag_keywords ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "rag_keywords_select" ON public.rag_keywords
            FOR SELECT USING (true);

        -- ================================================================
        -- RAG: Documentos e chunks — sem acesso direto (só service_role)
        -- ================================================================
        ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
        -- Nenhuma policy = bloqueado para anon/authenticated

        ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
        -- Nenhuma policy = bloqueado para anon/authenticated

        -- ================================================================
        -- Chat: Sessões — usuário vê apenas as suas
        -- ================================================================
        ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "chat_sessions_select_own" ON public.chat_sessions
            FOR SELECT USING (auth.uid() = user_id);

        -- ================================================================
        -- Chat: Mensagens — usuário vê apenas de suas sessões
        -- ================================================================
        ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "chat_messages_select_own" ON public.chat_messages
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.chat_sessions s
                    WHERE s.id = chat_messages.session_id
                      AND s.user_id = auth.uid()
                )
            );
    """)


def downgrade() -> None:
    op.execute("""
        -- Chat
        DROP POLICY IF EXISTS "chat_messages_select_own" ON public.chat_messages;
        ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "chat_sessions_select_own" ON public.chat_sessions;
        ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;

        -- RAG
        ALTER TABLE public.rag_chunks DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.rag_documents DISABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "rag_keywords_select" ON public.rag_keywords;
        ALTER TABLE public.rag_keywords DISABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "legal_topics_select" ON public.legal_topics;
        ALTER TABLE public.legal_topics DISABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "legal_areas_select" ON public.legal_areas;
        ALTER TABLE public.legal_areas DISABLE ROW LEVEL SECURITY;
    """)
