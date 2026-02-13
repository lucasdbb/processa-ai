"""Add service_id to fees table

Revision ID: add_service_id_fees
Revises: c2d3e4f5a6b7
Create Date: 2026-02-12

This migration adds service_id column to the fees table to support
linking fees to services in addition to processes.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "add_service_id_fees"
down_revision: Union[str, None] = "i8c9d0e1f2g3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add service_id column to fees table."""
    op.execute("""
        -- Add service_id column
        ALTER TABLE office_api.fees
        ADD COLUMN IF NOT EXISTS service_id UUID
        REFERENCES office_api.services(id) ON DELETE CASCADE;

        -- Add index for service_id
        CREATE INDEX IF NOT EXISTS idx_fees_service
        ON office_api.fees(service_id) WHERE service_id IS NOT NULL;

        -- Add check constraint to ensure exactly one of process_id or service_id is set
        -- Note: This constraint is advisory - actual validation happens in application layer
        -- (Pydantic validator) to provide better error messages
        ALTER TABLE office_api.fees
        ADD CONSTRAINT chk_fees_process_or_service
        CHECK (
            (process_id IS NOT NULL AND service_id IS NULL) OR
            (process_id IS NULL AND service_id IS NOT NULL)
        ) NOT VALID;

        -- Validate the constraint for new rows only (NOT VALID means existing rows are not checked)
        -- This allows migration to run even if there are existing rows with both NULL
    """)


def downgrade() -> None:
    """Remove service_id column from fees table."""
    op.execute("""
        -- Drop constraint first
        ALTER TABLE office_api.fees
        DROP CONSTRAINT IF EXISTS chk_fees_process_or_service;

        -- Drop index
        DROP INDEX IF EXISTS office_api.idx_fees_service;

        -- Drop column
        ALTER TABLE office_api.fees
        DROP COLUMN IF EXISTS service_id;
    """)
