"""add_clients_processes_deadlines_tables

Revision ID: 95ad7c07de0e
Revises: 5274a6fa336b
Create Date: 2026-01-31 01:22:43.316996

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "95ad7c07de0e"
down_revision: Union[str, None] = "5274a6fa336b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create schema if not exists
    op.execute("CREATE SCHEMA IF NOT EXISTS office_api")

    # 1. Clients Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.clients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id)
                ON DELETE CASCADE,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            cpf_cnpj TEXT,
            address TEXT,
            city TEXT,
            state TEXT,
            zip_code TEXT,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'archived')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_clients_user
            ON office_api.clients(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_clients_status
            ON office_api.clients(status) WHERE status = 'active';
        CREATE INDEX IF NOT EXISTS idx_clients_name
            ON office_api.clients(user_id, name);

        ALTER TABLE office_api.clients ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own clients"
            ON office_api.clients FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can create own clients"
            ON office_api.clients FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own clients"
            ON office_api.clients FOR UPDATE
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own clients"
            ON office_api.clients FOR DELETE
            USING (auth.uid() = user_id);

        CREATE TRIGGER update_clients_updated_at
            BEFORE UPDATE ON office_api.clients
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();
    """)

    # 2. Processes Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.processes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id)
                ON DELETE CASCADE,
            client_id UUID NOT NULL REFERENCES office_api.clients(id)
                ON DELETE CASCADE,
            process_number TEXT NOT NULL,
            court TEXT,
            defendant TEXT,
            type TEXT NOT NULL,
            subject TEXT,
            value DECIMAL(15, 2),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'pending', 'suspended', 'archived',
                    'concluded', 'cancelled')),
            notes TEXT,
            start_date DATE,
            end_date DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_processes_user
            ON office_api.processes(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_processes_client
            ON office_api.processes(client_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_processes_status
            ON office_api.processes(status) WHERE status = 'active';
        CREATE INDEX IF NOT EXISTS idx_processes_number
            ON office_api.processes(process_number);

        ALTER TABLE office_api.processes ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own processes"
            ON office_api.processes FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can create own processes"
            ON office_api.processes FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own processes"
            ON office_api.processes FOR UPDATE
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own processes"
            ON office_api.processes FOR DELETE
            USING (auth.uid() = user_id);

        CREATE TRIGGER update_processes_updated_at
            BEFORE UPDATE ON office_api.processes
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();
    """)

    # 3. Deadlines Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.deadlines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id)
                ON DELETE CASCADE,
            process_id UUID NOT NULL REFERENCES office_api.processes(id)
                ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            due_date DATE NOT NULL,
            priority TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'cancelled')),
            completed_at TIMESTAMPTZ,
            reminder_days_before INTEGER DEFAULT 3,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_deadlines_user
            ON office_api.deadlines(user_id, due_date);
        CREATE INDEX IF NOT EXISTS idx_deadlines_process
            ON office_api.deadlines(process_id, due_date);
        CREATE INDEX IF NOT EXISTS idx_deadlines_status
            ON office_api.deadlines(status, due_date)
            WHERE status = 'pending';
        CREATE INDEX IF NOT EXISTS idx_deadlines_due_date
            ON office_api.deadlines(due_date)
            WHERE status = 'pending';
        CREATE INDEX IF NOT EXISTS idx_deadlines_priority
            ON office_api.deadlines(priority, due_date)
            WHERE status = 'pending';

        ALTER TABLE office_api.deadlines ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own deadlines"
            ON office_api.deadlines FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can create own deadlines"
            ON office_api.deadlines FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own deadlines"
            ON office_api.deadlines FOR UPDATE
            USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own deadlines"
            ON office_api.deadlines FOR DELETE
            USING (auth.uid() = user_id);

        CREATE TRIGGER update_deadlines_updated_at
            BEFORE UPDATE ON office_api.deadlines
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS office_api.deadlines CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.processes CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.clients CASCADE")
