"""drop_deadlines_event_reminders_material_downloads

Remove tabelas não utilizadas pelo código runtime:
- office_api.deadlines: substituída por office_api.events (event_type='prazo')
- office_api.event_reminders: nunca usada, lembretes são via cron + notifications
- public.material_downloads: nunca usada, download_count em materials é suficiente

Revision ID: n3h4i5j6k7l8
Revises: m2g3h4i5j6k7
Create Date: 2026-02-17 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "n3h4i5j6k7l8"
down_revision: Union[str, None] = "m2g3h4i5j6k7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop office_api.deadlines (data already migrated to events)
    op.execute("DROP TABLE IF EXISTS office_api.deadlines CASCADE;")

    # 2. Drop office_api.event_reminders (unused, reminders handled via cron)
    op.execute("DROP TABLE IF EXISTS office_api.event_reminders CASCADE;")

    # 3. Drop public.material_downloads and its trigger/function
    op.execute("DROP TRIGGER IF EXISTS increment_downloads_trigger ON public.material_downloads;")
    op.execute("DROP TABLE IF EXISTS public.material_downloads CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS public.increment_material_download_count() CASCADE;")


def downgrade() -> None:
    # 1. Recreate office_api.deadlines
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.deadlines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id)
                ON DELETE CASCADE,
            process_id UUID NOT NULL REFERENCES office_api.processes(id)
                ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            due_date TIMESTAMPTZ NOT NULL,
            priority TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'cancelled')),
            completed_at TIMESTAMPTZ,
            reminder_days_before INTEGER DEFAULT 3,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_deadlines_user
            ON office_api.deadlines(user_id, due_date);
        CREATE INDEX IF NOT EXISTS idx_deadlines_process
            ON office_api.deadlines(process_id, due_date);
        CREATE INDEX IF NOT EXISTS idx_deadlines_status
            ON office_api.deadlines(status, due_date)
            WHERE status = 'pending';
        CREATE INDEX IF NOT EXISTS idx_deadlines_due_date
            ON office_api.deadlines(due_date)
            WHERE status = 'pending';
        CREATE INDEX IF NOT EXISTS idx_deadlines_priority
            ON office_api.deadlines(priority, due_date)
            WHERE status = 'pending';

        ALTER TABLE office_api.deadlines ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own deadlines"
            ON office_api.deadlines FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can create own deadlines"
            ON office_api.deadlines FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own deadlines"
            ON office_api.deadlines FOR UPDATE
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own deadlines"
            ON office_api.deadlines FOR DELETE
            USING (auth.uid() = user_id);

        CREATE TRIGGER update_deadlines_updated_at
            BEFORE UPDATE ON office_api.deadlines
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();
    """)

    # 2. Recreate office_api.event_reminders
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.event_reminders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            event_id UUID NOT NULL REFERENCES office_api.events(id) ON DELETE CASCADE,
            remind_at TIMESTAMPTZ NOT NULL,
            channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'push', 'both')),
            sent_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_event_reminders_remind_at
            ON office_api.event_reminders(remind_at) WHERE sent_at IS NULL;

        ALTER TABLE office_api.event_reminders ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can manage own reminders"
            ON office_api.event_reminders FOR ALL
            USING (auth.uid() = user_id);
        CREATE POLICY "Service role can manage all reminders"
            ON office_api.event_reminders FOR ALL
            USING (auth.jwt() ->> 'role' = 'service_role');
    """)

    # 3. Recreate public.material_downloads with trigger
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.material_downloads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
            user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            ip_address INET,
            user_agent TEXT,
            downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_material_downloads_material
            ON public.material_downloads(material_id, downloaded_at DESC);
        CREATE INDEX IF NOT EXISTS idx_material_downloads_user
            ON public.material_downloads(user_id) WHERE user_id IS NOT NULL;

        CREATE OR REPLACE FUNCTION public.increment_material_download_count()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE public.materials
                SET download_count = download_count + 1
                WHERE id = NEW.material_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER increment_downloads_trigger
            AFTER INSERT ON public.material_downloads
            FOR EACH ROW EXECUTE FUNCTION public.increment_material_download_count();
    """)
