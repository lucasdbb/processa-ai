"""add_phone_verification

Revision ID: 37e3b1997c17
Revises: 85a2fbf930bd
Create Date: 2026-04-07 02:33:52.325659

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "37e3b1997c17"
down_revision: Union[str, None] = "85a2fbf930bd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        -- Tabela de verificações de telefone (OTP via SMS)
        CREATE TABLE public.phone_verifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            phone TEXT NOT NULL,
            code TEXT NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
            verified BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE INDEX idx_phone_verifications_lookup
            ON public.phone_verifications (phone, created_at DESC)
            WHERE verified = FALSE;

        CREATE INDEX idx_phone_verifications_user
            ON public.phone_verifications (user_id, created_at DESC);

        ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

        -- Novos campos em profiles
        ALTER TABLE public.profiles
            ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

        ALTER TABLE public.profiles
            ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

        -- Índice único parcial: um telefone verificado por conta
        CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_verified_unique
            ON public.profiles (phone)
            WHERE phone IS NOT NULL AND phone_verified = TRUE;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS public.idx_profiles_phone_verified_unique;

        ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_verified_at;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_verified;

        DROP TABLE IF EXISTS public.phone_verifications;
        """
    )
