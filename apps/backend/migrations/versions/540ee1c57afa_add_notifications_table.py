"""add notifications table

Revision ID: 540ee1c57afa
Revises: l1f2g3h4i5j6
Create Date: 2026-02-17 02:10:31.922912

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "540ee1c57afa"
down_revision: Union[str, None] = "l1f2g3h4i5j6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notifications table
    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL DEFAULT 'system',
            title VARCHAR(255) NOT NULL,
            description TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            read BOOLEAN NOT NULL DEFAULT FALSE,
            read_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)

    # Create indexes for faster queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id
        ON notifications(user_id)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_user_read
        ON notifications(user_id, read)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at
        ON notifications(created_at DESC)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_type
        ON notifications(type)
    """)

    # Create updated_at trigger
    op.execute("""
        CREATE TRIGGER set_notifications_updated_at
        BEFORE UPDATE ON notifications
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    """)

    # Add comments to table
    op.execute("""
        COMMENT ON TABLE notifications IS (
            'User notifications for deadlines, processes, calculations, and system messages'
        )
    """)

    op.execute("""
        COMMENT ON COLUMN notifications.type IS (
            'Type of notification: deadline, process, calculation, system, blog, feature'
        )
    """)

    op.execute("""
        COMMENT ON COLUMN notifications.metadata IS (
            'Additional data (process_id, post_id, calculation_id, etc.)'
        )
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS set_notifications_updated_at ON notifications")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
