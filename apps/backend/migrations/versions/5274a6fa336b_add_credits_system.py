"""add_credits_system

Revision ID: 5274a6fa336b
Revises: 0ae7439d0683
Create Date: 2026-01-31 00:49:49.452153

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5274a6fa336b"
down_revision: Union[str, None] = "0ae7439d0683"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. User Credits Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.user_credits (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            total_credits INTEGER NOT NULL DEFAULT 0,
            used_credits INTEGER NOT NULL DEFAULT 0,
            available_credits INTEGER GENERATED ALWAYS AS (total_credits - used_credits) STORED,
            last_reset_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_user_credits_user
            ON public.user_credits(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_credits_available
            ON public.user_credits(available_credits)
            WHERE available_credits > 0;

        ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own credits"
            ON public.user_credits FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "System can manage credits"
            ON public.user_credits FOR ALL
            USING (public.is_admin());
    """)

    # 2. Credit Transactions Table (audit log)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.credit_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            amount INTEGER NOT NULL,
            transaction_type TEXT NOT NULL
                CHECK (transaction_type IN
                    ('grant', 'consume', 'refund', 'reset')),
            reason TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_credit_transactions_user
            ON public.credit_transactions(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_credit_transactions_type
            ON public.credit_transactions(transaction_type);
        
        ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own transactions"
            ON public.credit_transactions FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "System can create transactions"
            ON public.credit_transactions FOR INSERT
            WITH CHECK (public.is_admin());
    """)

    # 3. Subscriptions Table (if not exists)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.subscriptions (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT UNIQUE,
            plan_id TEXT NOT NULL DEFAULT 'free',
            status TEXT NOT NULL DEFAULT 'none'
                CHECK (status IN
                    ('active', 'past_due', 'canceled',
                     'incomplete', 'trialing', 'none')),
            current_period_start TIMESTAMPTZ,
            current_period_end TIMESTAMPTZ,
            cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_subscriptions_user
            ON public.subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
            ON public.subscriptions(stripe_customer_id)
            WHERE stripe_customer_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription
            ON public.subscriptions(stripe_subscription_id)
            WHERE stripe_subscription_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_subscriptions_status
            ON public.subscriptions(status)
            WHERE status IN ('active', 'trialing');
        
        ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own subscription"
            ON public.subscriptions FOR SELECT
            USING (auth.uid() = user_id);
        CREATE POLICY "System can manage subscriptions"
            ON public.subscriptions FOR ALL
            USING (public.is_admin());
    """)

    # 4. Plan Credits Configuration (monthly credits per plan)
    op.execute("""
        ALTER TABLE public.billing_plans
            ADD COLUMN IF NOT EXISTS monthly_credits
                INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE public.billing_plans
            ADD COLUMN IF NOT EXISTS ai_enabled
                BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE public.billing_plans
            ADD COLUMN IF NOT EXISTS calculator_enabled
                BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE public.billing_plans
            ADD COLUMN IF NOT EXISTS office_enabled
                BOOLEAN NOT NULL DEFAULT false;

        CREATE INDEX IF NOT EXISTS idx_billing_plans_features
            ON public.billing_plans(
                ai_enabled, calculator_enabled, office_enabled);
    """)

    # 5. Function to grant credits to user
    op.execute("""
        CREATE OR REPLACE FUNCTION public.grant_credits_to_user(
            p_user_id UUID,
            p_amount INTEGER,
            p_reason TEXT DEFAULT 'subscription_grant'
        ) RETURNS void AS $$
        BEGIN
            -- Upsert user_credits
            INSERT INTO public.user_credits (
                user_id, total_credits, used_credits, last_reset_at
            )
            VALUES (p_user_id, p_amount, 0, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                total_credits =
                    public.user_credits.total_credits + p_amount,
                last_reset_at = NOW(),
                updated_at = NOW();

            -- Log transaction
            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason
            )
            VALUES (p_user_id, p_amount, 'grant', p_reason);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # 6. Function to consume credits
    op.execute("""
        CREATE OR REPLACE FUNCTION public.consume_credits(
            p_user_id UUID,
            p_amount INTEGER,
            p_reason TEXT DEFAULT 'usage'
        ) RETURNS boolean AS $$
        DECLARE
            v_available INTEGER;
        BEGIN
            -- Check available credits
            SELECT available_credits INTO v_available
            FROM public.user_credits
            WHERE user_id = p_user_id;
            
            IF v_available IS NULL OR v_available < p_amount THEN
                RETURN false;
            END IF;
            
            -- Consume credits
            UPDATE public.user_credits
            SET used_credits = used_credits + p_amount,
                updated_at = NOW()
            WHERE user_id = p_user_id;
            
            -- Log transaction
            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason
            )
            VALUES (p_user_id, -p_amount, 'consume', p_reason);
            
            RETURN true;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # 7. Function to reset monthly credits
    op.execute("""
        CREATE OR REPLACE FUNCTION public.reset_monthly_credits(
            p_user_id UUID,
            p_new_amount INTEGER
        ) RETURNS void AS $$
        BEGIN
            -- Reset credits
            UPDATE public.user_credits
            SET total_credits = p_new_amount,
                used_credits = 0,
                last_reset_at = NOW(),
                updated_at = NOW()
            WHERE user_id = p_user_id;
            
            -- Log transaction
            INSERT INTO public.credit_transactions (
                user_id, amount, transaction_type, reason
            )
            VALUES (p_user_id, p_new_amount, 'reset', 'monthly_reset');
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # 8. Triggers
    op.execute("""
        DROP TRIGGER IF EXISTS update_user_credits_updated_at
            ON public.user_credits;
        CREATE TRIGGER update_user_credits_updated_at
            BEFORE UPDATE ON public.user_credits
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_subscriptions_updated_at
            ON public.subscriptions;
        CREATE TRIGGER update_subscriptions_updated_at
            BEFORE UPDATE ON public.subscriptions
            FOR EACH ROW EXECUTE FUNCTION
                public.update_updated_at_column();
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS public.reset_monthly_credits CASCADE")
    op.execute("DROP FUNCTION IF EXISTS public.consume_credits CASCADE")
    op.execute("DROP FUNCTION IF EXISTS public.grant_credits_to_user CASCADE")
    op.execute("DROP TABLE IF EXISTS public.credit_transactions CASCADE")
    op.execute("DROP TABLE IF EXISTS public.user_credits CASCADE")
    op.execute("DROP TABLE IF EXISTS public.subscriptions CASCADE")
    op.execute("ALTER TABLE public.billing_plans DROP COLUMN IF EXISTS monthly_credits")
    op.execute("ALTER TABLE public.billing_plans DROP COLUMN IF EXISTS ai_enabled")
    op.execute("ALTER TABLE public.billing_plans DROP COLUMN IF EXISTS calculator_enabled")
    op.execute("ALTER TABLE public.billing_plans DROP COLUMN IF EXISTS office_enabled")
