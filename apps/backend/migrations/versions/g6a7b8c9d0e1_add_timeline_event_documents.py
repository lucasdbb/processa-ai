"""add timeline_event_documents association table

Revision ID: g6a7b8c9d0e1
Revises: a1b2c3d4e5f6
Create Date: 2026-02-08 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g6a7b8c9d0e1"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create timeline_event_documents association table (many-to-many)
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.timeline_event_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            timeline_event_id UUID NOT NULL REFERENCES office_api.timeline_events(id)
                ON DELETE CASCADE,
            document_id UUID NOT NULL REFERENCES office_api.documents(id)
                ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(timeline_event_id, document_id)
        );

        CREATE INDEX IF NOT EXISTS idx_timeline_event_documents_event
            ON office_api.timeline_event_documents(timeline_event_id);
        CREATE INDEX IF NOT EXISTS idx_timeline_event_documents_document
            ON office_api.timeline_event_documents(document_id);

        ALTER TABLE office_api.timeline_event_documents ENABLE ROW LEVEL SECURITY;

        -- Users can view associations if they own the timeline event
        CREATE POLICY "Users can view own timeline event documents"
            ON office_api.timeline_event_documents FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM office_api.timeline_events te
                    WHERE te.id = timeline_event_id AND te.user_id = auth.uid()
                )
            );

        -- Users can create associations if they own the timeline event
        CREATE POLICY "Users can create own timeline event documents"
            ON office_api.timeline_event_documents FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM office_api.timeline_events te
                    WHERE te.id = timeline_event_id AND te.user_id = auth.uid()
                )
            );

        -- Users can delete associations if they own the timeline event
        CREATE POLICY "Users can delete own timeline event documents"
            ON office_api.timeline_event_documents FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM office_api.timeline_events te
                    WHERE te.id = timeline_event_id AND te.user_id = auth.uid()
                )
            );
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS office_api.timeline_event_documents CASCADE")
