"""create_notification_logs_table

Tracks all outbound notifications (email, WhatsApp) with delivery status.
Used by admin panel for monitoring notification delivery.

Revision ID: e0y1z2a3b4c5
Revises: d9x0y1z2a3b4
Create Date: 2026-03-15 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e0y1z2a3b4c5"
down_revision: Union[str, None] = "d9x0y1z2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE public.notification_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            channel TEXT NOT NULL,
            recipient TEXT NOT NULL,
            notification_type TEXT NOT NULL,
            subject TEXT,
            status TEXT NOT NULL DEFAULT 'sent',
            external_id TEXT,
            error_message TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_notification_logs_user_id ON public.notification_logs(user_id);
        CREATE INDEX idx_notification_logs_channel ON public.notification_logs(channel);
        CREATE INDEX idx_notification_logs_status ON public.notification_logs(status);
        CREATE INDEX idx_notification_logs_created_at ON public.notification_logs(created_at DESC);
        CREATE INDEX idx_notification_logs_external_id ON public.notification_logs(external_id)
            WHERE external_id IS NOT NULL;

        COMMENT ON TABLE public.notification_logs IS 'Tracks all outbound notifications (email, WhatsApp)';
        COMMENT ON COLUMN public.notification_logs.channel IS 'email or whatsapp';
        COMMENT ON COLUMN public.notification_logs.status IS 'sent, delivered, read, failed, queued';
        COMMENT ON COLUMN public.notification_logs.external_id IS 'Twilio SID or SendGrid message ID';
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.notification_logs;")
