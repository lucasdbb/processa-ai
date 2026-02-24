"""add admin metrics rpc

Revision ID: l1f2g3h4i5j6
Revises: k0e1f2g3h4i5
Create Date: 2024-05-23 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "l1f2g3h4i5j6"
down_revision = ("k0e1f2g3h4i5", "e7a8b1d9657b")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE OR REPLACE FUNCTION get_credits_usage_stats(days_limit INTEGER DEFAULT 30)
    RETURNS TABLE (
        total_consumed_all_time BIGINT,
        total_consumed_period BIGINT,
        usage_by_feature JSON
    ) AS $$
    DECLARE
        v_total_all BIGINT;
        v_total_period BIGINT;
        v_usage_json JSON;
    BEGIN
        -- Total Consumed All Time (sum of negative amounts)
        SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_total_all
        FROM credit_transactions
        WHERE transaction_type = 'consume';

        -- Total Consumed Period
        SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_total_period
        FROM credit_transactions
        WHERE transaction_type = 'consume'
          AND created_at >= NOW() - (days_limit || ' days')::INTERVAL;

        -- Usage by Feature (All Time)
        WITH grouped AS (
            SELECT 
                reason as feature_key, 
                ABS(SUM(amount)) as total_consumed,
                COUNT(*) as count
            FROM credit_transactions
            WHERE transaction_type = 'consume'
            GROUP BY reason
        )
        SELECT json_agg(grouped) INTO v_usage_json FROM grouped;

        RETURN QUERY SELECT v_total_all, v_total_period, COALESCE(v_usage_json, '[]'::json);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE OR REPLACE FUNCTION get_top_consumers(limit_count INTEGER DEFAULT 10)
    RETURNS TABLE (
        user_id UUID,
        name TEXT,
        email TEXT,
        total_consumed BIGINT
    ) AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            ct.user_id,
            p.name,
            u.email::TEXT,
            ABS(SUM(ct.amount))::BIGINT as total_consumed
        FROM credit_transactions ct
        LEFT JOIN profiles p ON ct.user_id = p.id
        LEFT JOIN auth.users u ON ct.user_id = u.id
        WHERE ct.transaction_type = 'consume'
        GROUP BY ct.user_id, p.name, u.email
        ORDER BY total_consumed DESC
        LIMIT limit_count;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS get_credits_usage_stats(INTEGER);")
    op.execute("DROP FUNCTION IF EXISTS get_top_consumers(INTEGER);")
