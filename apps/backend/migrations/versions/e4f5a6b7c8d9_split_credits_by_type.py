"""split credits by type (subscription vs purchased)

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-02-05 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alter user_credits table to split credits by type
    op.execute("""
        -- Drop the computed column first (it depends on the old columns)
        ALTER TABLE public.user_credits
            DROP COLUMN IF EXISTS available_credits;

        -- Rename existing columns to subscription-specific
        ALTER TABLE public.user_credits
            RENAME COLUMN total_credits TO subscription_credits;
        ALTER TABLE public.user_credits
            RENAME COLUMN used_credits TO subscription_used;

        -- Add purchased credits columns
        ALTER TABLE public.user_credits
            ADD COLUMN purchased_credits INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE public.user_credits
            ADD COLUMN purchased_used INTEGER NOT NULL DEFAULT 0;

        -- Add computed columns for available credits
        ALTER TABLE public.user_credits
            ADD COLUMN subscription_available INTEGER
                GENERATED ALWAYS AS (subscription_credits - subscription_used) STORED;
        ALTER TABLE public.user_credits
            ADD COLUMN purchased_available INTEGER
                GENERATED ALWAYS AS (purchased_credits - purchased_used) STORED;
        ALTER TABLE public.user_credits
            ADD COLUMN total_available INTEGER
                GENERATED ALWAYS AS (
                    (subscription_credits - subscription_used) +
                    (purchased_credits - purchased_used)
                ) STORED;

        -- Drop old index and create new ones
        DROP INDEX IF EXISTS idx_user_credits_available;
        CREATE INDEX IF NOT EXISTS idx_user_credits_subscription_available
            ON public.user_credits(subscription_available)
            WHERE subscription_available > 0;
        CREATE INDEX IF NOT EXISTS idx_user_credits_purchased_available
            ON public.user_credits(purchased_available)
            WHERE purchased_available > 0;
        CREATE INDEX IF NOT EXISTS idx_user_credits_total_available
            ON public.user_credits(total_available)
            WHERE total_available > 0;
    """)

    # 2. Update credit_transactions to track credit type
    op.execute("""
        ALTER TABLE public.credit_transactions
            ADD COLUMN IF NOT EXISTS credit_type TEXT NOT NULL DEFAULT 'subscription'
                CHECK (credit_type IN ('subscription', 'purchased'));

        CREATE INDEX IF NOT EXISTS idx_credit_transactions_credit_type
            ON public.credit_transactions(credit_type);
    """)

    # 3. Update grant_credits_to_user function to support credit type
    op.execute("""
        CREATE OR REPLACE FUNCTION public.grant_credits_to_user(
            p_user_id UUID,
            p_amount INTEGER,
            p_reason TEXT DEFAULT 'subscription_grant',
            p_credit_type TEXT DEFAULT 'subscription'
        ) RETURNS void AS $$
        BEGIN
            IF p_credit_type = 'subscription' THEN
                -- Upsert user_credits for subscription
                INSERT INTO public.user_credits (
                    user_id, subscription_credits, subscription_used, last_reset_at
                )
                VALUES (p_user_id, p_amount, 0, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    subscription_credits =
                        public.user_credits.subscription_credits + p_amount,
                    last_reset_at = NOW(),
                    updated_at = NOW();
            ELSE
                -- Upsert user_credits for purchased
                INSERT INTO public.user_credits (
                    user_id, subscription_credits, subscription_used,
                    purchased_credits, purchased_used
                )
                VALUES (p_user_id, 0, 0, p_amount, 0)
                ON CONFLICT (user_id) DO UPDATE SET
                    purchased_credits =
                        public.user_credits.purchased_credits + p_amount,
                    updated_at = NOW();
            END IF;

            -- Log transaction
            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason, credit_type
            )
            VALUES (p_user_id, p_amount, 'grant', p_reason, p_credit_type);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # 4. Update consume_credits function to use subscription first, then purchased
    op.execute("""
        CREATE OR REPLACE FUNCTION public.consume_credits(
            p_user_id UUID,
            p_amount INTEGER,
            p_reason TEXT DEFAULT 'usage'
        ) RETURNS boolean AS $$
        DECLARE
            v_subscription_available INTEGER;
            v_purchased_available INTEGER;
            v_from_subscription INTEGER;
            v_from_purchased INTEGER;
        BEGIN
            -- Get available credits
            SELECT subscription_available, purchased_available
            INTO v_subscription_available, v_purchased_available
            FROM public.user_credits
            WHERE user_id = p_user_id;

            -- Check if enough total credits
            IF (
                COALESCE(v_subscription_available, 0) + COALESCE(v_purchased_available, 0)
                < p_amount
            ) THEN
                RETURN false;
            END IF;

            -- Calculate how much from each type (subscription first)
            v_from_subscription := LEAST(COALESCE(v_subscription_available, 0), p_amount);
            v_from_purchased := p_amount - v_from_subscription;

            -- Consume credits
            UPDATE public.user_credits
            SET subscription_used = subscription_used + v_from_subscription,
                purchased_used = purchased_used + v_from_purchased,
                updated_at = NOW()
            WHERE user_id = p_user_id;

            -- Log transaction(s)
            IF v_from_subscription > 0 THEN
                INSERT INTO public.credit_transactions (
                    user_id, amount, transaction_type, reason, credit_type
                )
                VALUES (p_user_id, -v_from_subscription, 'consume', p_reason, 'subscription');
            END IF;

            IF v_from_purchased > 0 THEN
                INSERT INTO public.credit_transactions (
                    user_id, amount, transaction_type, reason, credit_type
                )
                VALUES (p_user_id, -v_from_purchased, 'consume', p_reason, 'purchased');
            END IF;

            RETURN true;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # 5. Update reset_monthly_credits function (only resets subscription)
    op.execute("""
        CREATE OR REPLACE FUNCTION public.reset_monthly_credits(
            p_user_id UUID,
            p_new_amount INTEGER
        ) RETURNS void AS $$
        BEGIN
            -- Reset only subscription credits (purchased never reset)
            UPDATE public.user_credits
            SET subscription_credits = p_new_amount,
                subscription_used = 0,
                last_reset_at = NOW(),
                updated_at = NOW()
            WHERE user_id = p_user_id;

            -- Log transaction
            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason, credit_type
            )
            VALUES (p_user_id, p_new_amount, 'reset', 'monthly_reset', 'subscription');
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)


