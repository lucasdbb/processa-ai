"""add_process_summary_endpoint

Revision ID: 95d84fc0554b
Revises: 95ad7c07de0e
Create Date: 2026-02-03 14:11:57.710784

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "95d84fc0554b"
down_revision: Union[str, None] = "95ad7c07de0e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO ai_worker.endpoints (key, path, description, n8n_workflow_id)
        VALUES (
            'process_summary',
            '/api/v1/ai/analyses/process-summary-upload',
            'Resumo de Processos',
            'process-summary'
        )
        ON CONFLICT (key) DO UPDATE SET
            path = EXCLUDED.path,
            description = EXCLUDED.description,
            n8n_workflow_id = EXCLUDED.n8n_workflow_id,
            updated_at = now();
    """)


def downgrade() -> None:
    op.execute("DELETE FROM ai_worker.endpoints WHERE key = 'process_summary'")
