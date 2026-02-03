"""create_calculators_endpoints_table

Revision ID: ae0bcbb66f5a
Revises: 07030ed5ff07
Create Date: 2026-02-03 14:45:06.412021

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ae0bcbb66f5a"
down_revision: Union[str, None] = "07030ed5ff07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create schema if not exists
    op.execute("CREATE SCHEMA IF NOT EXISTS calc_engine;")

    # Create calculators table
    op.execute("""
        CREATE TABLE IF NOT EXISTS calc_engine.calculators (
            key TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            description TEXT,
            icon TEXT DEFAULT 'Calculator',
            path TEXT NOT NULL,
            display_order INTEGER DEFAULT 0,
            is_locked BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    """)

    # Insert existing calculators
    op.execute("""
        INSERT INTO calc_engine.calculators
        (key, display_name, description, icon, path, display_order, is_locked)
        VALUES
        ('rescisao', 'Rescisão Trabalhista',
         'Cálculo de verbas rescisórias e direitos trabalhistas.',
         'Calculator', '/app/calculadoras/rescisao', 0, false),
        ('aposentadoria', 'Aposentadoria',
         'Simulação de tempo de contribuição e aposentadoria.',
         'CalendarClock', '/app/calculadoras/aposentadoria', 1, true),
        ('correcao_monetaria', 'Correção Monetária',
         'Cálculo de correção monetária e atualização de valores.',
         'TrendingUp', '/app/calculadoras/correcao-monetaria', 2, true),
        ('honorarios', 'Honorários Advocatícios',
         'Cálculo de honorários advocatícios conforme tabela OAB.',
         'DollarSign', '/app/calculadoras/honorarios', 3, true),
        ('juros', 'Juros e Multa',
         'Cálculo de juros e multa sobre débitos.',
         'Percent', '/app/calculadoras/juros', 4, true)
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS calc_engine.calculators;")
    op.execute("DROP SCHEMA IF EXISTS calc_engine CASCADE;")
