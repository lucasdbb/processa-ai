"""add_source_to_timeline_events

Revision ID: f8c892b0f14d
Revises: d7e8f9a1b2c3
Create Date: 2026-03-31 21:40:38.914988

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8c892b0f14d'
down_revision: Union[str, None] = 'd7e8f9a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.timeline_events
        ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';

        CREATE INDEX IF NOT EXISTS idx_timeline_events_source_auto
            ON office_api.timeline_events (process_id, event_date DESC)
            WHERE source = 'auto';

        COMMENT ON COLUMN office_api.timeline_events.source IS
            'Origem do evento: ''manual'' = criado pelo usuário, ''auto'' = importado automaticamente';
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS office_api.idx_timeline_events_source_auto;
        ALTER TABLE office_api.timeline_events DROP COLUMN IF EXISTS source;
    """)