def downgrade() -> None:
    # Revert functions
    op.execute("""
        CREATE OR REPLACE FUNCTION public.grant_credits_to_user(
            p_user_id UUID,
            p_amount INTEGER,
            p_reason TEXT DEFAULT 'subscription_grant'
        ) RETURNS void AS $$
        BEGIN
            INSERT INTO public.user_credits (
                user_id, total_credits, used_credits, last_reset_at
            )
            VALUES (p_user_id, p_amount, 0, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                total_credits =
                    public.user_credits.total_credits + p_amount,
                last_reset_at = NOW(),
                updated_at = NOW();

            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason
            )
            VALUES (p_user_id, p_amount, 'grant', p_reason);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION public.consume_credits(
            p_user_id UUID,
            p_amount INTEGER,
            p_reason TEXT DEFAULT 'usage'
        ) RETURNS boolean AS $$
        DECLARE
            v_available INTEGER;
        BEGIN
            SELECT available_credits INTO v_available
            FROM public.user_credits
            WHERE user_id = p_user_id;

            IF v_available IS NULL OR v_available < p_amount THEN
                RETURN false;
            END IF;

            UPDATE public.user_credits
            SET used_credits = used_credits + p_amount,
                updated_at = NOW()
            WHERE user_id = p_user_id;

            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason
            )
            VALUES (p_user_id, -p_amount, 'consume', p_reason);

            RETURN true;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION public.reset_monthly_credits(
            p_user_id UUID,
            p_new_amount INTEGER
        ) RETURNS void AS $$
        BEGIN
            UPDATE public.user_credits
            SET total_credits = p_new_amount,
                used_credits = 0,
                last_reset_at = NOW(),
                updated_at = NOW()
            WHERE user_id = p_user_id;

            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason
            )
            VALUES (p_user_id, p_new_amount, 'reset', 'monthly_reset');
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # Remove credit_type column from transactions
    op.execute("""
        DROP INDEX IF EXISTS idx_credit_transactions_credit_type;
        ALTER TABLE public.credit_transactions
            DROP COLUMN IF EXISTS credit_type;
    """)

    # Revert user_credits table
    op.execute("""
        -- Drop new computed columns
        ALTER TABLE public.user_credits
            DROP COLUMN IF EXISTS subscription_available;
        ALTER TABLE public.user_credits
            DROP COLUMN IF EXISTS purchased_available;
        ALTER TABLE public.user_credits
            DROP COLUMN IF EXISTS total_available;

        -- Drop purchased columns
        ALTER TABLE public.user_credits
            DROP COLUMN IF EXISTS purchased_credits;
        ALTER TABLE public.user_credits
            DROP COLUMN IF EXISTS purchased_used;

        -- Rename back to original
        ALTER TABLE public.user_credits
            RENAME COLUMN subscription_credits TO total_credits;
        ALTER TABLE public.user_credits
            RENAME COLUMN subscription_used TO used_credits;

        -- Re-add original computed column
        ALTER TABLE public.user_credits
            ADD COLUMN available_credits INTEGER
                GENERATED ALWAYS AS (total_credits - used_credits) STORED;

        -- Re-create old index
        DROP INDEX IF EXISTS idx_user_credits_subscription_available;
        DROP INDEX IF EXISTS idx_user_credits_purchased_available;
        DROP INDEX IF EXISTS idx_user_credits_total_available;
        CREATE INDEX IF NOT EXISTS idx_user_credits_available
            ON public.user_credits(available_credits)
            WHERE available_credits > 0;
    """)
