"""Script to check fees data."""
import asyncio
from src.core.db import init_db, get_pool

async def check_fees():
    await init_db()
    pool = await get_pool()

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            # Check if there are any fees with paid_amount < amount where status = 'paid'
            await cur.execute('''
                SELECT
                    id,
                    description,
                    amount,
                    paid_amount,
                    status
                FROM office_api.fees
                WHERE status = 'paid' AND paid_amount < amount
                LIMIT 10
            ''')
            rows = await cur.fetchall()
            print('Fees with status=paid but paid_amount < amount:')
            print(f'Found {len(rows)} rows')
            for row in rows:
                print(f'  ID: {row[0]}')
                print(f'  Desc: {row[1]}')
                print(f'  Amount: {row[2]}')
                print(f'  PaidAmount: {row[3]}')
                print(f'  Status: {row[4]}')
                print()

            # Check total_paid calculation
            await cur.execute('''
                SELECT
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as sum_by_amount,
                    COALESCE(SUM(paid_amount), 0) as sum_by_paid_amount,
                    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
                FROM office_api.fees
            ''')
            result = await cur.fetchone()
            print(f'\nTotal calculations:')
            print(f'  Total by amount (status=paid): {result[0]}')
            print(f'  Total by paid_amount (all): {result[1]}')
            print(f'  Count of paid fees: {result[2]}')

            # Update paid_amount to match amount for all paid fees
            await cur.execute('''
                UPDATE office_api.fees
                SET paid_amount = amount
                WHERE status = 'paid' AND paid_amount != amount
            ''')
            updated = cur.rowcount
            print(f'\nUpdated {updated} fees to set paid_amount = amount')

            await conn.commit()

if __name__ == '__main__':
    asyncio.run(check_fees())
