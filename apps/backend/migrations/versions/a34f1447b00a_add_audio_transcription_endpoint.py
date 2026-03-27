"""add_audio_transcription_endpoint

Revision ID: a34f1447b00a
Revises: k6l7m8n9o0p1
Create Date: 2026-03-27 19:38:52.499139

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a34f1447b00a'
down_revision: Union[str, None] = 'k6l7m8n9o0p1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO public.ai_endpoints
        (key, path, display_name, description, icon, variant, display_order, is_locked)
        VALUES
        ('audio_transcription', '/api/ai/analyses/audio-transcription', 'Transcrição de Áudio',
         'Transcreva áudios de audiências, depoimentos e reuniões com IA',
         'Mic', 'audio_transcription', 70, false)
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DELETE FROM public.ai_endpoints WHERE key = 'audio_transcription';")
