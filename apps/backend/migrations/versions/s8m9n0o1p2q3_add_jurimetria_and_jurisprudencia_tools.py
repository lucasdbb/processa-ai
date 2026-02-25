"""add_jurimetria_and_jurisprudencia_tools

Add two new AI tool cards (locked/inactive) for Jurimetria (predictive
analytics) and Jurisprudência (case-law search).

Revision ID: s8m9n0o1p2q3
Revises: r7l8m9n0o1p2
Create Date: 2026-02-18 22:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "s8m9n0o1p2q3"
down_revision: Union[str, None] = "r7l8m9n0o1p2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO public.ai_endpoints
            (
                key,
                path,
                display_name,
                description,
                icon,
                variant,
                display_order,
                is_locked,
                is_active
            )
        VALUES
            (
                'jurimetria',
                '/api/v1/ai/jurimetria',
                'Jurimetria',
                'Análise preditiva de processos judiciais. Descubra probabilidade de êxito, '
                'tempo estimado e valores médios de condenação\n'
                'com base em dados reais de tribunais.',
                'ChartColumn',
                'prompt',
                6,
                true,
                false
            ),
            (
                'jurisprudencia',
                '/api/v1/ai/jurisprudencia',
                'Pesquisa de Jurisprudência',
                'Busca inteligente de jurisprudência. A IA encontra decisões para o seu caso\n'
                'e resume os pontos-chave de cada acórdão.',
                'BookOpen',
                'prompt',
                7,
                true,
                false
            )
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM public.ai_endpoints
        WHERE key IN ('jurimetria', 'jurisprudencia');
    """)
