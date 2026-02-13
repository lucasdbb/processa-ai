"""add_timeline_fees_notes_tables

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-02-04 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Timeline Events Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.timeline_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id)
                ON DELETE CASCADE,
            process_id UUID NOT NULL REFERENCES office_api.processes(id)
                ON DELETE CASCADE,
            event_type TEXT NOT NULL DEFAULT 'other'
                CHECK (event_type IN (
                    'creation', 'update', 'deadline', 'document', 'note',
                    'status_change', 'hearing', 'petition', 'decision',
                    'citation', 'other'
                )),
            title TEXT NOT NULL,
            description TEXT,
            event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_timeline_user
            ON office_api.timeline_events(user_id, event_date DESC);
        CREATE INDEX IF NOT EXISTS idx_timeline_process
            ON office_api.timeline_events(process_id, event_date DESC);
        CREATE INDEX IF NOT EXISTS idx_timeline_event_type
            ON office_api.timeline_events(event_type, event_date DESC);

        ALTER TABLE office_api.timeline_events ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own timeline events"
            ON office_api.timeline_events FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can create own timeline events"
            ON office_api.timeline_events FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own timeline events"
            ON office_api.timeline_events FOR UPDATE
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own timeline events"
            ON office_api.timeline_events FOR DELETE
            USING (auth.uid() = user_id);

        CREATE TRIGGER update_timeline_events_updated_at
            BEFORE UPDATE ON office_api.timeline_events
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();
    """)

    # 2. Fees/Honorários Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.fees (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id)
                ON DELETE CASCADE,
            client_id UUID NOT NULL REFERENCES office_api.clients(id)
                ON DELETE CASCADE,
            process_id UUID REFERENCES office_api.processes(id)
                ON DELETE SET NULL,
            fee_type TEXT NOT NULL DEFAULT 'other'
                CHECK (fee_type IN (
                    'initial', 'success', 'monthly', 'hourly',
                    'hearing', 'petition', 'other'
                )),
            description TEXT,
            amount DECIMAL(15, 2) NOT NULL,
            paid_amount DECIMAL(15, 2) DEFAULT 0,
            due_date DATE,
            paid_date DATE,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN (
                    'pending', 'paid', 'overdue', 'cancelled', 'partial'
                )),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_fees_user
            ON office_api.fees(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_fees_client
            ON office_api.fees(client_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_fees_process
            ON office_api.fees(process_id) WHERE process_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_fees_status
            ON office_api.fees(status, due_date)
            WHERE status IN ('pending', 'overdue');
        CREATE INDEX IF NOT EXISTS idx_fees_due_date
            ON office_api.fees(due_date)
            WHERE status = 'pending';

        ALTER TABLE office_api.fees ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own fees"
            ON office_api.fees FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can create own fees"
            ON office_api.fees FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own fees"
            ON office_api.fees FOR UPDATE
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own fees"
            ON office_api.fees FOR DELETE
            USING (auth.uid() = user_id);

        CREATE TRIGGER update_fees_updated_at
            BEFORE UPDATE ON office_api.fees
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();
    """)

    # 3. Notes/Anotacoes Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id)
                ON DELETE CASCADE,
            client_id UUID REFERENCES office_api.clients(id)
                ON DELETE CASCADE,
            process_id UUID REFERENCES office_api.processes(id)
                ON DELETE CASCADE,
            note_type TEXT NOT NULL DEFAULT 'general'
                CHECK (note_type IN (
                    'general', 'meeting', 'call', 'email', 'task',
                    'internal', 'strategy', 'research', 'other'
                )),
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            is_pinned BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_notes_user
            ON office_api.notes(user_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notes_client
            ON office_api.notes(client_id, updated_at DESC)
            WHERE client_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_notes_process
            ON office_api.notes(process_id, updated_at DESC)
            WHERE process_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_notes_pinned
            ON office_api.notes(user_id, is_pinned, updated_at DESC)
            WHERE is_pinned = true;
        CREATE INDEX IF NOT EXISTS idx_notes_type
            ON office_api.notes(note_type, updated_at DESC);

        ALTER TABLE office_api.notes ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own notes"
            ON office_api.notes FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can create own notes"
            ON office_api.notes FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own notes"
            ON office_api.notes FOR UPDATE
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own notes"
            ON office_api.notes FOR DELETE
            USING (auth.uid() = user_id);

        CREATE TRIGGER update_notes_updated_at
            BEFORE UPDATE ON office_api.notes
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS office_api.notes CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.fees CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.timeline_events CASCADE")
