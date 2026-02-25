"""drop_credit_costs_packages_registration_ips

Remove tabelas que foram movidas para constantes no código:
- credit_costs -> constants.py FEATURE_COSTS
- credit_packages -> constants.py CREDIT_PACKAGES
- registration_ips -> in-memory rate limiting em security.py

Revision ID: m2g3h4i5j6k7
Revises: 540ee1c57afa
Create Date: 2026-02-17 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "m2g3h4i5j6k7"
down_revision: Union[str, None] = "540ee1c57afa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop RLS policies first
    op.execute("""
        DROP POLICY IF EXISTS "Public read credit_costs" ON public.credit_costs;
        DROP POLICY IF EXISTS "Public read credit_packages" ON public.credit_packages;
    """)

    op.execute("DROP TABLE IF EXISTS public.credit_costs;")
    op.execute("DROP TABLE IF EXISTS public.credit_packages;")
    op.execute("DROP INDEX IF EXISTS idx_registration_ips_ip_date;")
    op.execute("DROP TABLE IF EXISTS public.registration_ips;")


def downgrade() -> None:
    # Recreate credit_costs
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.credit_costs (
            feature_key TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            base_cost INTEGER NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true
        );

        INSERT INTO public.credit_costs (
            feature_key, display_name, base_cost, description, is_active
        )
        VALUES
            ('ai_chat',
                'Chat IA Jurídica',
                1,
                'Cada mensagem no chat com a IA',
                true
            ),
            ('cnis_analysis',
                'Análise de CNIS',
                5,
                'Análise completa de extrato previdenciário',
                true
            ),
            ('process_summary',
                'Resumo de Processo',
                5,
                'Resumo inteligente de processo judicial',
                true
            ),
            ('calculator_rescisao',
                'Calculadora Rescisão',
                2,
                'Cálculo de rescisão trabalhista',
                true
            ),
            ('calculator_aposentadoria',
                'Calculadora Aposentadoria',
                2,
               'Simulação de aposentadoria',
               true
            )
        ON CONFLICT DO NOTHING;

        ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Public read credit_costs"
        ON public.credit_costs FOR SELECT
        USING (true);
    """)

    # Recreate credit_packages
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.credit_packages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            credits INTEGER NOT NULL,
            price_cents INTEGER NOT NULL,
            stripe_price_id TEXT,
            is_active BOOLEAN DEFAULT true,
            sort_order INTEGER DEFAULT 0
        );

        INSERT INTO public.credit_packages (name, credits, price_cents, sort_order)
        VALUES
            ('Pacote Inicial', 10, 990, 1),
            ('Pacote Intermediário', 30, 2490, 2),
            ('Pacote Profissional', 100, 7490, 3)
        ON CONFLICT DO NOTHING;

        ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Public read credit_packages"
        ON public.credit_packages FOR SELECT
        USING (true);
    """)

    # Recreate registration_ips
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.registration_ips (
            ip_address TEXT NOT NULL,
            user_id UUID REFERENCES auth.users(id),
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_registration_ips_ip_date
        ON public.registration_ips(ip_address, created_at);
    """)
