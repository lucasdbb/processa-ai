"""add_timeline_translations

Revision ID: 978d770ae76f
Revises: j5k6l7m8n9o0
Create Date: 2026-03-17 10:31:51.911293

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '978d770ae76f'
down_revision: Union[str, None] = 'j5k6l7m8n9o0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE office_api.timeline_translations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            timeline_event_id UUID NOT NULL UNIQUE
                REFERENCES office_api.timeline_events(id) ON DELETE CASCADE,
            summary TEXT NOT NULL,
            explanation TEXT NOT NULL,
            action_required TEXT NOT NULL,
            next_step TEXT,
            sentiment TEXT NOT NULL DEFAULT 'neutral',
            process_phase TEXT,
            process_phase_progress SMALLINT,
            model TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_timeline_translations_event
            ON office_api.timeline_translations(timeline_event_id);

        ALTER TABLE office_api.timeline_translations ENABLE ROW LEVEL SECURITY;

        -- Lawyer (owner of the timeline event) can read translations
        CREATE POLICY "owner_access" ON office_api.timeline_translations
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM office_api.timeline_events te
                    WHERE te.id = timeline_event_id
                      AND te.user_id = auth.uid()
                )
            );

        -- Portal client can read translations for processes they are linked to
        CREATE POLICY "portal_client_access" ON office_api.timeline_translations
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM office_api.timeline_events te
                    JOIN office_api.processes p ON p.id = te.process_id
                    JOIN office_api.clients c ON c.id = p.client_id
                    WHERE te.id = timeline_event_id
                      AND c.portal_user_id = auth.uid()
                )
            );
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS office_api.timeline_translations;
    """)
