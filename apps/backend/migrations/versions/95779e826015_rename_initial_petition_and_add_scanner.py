"""rename_initial_petition_and_add_scanner

Rename 'initial_petition' endpoint to 'labor_claim' (Reclamação Trabalhista)
and add a new 'brief_scanner' endpoint for scanning legal briefs
to detect weak arguments, missing claims, and dismissal risks.

Revision ID: 95779e826015
Revises: p5j6k7l8m9n0
Create Date: 2026-02-17 19:58:35.025256

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "95779e826015"
down_revision: Union[str, None] = "p5j6k7l8m9n0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Rename initial_petition → labor_claim
    op.execute("""
        UPDATE public.ai_endpoints
        SET
            key = 'labor_claim',
            path = '/api/v1/ai/petitions/labor-claim',
            display_name = 'Reclamação Trabalhista',
            description = 'Gere uma reclamação trabalhista completa a partir dos fatos do caso.',
            icon = 'Scale',
            display_order = 3
        WHERE key = 'initial_petition';
    """)

    # 2. Insert brief_scanner endpoint
    op.execute("""
        INSERT INTO public.ai_endpoints
        (key, path, display_name, description, icon, variant, display_order, is_locked)
        VALUES
        ('brief_scanner', '/api/v1/ai/scanner/brief', 'Scanner de Peça',
         'Analise peças processuais para identificar teses frágeis, pedidos faltantes, '
         'risco de improcedência, inconsistências argumentativas e oportunidades de melhoria.',
         'ScanSearch', 'cnis', 5, true)
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    # Remove brief_scanner
    op.execute("DELETE FROM public.ai_endpoints WHERE key = 'brief_scanner';")

    # Revert labor_claim → initial_petition
    op.execute("""
        UPDATE public.ai_endpoints
        SET
            key = 'initial_petition',
            path = '/api/v1/ai/petitions/initial',
            display_name = 'Petição Inicial',
            description = 'Gere uma petição inicial a partir do seu caso.',
            icon = 'FileText',
            display_order = 3
        WHERE key = 'labor_claim';
    """)
