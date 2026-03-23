"""Drop old 3-param grant_credits_to_user overload

The function grant_credits_to_user was originally created with 3 parameters
(p_user_id, p_amount, p_reason). A later migration added a 4-param version
with p_credit_type, but CREATE OR REPLACE with a different signature creates
an overload instead of replacing. This causes PostgREST PGRST203 ambiguity
errors when calling with default parameters.

This migration drops the old 3-param overload, keeping only the 4-param version.

Revision ID: y4s5t6u7v8w9
Revises: simplify_credits_table
Create Date: 2026-02-26 14:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "y4s5t6u7v8w9"
down_revision = "simplify_credits_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop only the old 3-param overload by specifying its exact signature
    op.execute("DROP FUNCTION IF EXISTS public.grant_credits_to_user(UUID, INTEGER, TEXT)")


def downgrade() -> None:
    # Recreate the old 3-param overload (from the original migration)
    op.execute("""
        CREATE OR REPLACE FUNCTION public.grant_credits_to_user(
            p_user_id UUID,
            p_amount INTEGER,
            p_reason TEXT DEFAULT 'subscription_grant'
        ) RETURNS void AS $$
        BEGIN
            INSERT INTO public.user_credits (
                user_id, subscription_credits, last_reset_at
            )
            VALUES (p_user_id, p_amount, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                subscription_credits = COALESCE(
                    public.user_credits.subscription_credits, 0
                ) + p_amount,
                last_reset_at = NOW(),
                updated_at = NOW();

            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason, credit_type
            )
            VALUES (p_user_id, p_amount, 'grant', p_reason, 'subscription');
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)
