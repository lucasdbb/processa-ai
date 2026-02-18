"""add_client_portal

Add portal columns to office_api.clients, extend profiles.role check
constraint to include 'office_client', and create the unique index
linking one portal login to exactly one client record.

Revision ID: t9n0o1p2q3r4
Revises: s8m9n0o1p2q3
Create Date: 2026-02-18 23:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "t9n0o1p2q3r4"
down_revision: Union[str, None] = "s8m9n0o1p2q3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add portal columns to office_api.clients
    op.execute("""
        ALTER TABLE office_api.clients
            ADD COLUMN IF NOT EXISTS portal_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS portal_invited_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS portal_status     TEXT NOT NULL DEFAULT 'not_invited'
                CHECK (portal_status IN ('not_invited', 'invited', 'active', 'revoked'));
    """)

    # 2. Unique index: one portal login maps to exactly one client
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_portal_user_id
            ON office_api.clients (portal_user_id)
            WHERE portal_user_id IS NOT NULL;
    """)

    # 3. Index for fast lookup by portal_user_id (used on every portal request)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_clients_portal_user_id
            ON office_api.clients (portal_user_id)
            WHERE portal_user_id IS NOT NULL;
    """)

    # 4. Add visible_to_client column to office_api.documents
    op.execute("""
        ALTER TABLE office_api.documents
            ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN NOT NULL DEFAULT false;
    """)

    # 5. Extend the profiles.role CHECK constraint to allow 'office_client'
    #    Drop the old constraint and recreate with the new value.
    op.execute("""
        ALTER TABLE public.profiles
            DROP CONSTRAINT IF EXISTS profiles_role_check;

        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check
            CHECK (role IN ('client', 'author', 'admin', 'office_client'));
    """)


def downgrade() -> None:
    # Revert profiles role constraint
    op.execute("""
        ALTER TABLE public.profiles
            DROP CONSTRAINT IF EXISTS profiles_role_check;

        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check
            CHECK (role IN ('client', 'author', 'admin'));
    """)

    # Remove portal indexes
    op.execute("DROP INDEX IF EXISTS office_api.uq_clients_portal_user_id;")
    op.execute("DROP INDEX IF EXISTS office_api.idx_clients_portal_user_id;")

    # Remove visible_to_client from documents
    op.execute("""
        ALTER TABLE office_api.documents
            DROP COLUMN IF EXISTS visible_to_client;
    """)

    # Remove portal columns
    op.execute("""
        ALTER TABLE office_api.clients
            DROP COLUMN IF EXISTS portal_user_id,
            DROP COLUMN IF EXISTS portal_invited_at,
            DROP COLUMN IF EXISTS portal_status;
    """)
