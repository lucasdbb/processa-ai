"""unify deadlines into calendar events

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2026-02-08 22:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add deadline-specific columns to office_api.events
    op.execute("""
        ALTER TABLE office_api.events
            ADD COLUMN IF NOT EXISTS priority TEXT
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            ADD COLUMN IF NOT EXISTS deadline_status TEXT
                CHECK (deadline_status IN ('pending', 'completed', 'cancelled')),
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 0;
    """)

    # 2. Create index for prazo-type events
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_events_prazo_status
            ON office_api.events(user_id, start_at)
            WHERE event_type = 'prazo' AND deadline_status = 'pending';
    """)

    # 3. Migrate existing deadlines into events table
    op.execute("""
        INSERT INTO office_api.events (
            id, user_id, calendar_id,
            title, description, location,
            start_at, end_at, all_day,
            event_type, status,
            processo_id, cliente_id, color,
            reminder_minutes, source, sync_status,
            priority, deadline_status, completed_at, reminder_days_before,
            created_at, updated_at
        )
        SELECT
            d.id,
            d.user_id,
            NULL,
            d.title,
            d.description,
            NULL,
            d.due_date,
            d.due_date + INTERVAL '1 hour',
            CASE WHEN d.due_date::time = '00:00:00' THEN TRUE ELSE FALSE END,
            'prazo',
            'confirmed',
            d.process_id,
            NULL,
            '#f59e0b',
            CASE
                WHEN d.reminder_days_before > 0
                THEN ARRAY[d.reminder_days_before * 1440]
                ELSE ARRAY[15, 60]
            END,
            'local',
            'pending_sync',
            d.priority,
            d.status,
            d.completed_at,
            d.reminder_days_before,
            d.created_at,
            d.updated_at
        FROM office_api.deadlines d
        ON CONFLICT (id) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM office_api.events
        WHERE id IN (SELECT id FROM office_api.deadlines);
    """)
    op.execute("DROP INDEX IF EXISTS office_api.idx_events_prazo_status;")
    op.execute("""
        ALTER TABLE office_api.events
            DROP COLUMN IF EXISTS priority,
            DROP COLUMN IF EXISTS deadline_status,
            DROP COLUMN IF EXISTS completed_at,
            DROP COLUMN IF EXISTS reminder_days_before;
    """)
