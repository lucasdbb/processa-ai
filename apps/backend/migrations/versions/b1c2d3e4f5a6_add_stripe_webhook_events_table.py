"""add_stripe_webhook_events_table

Revision ID: b1c2d3e4f5a6
Revises: ae0bcbb66f5a
Create Date: 2026-02-03 15:30:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "ae0bcbb66f5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create stripe_webhook_events table for idempotency
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
            event_id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            status TEXT NOT NULL DEFAULT 'processed'
                CHECK (status IN ('processed', 'failed', 'skipped')),
            error_message TEXT,
            metadata JSONB DEFAULT '{}'::jsonb
        );

        -- Index for cleanup of old events
        CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
            ON public.stripe_webhook_events(processed_at);

        -- Index for monitoring failed events
        CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
            ON public.stripe_webhook_events(status)
            WHERE status = 'failed';

        -- Comment explaining the table purpose
        COMMENT ON TABLE public.stripe_webhook_events IS
            'Tracks processed Stripe webhook events for idempotency';
    """)

    # Create function to clean up old webhook events (keep 30 days)
    op.execute("""
        CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
        RETURNS void AS $$
        BEGIN
            DELETE FROM public.stripe_webhook_events
            WHERE processed_at < NOW() - INTERVAL '30 days';
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS public.cleanup_old_webhook_events CASCADE")
    op.execute("DROP TABLE IF EXISTS public.stripe_webhook_events CASCADE")
