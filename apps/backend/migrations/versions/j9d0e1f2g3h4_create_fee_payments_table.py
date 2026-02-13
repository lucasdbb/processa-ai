"""Create fee_payments table

Revision ID: j9d0e1f2g3h4
Revises: add_service_id_fees
Create Date: 2026-02-12

This migration creates the fee_payments table to track individual payments
made towards fees, providing a complete payment history.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "j9d0e1f2g3h4"
down_revision: Union[str, None] = "add_service_id_fees"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create fee_payments table."""
    op.execute("""
        -- Create fee_payments table
        CREATE TABLE IF NOT EXISTS office_api.fee_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            fee_id UUID NOT NULL REFERENCES office_api.fees(id) ON DELETE CASCADE,
            amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
            payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
            payment_method VARCHAR(50),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_fee_payments_user
        ON office_api.fee_payments(user_id);

        CREATE INDEX IF NOT EXISTS idx_fee_payments_fee
        ON office_api.fee_payments(fee_id);

        CREATE INDEX IF NOT EXISTS idx_fee_payments_date
        ON office_api.fee_payments(payment_date DESC);

        -- Enable RLS
        ALTER TABLE office_api.fee_payments ENABLE ROW LEVEL SECURITY;

        -- Create RLS policy
        CREATE POLICY fee_payments_user_isolation ON office_api.fee_payments
        FOR ALL
        USING (user_id = auth.uid());
    """)


def downgrade() -> None:
    """Drop fee_payments table."""
    op.execute("""
        -- Drop RLS policy
        DROP POLICY IF EXISTS fee_payments_user_isolation ON office_api.fee_payments;

        -- Drop indexes
        DROP INDEX IF EXISTS office_api.idx_fee_payments_date;
        DROP INDEX IF EXISTS office_api.idx_fee_payments_fee;
        DROP INDEX IF EXISTS office_api.idx_fee_payments_user;

        -- Drop table
        DROP TABLE IF EXISTS office_api.fee_payments;
    """)
