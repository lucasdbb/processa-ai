"""Script to check fees data."""

import asyncio
import logging
from src.core.db import init_db, get_pool

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def check_fees():
    await init_db()
    pool = await get_pool()

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            # Check if there are any fees with paid_amount < amount where status = 'paid'
            await cur.execute("""
                SELECT
                    id,
                    description,
                    amount,
                    paid_amount,
                    status
                FROM office_api.fees
                WHERE status = 'paid' AND paid_amount < amount
                LIMIT 10
            """)
            rows = await cur.fetchall()
            logger.info("Fees with status=paid but paid_amount < amount:")
            logger.info(f"Found {len(rows)} rows")
            for row in rows:
                logger.info(f"  ID: {row[0]}")
                logger.info(f"  Desc: {row[1]}")
                logger.info(f"  Amount: {row[2]}")
                logger.info(f"  PaidAmount: {row[3]}")
                logger.info(f"  Status: {row[4]}")

            # Check total_paid calculation
            await cur.execute("""
                SELECT
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as sum_by_amount,
                    COALESCE(SUM(paid_amount), 0) as sum_by_paid_amount,
                    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
                FROM office_api.fees
            """)
            result = await cur.fetchone()
            logger.info("\nTotal calculations:")
            logger.info(f"  Total by amount (status=paid): {result[0]}")
            logger.info(f"  Total by paid_amount (all): {result[1]}")
            logger.info(f"  Count of paid fees: {result[2]}")

            # Update paid_amount to match amount for all paid fees
            await cur.execute("""
                UPDATE office_api.fees
                SET paid_amount = amount
                WHERE status = 'paid' AND paid_amount != amount
            """)
            updated = cur.rowcount
            logger.info(f"\nUpdated {updated} fees to set paid_amount = amount")

            await conn.commit()


if __name__ == "__main__":
    asyncio.run(check_fees())
