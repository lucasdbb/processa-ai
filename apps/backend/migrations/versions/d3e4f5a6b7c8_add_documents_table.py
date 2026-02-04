"""add documents table

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-02-04 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create documents table
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            process_id UUID REFERENCES office_api.processes(id) ON DELETE CASCADE,
            client_id UUID REFERENCES office_api.clients(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'other',
            status TEXT NOT NULL DEFAULT 'draft',
            file_url TEXT,
            file_size BIGINT,
            mime_type TEXT,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # Create index on user_id and process_id for faster queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_documents_user_id ON office_api.documents(user_id)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_documents_process_id ON office_api.documents(process_id)
    """)

    # Create updated_at trigger
    op.execute("""
        CREATE TRIGGER set_documents_updated_at
        BEFORE UPDATE ON office_api.documents
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS set_documents_updated_at ON office_api.documents")
    op.execute("DROP TABLE IF EXISTS office_api.documents CASCADE")
