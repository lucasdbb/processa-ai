"""Create feedback table

Revision ID: k0e1f2g3h4i5
Revises: j9d0e1f2g3h4
Create Date: 2026-02-12

"""

from typing import Sequence, Union

from alembic import op

revision: str = "k0e1f2g3h4i5"
down_revision: Union[str, None] = "j9d0e1f2g3h4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create feedback table
    # We reference public.profiles instead of auth.users to facilitate joins with profile data (name, email)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.feedback (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            type TEXT NOT NULL CHECK (type IN ('suggestion', 'bug', 'other')),
            content TEXT NOT NULL,
            path TEXT,
            user_agent TEXT,
            status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'archived')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
        CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

        ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

        -- RLS Policies
        -- Users can create feedback
        CREATE POLICY "Users can create feedback" ON public.feedback
        FOR INSERT WITH CHECK (auth.uid() = user_id);

        -- Users can view their own feedback
        CREATE POLICY "Users can view own feedback" ON public.feedback
        FOR SELECT USING (auth.uid() = user_id);

        -- Admins can view all feedback
        CREATE POLICY "Admins can view all feedback" ON public.feedback
        FOR SELECT USING (public.is_admin());

        -- Admins can update feedback (e.g. status)
        CREATE POLICY "Admins can update feedback" ON public.feedback
        FOR UPDATE USING (public.is_admin());
        
        -- Admins can delete feedback
        CREATE POLICY "Admins can delete feedback" ON public.feedback
        FOR DELETE USING (public.is_admin());
    """)


def downgrade() -> None:
    op.execute("""
        DROP POLICY IF EXISTS "Admins can delete feedback" ON public.feedback;
        DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
        DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
        DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
        DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;
        DROP TABLE IF EXISTS public.feedback CASCADE;
    """)
