"""register_previdencia_calculators

Insere 3 novas calculadoras previdenciárias na tabela public.calculators
e atualiza a calculadora de aposentadoria existente para usar a (wizard com 6 cenários).

Revision ID: d4e5f6_prev_calc
Revises: a1b2c3_calc_ref
Create Date: 2026-04-02 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6_prev_calc"
down_revision: Union[str, None] = "a1b2c3_calc_ref"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert new standalone previdenciárias calculators
    op.execute("""
        INSERT INTO public.calculators
        (key, display_name, description, icon, path, display_order, is_locked)
        VALUES
        ('fator_previdenciario', 'Fator Previdenciário',
         'Cálculo do fator previdenciário.',
         'Percent', '/app/calculadoras/fator_previdenciario', 10, false),
        ('tempo_contribuicao', 'Tempo de Contribuição',
         'Cálculo de tempo de contribuição previdenciária.',
         'Clock', '/app/calculadoras/tempo_contribuicao', 11, false),
        ('media_salarial', 'Média Salarial',
         'Cálculo de média salarial para benefício previdenciário.',
         'BarChart3', '/app/calculadoras/media_salarial', 12, false)
        ON CONFLICT (key) DO NOTHING;
    """)

    # Update existing aposentadoria calculator: unlock + update description
    op.execute("""
        UPDATE public.calculators
        SET is_locked = false,
            display_name = 'Simulação de Aposentadoria',
            description = 'Simulação completa de aposentadoria com 6 cenários (EC 103/2019).',
            icon = 'Shield'
        WHERE key = 'aposentadoria';
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM public.calculators
        WHERE key IN (
            'fator_previdenciario',
            'tempo_contribuicao',
            'media_salarial'
        );
    """)

    op.execute("""
        UPDATE public.calculators
        SET is_locked = true,
            display_name = 'Aposentadoria',
            description = 'Simulação de tempo de contribuição e aposentadoria.',
            icon = 'CalendarClock'
        WHERE key = 'aposentadoria';
    """)
