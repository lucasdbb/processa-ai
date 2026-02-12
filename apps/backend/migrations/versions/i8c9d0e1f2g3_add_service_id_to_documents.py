"""add service_id to documents table

Revision ID: i8c9d0e1f2g3
Revises: h7b8c9d0e1f2
Create Date: 2026-02-10 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "i8c9d0e1f2g3"
down_revision: Union[str, None] = "h7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.documents
        ADD COLUMN service_id UUID REFERENCES office_api.services(id)
        ON DELETE CASCADE;

        CREATE INDEX idx_documents_service_id
        ON office_api.documents(service_id)
        WHERE service_id IS NOT NULL;

        -- Constraint: documento pertence a processo OU serviço (não ambos)
        ALTER TABLE office_api.documents
        ADD CONSTRAINT chk_documents_single_parent
        CHECK (
            (process_id IS NOT NULL AND service_id IS NULL) OR
            (process_id IS NULL AND service_id IS NOT NULL) OR
            (process_id IS NULL AND service_id IS NULL)
        );
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE office_api.documents DROP CONSTRAINT chk_documents_single_parent;
        DROP INDEX IF EXISTS idx_documents_service_id;
        ALTER TABLE office_api.documents DROP COLUMN service_id;
    """)
