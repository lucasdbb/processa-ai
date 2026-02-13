"""Fee payments service."""

from decimal import Decimal
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.fee_payments.schemas import (
    FeePaymentCreate,
    FeePaymentResponse,
    FeePaymentUpdate,
)


class FeePaymentsService:
    """Service for fee payment operations."""

    async def list_payments(self, user_id: UUID, fee_id: UUID) -> list[FeePaymentResponse]:
        """List all payments for a specific fee."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT *
                    FROM office_api.fee_payments
                    WHERE user_id = %s AND fee_id = %s
                    ORDER BY payment_date DESC, created_at DESC
                    """,
                    (str(user_id), str(fee_id)),
                )
                rows = await cur.fetchall()
                return [FeePaymentResponse(**row) for row in rows]

    async def get_payment(self, user_id: UUID, payment_id: UUID) -> FeePaymentResponse | None:
        """Get a single payment by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT * FROM office_api.fee_payments
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(payment_id)),
                )
                row = await cur.fetchone()
                return FeePaymentResponse(**row) if row else None

    async def create_payment(self, user_id: UUID, data: FeePaymentCreate) -> FeePaymentResponse:
        """Create a new payment and update fee paid_amount."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Verify fee exists and belongs to user
                await cur.execute(
                    """
                    SELECT id, amount, paid_amount, service_id
                    FROM office_api.fees
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(data.fee_id)),
                )
                fee_row = await cur.fetchone()
                if not fee_row:
                    raise ValueError("Fee not found")

                # Create payment
                await cur.execute(
                    """
                    INSERT INTO office_api.fee_payments (
                        user_id, fee_id, amount, payment_date, payment_method, notes
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        str(data.fee_id),
                        data.amount,
                        data.payment_date or "CURRENT_DATE",
                        data.payment_method,
                        data.notes,
                    ),
                )
                payment_row = await cur.fetchone()

                # Recalculate fee paid_amount and status
                await self._recalculate_fee_paid_amount(cur, user_id, data.fee_id)

                # Sync service paid_amount if fee is linked to a service
                if fee_row["service_id"]:
                    await self._sync_service_paid_amount(conn, user_id, fee_row["service_id"])

                return FeePaymentResponse(**payment_row)

    async def update_payment(
        self, user_id: UUID, payment_id: UUID, data: FeePaymentUpdate
    ) -> FeePaymentResponse | None:
        """Update a payment and recalculate fee paid_amount."""
        pool = await get_pool()

        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            return await self.get_payment(user_id, payment_id)

        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Get fee_id before update
                await cur.execute(
                    """
                    SELECT fee_id FROM office_api.fee_payments
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(payment_id)),
                )
                payment_row = await cur.fetchone()
                if not payment_row:
                    return None

                fee_id = payment_row["fee_id"]

                # Update payment
                await cur.execute(
                    f"""
                    UPDATE office_api.fee_payments
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                    """,
                    values + [str(user_id), str(payment_id)],
                )
                updated_row = await cur.fetchone()

                # Recalculate fee paid_amount
                await self._recalculate_fee_paid_amount(cur, user_id, fee_id)

                # Get fee's service_id to sync if needed
                await cur.execute(
                    """
                    SELECT service_id FROM office_api.fees
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(fee_id)),
                )
                fee_row = await cur.fetchone()
                if fee_row and fee_row["service_id"]:
                    await self._sync_service_paid_amount(conn, user_id, fee_row["service_id"])

                return FeePaymentResponse(**updated_row) if updated_row else None

    async def delete_payment(self, user_id: UUID, payment_id: UUID) -> bool:
        """Delete a payment and recalculate fee paid_amount."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Get fee_id before deletion
                await cur.execute(
                    """
                    SELECT fee_id FROM office_api.fee_payments
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(payment_id)),
                )
                payment_row = await cur.fetchone()
                if not payment_row:
                    return False

                fee_id = payment_row["fee_id"]

                # Delete payment
                await cur.execute(
                    """
                    DELETE FROM office_api.fee_payments
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(payment_id)),
                )
                deleted = cur.rowcount > 0

                if deleted:
                    # Recalculate fee paid_amount
                    await self._recalculate_fee_paid_amount(cur, user_id, fee_id)

                    # Get fee's service_id to sync if needed
                    await cur.execute(
                        """
                        SELECT service_id FROM office_api.fees
                        WHERE user_id = %s AND id = %s
                        """,
                        (str(user_id), str(fee_id)),
                    )
                    fee_row = await cur.fetchone()
                    if fee_row and fee_row["service_id"]:
                        await self._sync_service_paid_amount(conn, user_id, fee_row["service_id"])

                return deleted

    async def _recalculate_fee_paid_amount(self, cur, user_id: UUID, fee_id: UUID) -> None:
        """Recalculate fee paid_amount from sum of payments and update status."""
        # Calculate total paid from payments
        await cur.execute(
            """
            SELECT COALESCE(SUM(amount), 0) as total_paid
            FROM office_api.fee_payments
            WHERE user_id = %s AND fee_id = %s
            """,
            (str(user_id), str(fee_id)),
        )
        row = await cur.fetchone()
        total_paid = Decimal(row["total_paid"]) if row else Decimal(0)

        # Get fee amount to determine status
        await cur.execute(
            """
            SELECT amount FROM office_api.fees
            WHERE user_id = %s AND id = %s
            """,
            (str(user_id), str(fee_id)),
        )
        fee_row = await cur.fetchone()
        if not fee_row:
            return

        fee_amount = Decimal(fee_row["amount"])

        # Determine new status
        if total_paid >= fee_amount:
            new_status = "paid"
        elif total_paid > 0:
            new_status = "partial"
        else:
            new_status = "pending"

        # Update fee
        await cur.execute(
            """
            UPDATE office_api.fees
            SET paid_amount = %s, status = %s, updated_at = NOW()
            WHERE user_id = %s AND id = %s
            """,
            (total_paid, new_status, str(user_id), str(fee_id)),
        )

    async def _sync_service_paid_amount(self, conn, user_id: UUID, service_id: UUID) -> None:
        """Sync service paid_amount with sum of linked fees' paid_amount."""
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT COALESCE(SUM(paid_amount), 0) as total_paid
                FROM office_api.fees
                WHERE user_id = %s AND service_id = %s
                """,
                (str(user_id), str(service_id)),
            )
            row = await cur.fetchone()
            total_paid = row["total_paid"] if row else 0

            await cur.execute(
                """
                UPDATE office_api.services
                SET paid_amount = %s, updated_at = NOW()
                WHERE user_id = %s AND id = %s
                """,
                (total_paid, str(user_id), str(service_id)),
            )


fee_payments_service = FeePaymentsService()
