"""consolidate_schemas_into_public

Move todas as tabelas de ai_worker e calc_engine para public schema,
com nomes prefixados para evitar colisão:

- ai_worker.endpoints     → public.ai_endpoints
- ai_worker.jobs          → public.ai_jobs
- ai_worker.job_events    → public.ai_job_events
- calc_engine.calculators → public.calculators
- calc_engine.calculations→ public.calculations

Também atualiza as FKs de public.generated_documents.

Revision ID: p5j6k7l8m9n0
Revises: o4i5j6k7l8m9
Create Date: 2026-02-17 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p5j6k7l8m9n0"
down_revision: Union[str, None] = "o4i5j6k7l8m9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Rename tables into public schema with new names
    op.execute("ALTER TABLE ai_worker.endpoints SET SCHEMA public;")
    op.execute("ALTER TABLE public.endpoints RENAME TO ai_endpoints;")

    op.execute("ALTER TABLE ai_worker.job_events SET SCHEMA public;")
    op.execute("ALTER TABLE public.job_events RENAME TO ai_job_events;")

    op.execute("ALTER TABLE ai_worker.jobs SET SCHEMA public;")
    op.execute("ALTER TABLE public.jobs RENAME TO ai_jobs;")

    op.execute("ALTER TABLE calc_engine.calculations SET SCHEMA public;")

    op.execute("ALTER TABLE calc_engine.calculators SET SCHEMA public;")

    # 2. Update generated_documents FKs to point to new table names
    op.execute("""
        ALTER TABLE public.generated_documents
            DROP CONSTRAINT IF EXISTS generated_documents_job_id_fkey;
    """)
    op.execute("""
        ALTER TABLE public.generated_documents
            ADD CONSTRAINT generated_documents_job_id_fkey
            FOREIGN KEY (job_id) REFERENCES public.ai_jobs(id) ON DELETE SET NULL;
    """)

    op.execute("""
        ALTER TABLE public.generated_documents
            DROP CONSTRAINT IF EXISTS generated_documents_calculation_id_fkey;
    """)
    op.execute("""
        ALTER TABLE public.generated_documents
            ADD CONSTRAINT generated_documents_calculation_id_fkey
            FOREIGN KEY (calculation_id) REFERENCES public.calculations(id) ON DELETE SET NULL;
    """)

    # 3. Update ai_job_events FK to point to ai_jobs
    op.execute("""
        ALTER TABLE public.ai_job_events
            DROP CONSTRAINT IF EXISTS job_events_job_id_fkey;
    """)
    op.execute("""
        ALTER TABLE public.ai_job_events
            ADD CONSTRAINT ai_job_events_job_id_fkey
            FOREIGN KEY (job_id) REFERENCES public.ai_jobs(id) ON DELETE CASCADE;
    """)

    # 4. Drop empty schemas
    op.execute("DROP SCHEMA IF EXISTS ai_worker CASCADE;")
    op.execute("DROP SCHEMA IF EXISTS calc_engine CASCADE;")


def downgrade() -> None:
    # Recreate schemas
    op.execute("CREATE SCHEMA IF NOT EXISTS ai_worker;")
    op.execute("CREATE SCHEMA IF NOT EXISTS calc_engine;")

    # Move tables back
    op.execute("ALTER TABLE public.ai_endpoints RENAME TO endpoints;")
    op.execute("ALTER TABLE public.endpoints SET SCHEMA ai_worker;")

    op.execute("ALTER TABLE public.ai_job_events RENAME TO job_events;")
    op.execute("ALTER TABLE public.job_events SET SCHEMA ai_worker;")

    op.execute("ALTER TABLE public.ai_jobs RENAME TO jobs;")
    op.execute("ALTER TABLE public.jobs SET SCHEMA ai_worker;")

    op.execute("ALTER TABLE public.calculations SET SCHEMA calc_engine;")

    op.execute("ALTER TABLE public.calculators SET SCHEMA calc_engine;")

    # Restore FKs on generated_documents
    op.execute("""
        ALTER TABLE public.generated_documents
            DROP CONSTRAINT IF EXISTS generated_documents_job_id_fkey;
    """)
    op.execute("""
        ALTER TABLE public.generated_documents
            ADD CONSTRAINT generated_documents_job_id_fkey
            FOREIGN KEY (job_id) REFERENCES ai_worker.jobs(id) ON DELETE SET NULL;
    """)

    op.execute("""
        ALTER TABLE public.generated_documents
            DROP CONSTRAINT IF EXISTS generated_documents_calculation_id_fkey;
    """)
    op.execute("""
        ALTER TABLE public.generated_documents
            ADD CONSTRAINT generated_documents_calculation_id_fkey
            FOREIGN KEY (calculation_id) REFERENCES calc_engine.calculations(id) ON DELETE SET NULL;
    """)

    # Restore ai_job_events FK
    op.execute("""
        ALTER TABLE ai_worker.job_events
            DROP CONSTRAINT IF EXISTS ai_job_events_job_id_fkey;
    """)
    op.execute("""
        ALTER TABLE ai_worker.job_events
            ADD CONSTRAINT job_events_job_id_fkey
            FOREIGN KEY (job_id) REFERENCES ai_worker.jobs(id) ON DELETE CASCADE;
    """)
