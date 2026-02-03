"""expand_endpoints_table_for_ui_metadata

Revision ID: 07030ed5ff07
Revises: 95d84fc0554b
Create Date: 2026-02-03 14:16:48.562131

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "07030ed5ff07"
down_revision: Union[str, None] = "95d84fc0554b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add UI metadata columns
    op.execute("""
        ALTER TABLE ai_worker.endpoints
        ADD COLUMN IF NOT EXISTS display_name TEXT,
        ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'FileText',
        ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'prompt',
        ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
    """)

    # Update existing records with correct metadata
    op.execute("""
        UPDATE ai_worker.endpoints
        SET
            display_name = 'Análise de CNIS',
            description = 'Analise vínculos, contribuições e lacunas no CNIS.',
            icon = 'FileSearch',
            variant = 'cnis',
            display_order = 0,
            is_locked = false
        WHERE key = 'cnis_analysis';

        UPDATE ai_worker.endpoints
        SET
            display_name = 'Resumo de Processos',
            description = 'Gere resumos executivos de processos judiciais.',
            icon = 'FileText',
            variant = 'cnis',
            display_order = 1,
            is_locked = false
        WHERE key = 'process_summary';
    """)

    # Insert new tools (locked for future implementation)
    op.execute("""
        INSERT INTO ai_worker.endpoints
        (key, path, display_name, description, icon, variant, display_order, is_locked)
        VALUES
        ('chat', '/api/v1/ai/chat', 'Chat Jurídico',
         'Converse com a IA para tirar dúvidas e estruturar ideias.',
         'MessageSquare', 'chat', 2, true),
        ('initial_petition', '/api/v1/ai/petitions/initial', 'Petição Inicial',
         'Gere uma petição inicial a partir do seu caso.',
         'FileText', 'prompt', 3, true),
        ('defense', '/api/v1/ai/petitions/defense', 'Contestação / Defesa',
         'Elabore contestações e defesas processuais.',
         'MessageSquare', 'prompt', 4, true)
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE ai_worker.endpoints
        DROP COLUMN IF EXISTS display_name,
        DROP COLUMN IF EXISTS icon,
        DROP COLUMN IF EXISTS variant,
        DROP COLUMN IF EXISTS display_order,
        DROP COLUMN IF EXISTS is_locked;
    """)

    op.execute("""
        DELETE FROM ai_worker.endpoints
        WHERE key IN ('chat', 'initial_petition', 'defense');
    """)
