"""add_services_table

Revision ID: h7b8c9d0e1f2
Revises: g6a7b8c9d0e1
Create Date: 2026-02-10 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h7b8c9d0e1f2"
down_revision: Union[str, None] = "g6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.services (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id)
                ON DELETE CASCADE,
            client_id UUID NOT NULL REFERENCES office_api.clients(id)
                ON DELETE CASCADE,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'outro'
                CHECK (category IN (
                    'previdenciario', 'trabalhista', 'civel', 'tributario',
                    'familiar', 'empresarial', 'imobiliario', 'administrativo',
                    'consultoria', 'outro'
                )),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'cancelled')),
            value DECIMAL(15, 2),
            paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_services_user_client
            ON office_api.services (user_id, client_id);
        CREATE INDEX IF NOT EXISTS idx_services_user_status
            ON office_api.services (user_id, status);

        -- Updated_at trigger
        CREATE TRIGGER set_services_updated_at
            BEFORE UPDATE ON office_api.services
            FOR EACH ROW
            EXECUTE FUNCTION office_api.update_updated_at_column();

        -- Row Level Security
        ALTER TABLE office_api.services ENABLE ROW LEVEL SECURITY;

        CREATE POLICY services_select_policy ON office_api.services
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY services_insert_policy ON office_api.services
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY services_update_policy ON office_api.services
            FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY services_delete_policy ON office_api.services
            FOR DELETE USING (auth.uid() = user_id);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS office_api.services CASCADE;
    """)
