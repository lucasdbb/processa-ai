"""add_credit_costs_packages_and_security

Revision ID: e7a8b1d9657b
Revises: 9bba72065910
Create Date: 2026-02-13 17:21:42.882458

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e7a8b1d9657b"
down_revision: Union[str, None] = "9bba72065910"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Fase 1: Sistema de Créditos - Infraestrutura completa

    1. Tabelas credit_costs e credit_packages
    2. Campos cpf e welcome_credits_claimed em profiles
    3. Tabelas de segurança (registration_ips, blocked_entities)
    4. FIX CRÍTICO: race condition em consume_credits() com FOR UPDATE
    5. RLS policies
    """

    # ============================================
    # 1. Tabela de custos por feature
    # ============================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.credit_costs (
            feature_key TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            base_cost INTEGER NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true
        );
    """)

    # Dados iniciais
    op.execute("""
        INSERT INTO public.credit_costs (
            feature_key, display_name, base_cost, description, is_active
        )
        VALUES
            ('ai_chat',
                'Mensagem IA Chat',
                1,
                'Uma mensagem no chat jurídico',
                true
            ),
            ('cnis_analysis',
                'Análise CNIS',
                5,
                'Análise completa de CNIS com PDF',
                true
            ),
            ('process_summary',
                'Resumo de Processo',
                5,
                'Resumo de processo com PDF',
                true
            ),
            ('calculator_rescisao',
                'Calculadora Rescisão',
                2,
                'Cálculo rescisão trabalhista com PDF',
                true
            ),
            ('calculator_aposentadoria',
                'Calculadora Aposentadoria',
                2,
                'Simulação de aposentadoria com PDF',
                true
            )
        ON CONFLICT (feature_key) DO NOTHING;
    """)

    # RLS
    op.execute("""
        ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'credit_costs' AND policyname = 'Public read credit_costs'
            ) THEN
                CREATE POLICY "Public read credit_costs"
                ON public.credit_costs
                FOR SELECT
                USING (true);
            END IF;
        END$$;
    """)

    # ============================================
    # 2. Tabela de pacotes de créditos
    # ============================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.credit_packages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            credits INTEGER NOT NULL,
            price_cents INTEGER NOT NULL,
            stripe_price_id TEXT,
            is_active BOOLEAN DEFAULT true,
            sort_order INTEGER DEFAULT 0
        );
    """)

    # Dados iniciais
    op.execute("""
        INSERT INTO public.credit_packages (name, credits, price_cents, sort_order)
        VALUES
            ('10 Créditos', 10, 990, 1),
            ('30 Créditos', 30, 2490, 2),
            ('100 Créditos', 100, 7490, 3)
        ON CONFLICT DO NOTHING;
    """)

    # RLS
    op.execute("""
        ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'credit_packages' AND policyname = 'Public read credit_packages'
            ) THEN
                CREATE POLICY "Public read credit_packages"
                ON public.credit_packages
                FOR SELECT
                USING (true);
            END IF;
        END$$;
    """)

    # ============================================
    # 3. Adicionar CPF à tabela profiles (anti-fraude)
    # ============================================
    # Verificar se colunas já existem antes de adicionar
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'profiles' AND column_name = 'cpf'
            ) THEN
                ALTER TABLE public.profiles ADD COLUMN cpf TEXT;
            END IF;
        END$$;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'profiles' AND column_name = 'welcome_credits_claimed'
            ) THEN
                ALTER TABLE public.profiles
                    ADD COLUMN welcome_credits_claimed BOOLEAN DEFAULT false;
            END IF;
        END$$;
    """)

    # Partial unique index: permite múltiplos NULLs mas impede CPFs duplicados
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf
        ON public.profiles(cpf)
        WHERE cpf IS NOT NULL;
    """)

    # RLS policies para CPF (user só vê o próprio)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'profiles' AND policyname = 'Users can view own CPF'
            ) THEN
                CREATE POLICY "Users can view own CPF"
                ON public.profiles
                FOR SELECT
                USING (auth.uid() = id);
            END IF;
        END$$;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'profiles' AND policyname = 'Users can update own CPF'
            ) THEN
                CREATE POLICY "Users can update own CPF"
                ON public.profiles
                FOR UPDATE
                USING (auth.uid() = id);
            END IF;
        END$$;
    """)

    # ============================================
    # 4. Tabelas de segurança e anti-fraude
    # ============================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.registration_ips (
            ip_address TEXT NOT NULL,
            user_id UUID REFERENCES auth.users(id),
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_registration_ips_ip_date
        ON public.registration_ips(ip_address, created_at);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS public.blocked_entities (
            entity_type TEXT NOT NULL,
            entity_value TEXT NOT NULL,
            reason TEXT,
            blocked_at TIMESTAMP DEFAULT NOW(),
            blocked_by UUID,
            PRIMARY KEY (entity_type, entity_value)
        );
    """)

    # ============================================
    # 5. CORREÇÃO CRÍTICA: race condition em consume_credits
    # ============================================
    # A função existente faz SELECT + UPDATE sem lock.
    # Adicionar FOR UPDATE para prevenir consumo duplo.

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
            -- FOR UPDATE: trava a row até o fim da transação
            -- Previne race conditions em requisições simultâneas
            SELECT subscription_available, purchased_available
            INTO v_subscription_available, v_purchased_available
            FROM public.user_credits
            WHERE user_id = p_user_id
            FOR UPDATE;

            -- Se não existe registro, criar com valores zerados
            IF NOT FOUND THEN
                INSERT INTO public.user_credits (
                    user_id,
                    subscription_credits,
                    subscription_used,
                    purchased_credits,
                    purchased_used
                )
                VALUES (p_user_id, 0, 0, 0, 0);
                RETURN false;
            END IF;

            -- Verifica saldo total
            IF COALESCE(v_subscription_available, 0) +
               COALESCE(v_purchased_available, 0) < p_amount THEN
                RETURN false;
            END IF;

            -- Prioriza créditos de assinatura primeiro
            v_from_subscription := LEAST(COALESCE(v_subscription_available, 0), p_amount);
            v_from_purchased := p_amount - v_from_subscription;

            -- Debita créditos
            UPDATE public.user_credits
            SET subscription_used = subscription_used + v_from_subscription,
                purchased_used = purchased_used + v_from_purchased,
                updated_at = NOW()
            WHERE user_id = p_user_id;

            -- Log de transações
            IF v_from_subscription > 0 THEN
                INSERT INTO public.credit_transactions
                    (user_id, amount, transaction_type, credit_type, reason)
                VALUES
                    (p_user_id, -v_from_subscription, 'consume', 'subscription', p_reason);
            END IF;

            IF v_from_purchased > 0 THEN
                INSERT INTO public.credit_transactions
                    (user_id, amount, transaction_type, credit_type, reason)
                VALUES
                    (p_user_id, -v_from_purchased, 'consume', 'purchased', p_reason);
            END IF;

            RETURN true;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)


def downgrade() -> None:
    """Reverter todas as alterações da Fase 1"""

    # Remover função corrigida (volta para a versão anterior)
    op.execute("DROP FUNCTION IF EXISTS public.consume_credits(UUID, INTEGER, TEXT);")

    # Remover tabelas de segurança
    op.execute("DROP TABLE IF EXISTS public.blocked_entities;")
    op.execute("DROP TABLE IF EXISTS public.registration_ips;")

    # Remover campos de profiles
    op.execute("DROP INDEX IF EXISTS public.idx_profiles_cpf;")
    op.execute("ALTER TABLE public.profiles DROP COLUMN IF EXISTS welcome_credits_claimed;")
    op.execute("ALTER TABLE public.profiles DROP COLUMN IF EXISTS cpf;")

    # Remover tabelas de créditos
    op.execute("DROP TABLE IF EXISTS public.credit_packages;")
    op.execute("DROP TABLE IF EXISTS public.credit_costs;")
