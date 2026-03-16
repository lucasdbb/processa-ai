"""add_chat_tables

Revision ID: a6u7v8w9x0y1
Revises: z5t6u7v8w9x0
Create Date: 2026-03-15 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1g2h3i4j5k6"
down_revision: Union[str, None] = "e0y1z2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE public.chat_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            title TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            message_count INTEGER NOT NULL DEFAULT 0,
            max_messages INTEGER NOT NULL DEFAULT 50,
            credits_consumed INTEGER NOT NULL DEFAULT 0,
            last_message_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id);
        CREATE INDEX idx_chat_sessions_status ON public.chat_sessions(status) WHERE status = 'active';

        CREATE TABLE public.chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            token_count INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
        CREATE INDEX idx_chat_messages_created ON public.chat_messages(session_id, created_at);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS public.chat_messages;
        DROP TABLE IF EXISTS public.chat_sessions;
    """)
