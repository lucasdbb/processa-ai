"""add_document_lifecycle

Adiciona sistema de lifecycle de documentos por plano:
- billing_plans.document_retention_days (NULL = permanente)
- generated_documents.expires_at
- office_api.documents.expires_at
- Backfill expires_at para documentos existentes

Revision ID: ae32439a3e58
Revises: 9269153f3956
Create Date: 2026-04-04 02:57:50.234350

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "ae32439a3e58"
down_revision: Union[str, None] = "9269153f3956"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add retention config to billing_plans (NULL = permanent)
    op.execute("""
        ALTER TABLE public.billing_plans
            ADD COLUMN IF NOT EXISTS document_retention_days INTEGER;
    """)

    # Set retention values for existing plans (NULL = permanent)
    op.execute("""
        UPDATE public.billing_plans SET document_retention_days = 2 WHERE slug = 'free';
        UPDATE public.billing_plans SET document_retention_days = 60 WHERE slug = 'student';
        UPDATE public.billing_plans SET document_retention_days = NULL WHERE slug = 'autonomo';
    """)

    # 2. Add expires_at to generated_documents
    op.execute("""
        ALTER TABLE public.generated_documents
            ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS ix_generated_documents_expires
            ON public.generated_documents(expires_at)
            WHERE expires_at IS NOT NULL;
    """)

    # 3. Add expires_at to office_api.documents
    op.execute("""
        ALTER TABLE office_api.documents
            ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS ix_office_documents_expires
            ON office_api.documents(expires_at)
            WHERE expires_at IS NOT NULL;
    """)

    # 4. Backfill expires_at for existing documents based on current plan
    op.execute("""
        UPDATE public.generated_documents gd
        SET expires_at = gd.created_at + (bp.document_retention_days || ' days')::INTERVAL
        FROM public.subscriptions s
        JOIN public.billing_plans bp ON bp.slug = s.plan_id
        WHERE gd.user_id = s.user_id::text
          AND bp.document_retention_days IS NOT NULL
          AND gd.expires_at IS NULL;
    """)

    op.execute("""
        UPDATE office_api.documents d
        SET expires_at = d.created_at + (bp.document_retention_days || ' days')::INTERVAL
        FROM public.subscriptions s
        JOIN public.billing_plans bp ON bp.slug = s.plan_id
        WHERE d.user_id = s.user_id
          AND bp.document_retention_days IS NOT NULL
          AND d.expires_at IS NULL;
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_office_documents_expires;
        ALTER TABLE office_api.documents DROP COLUMN IF EXISTS expires_at;
    """)
    op.execute("""
        DROP INDEX IF EXISTS ix_generated_documents_expires;
        ALTER TABLE public.generated_documents DROP COLUMN IF EXISTS expires_at;
    """)
    op.execute("""
        ALTER TABLE public.billing_plans DROP COLUMN IF EXISTS document_retention_days;
    """)
