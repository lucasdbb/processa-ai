"""Fees/Honorários service."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.fees.schemas import (
    FeeCreate,
    FeeListParams,
    FeeResponse,
    FeeSummaryResponse,
    FeeUpdate,
)


class FeesService:
    """Service for fee operations."""

    async def list_fees(
        self,
        user_id: UUID,
        params: FeeListParams,
    ) -> tuple[list[FeeResponse], int]:
        """List fees for a user."""
        pool = await get_pool()

        where_conditions = ["user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        if params.client_id:
            where_conditions.append("client_id = %s")
            query_params.append(str(params.client_id))

        if params.process_id:
            where_conditions.append("process_id = %s")
            query_params.append(str(params.process_id))

        if params.service_id:
            where_conditions.append("service_id = %s")
            query_params.append(str(params.service_id))

        if params.fee_type:
            where_conditions.append("fee_type = %s")
            query_params.append(params.fee_type)

        if params.status:
            where_conditions.append("status = %s")
            query_params.append(params.status)

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Count query
                count_query = f"""
                    SELECT COUNT(*) as total
                    FROM office_api.fees
                    WHERE {where_clause}
                """
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                # Data query
                data_query = f"""
                    SELECT *, paid_date as paid_at
                    FROM office_api.fees
                    WHERE {where_clause}
                    ORDER BY due_date ASC NULLS LAST, created_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                fees = [FeeResponse(**row) for row in rows]
                return fees, total

    async def get_fee(self, user_id: UUID, fee_id: UUID) -> FeeResponse | None:
        """Get a single fee by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT *, paid_date as paid_at FROM office_api.fees
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(fee_id)),
                )
                row = await cur.fetchone()
                return FeeResponse(**row) if row else None

    async def create_fee(self, user_id: UUID, data: FeeCreate) -> FeeResponse:
        """Create a new fee."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.fees (
                        user_id, client_id, process_id, service_id, fee_type,
                        description, amount, due_date, paid_date, status, notes
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NULL, 'pending', %s)
                    RETURNING *, paid_date as paid_at
                    """,
                    (
                        str(user_id),
                        str(data.client_id),
                        str(data.process_id) if data.process_id else None,
                        str(data.service_id) if data.service_id else None,
                        data.fee_type,
                        data.description,
                        data.amount,
                        data.due_date,
                        data.notes,
                    ),
                )
                row = await cur.fetchone()

                # Sync service paid_amount if fee is linked to a service
                if data.service_id:
                    await self._sync_service_paid_amount(conn, user_id, data.service_id)

                return FeeResponse(**row)

    async def update_fee(self, user_id: UUID, fee_id: UUID, data: FeeUpdate) -> FeeResponse | None:
        """Update an existing fee."""
        pool = await get_pool()

        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            return await self.get_fee(user_id, fee_id)

        # Map paid_at to paid_date for database column
        if "paid_at" in update_data:
            update_data["paid_date"] = update_data.pop("paid_at")

        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Get old service_id before update
                await cur.execute(
                    """
                    SELECT service_id FROM office_api.fees
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(fee_id)),
                )
                old_fee = await cur.fetchone()
                old_service_id = (
                    old_fee["service_id"] if old_fee and old_fee["service_id"] else None
                )

                await cur.execute(
                    f"""
                    UPDATE office_api.fees
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *, paid_date as paid_at
                    """,
                    values + [str(user_id), str(fee_id)],
                )
                row = await cur.fetchone()

                # Sync service paid_amount if fee is/was linked to a service
                new_service_id = data.service_id if "service_id" in update_data else old_service_id

                # Sync old service if it changed or if status changed
                if old_service_id and (old_service_id != new_service_id or "status" in update_data):
                    await self._sync_service_paid_amount(conn, user_id, old_service_id)

                # Sync new service if it's different from old or if status changed
                if new_service_id and (new_service_id != old_service_id or "status" in update_data):
                    await self._sync_service_paid_amount(conn, user_id, new_service_id)

                return FeeResponse(**row) if row else None

    async def delete_fee(self, user_id: UUID, fee_id: UUID) -> bool:
        """Delete a fee."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Get fee info before deleting to sync service if needed
                await cur.execute(
                    """
                    SELECT service_id FROM office_api.fees
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(fee_id)),
                )
                fee_row = await cur.fetchone()
                service_id = fee_row["service_id"] if fee_row else None

                await cur.execute(
                    """
                    DELETE FROM office_api.fees
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(fee_id)),
                )
                deleted = cur.rowcount > 0

                # Sync service paid_amount if fee was linked to a service
                if deleted and service_id:
                    await self._sync_service_paid_amount(conn, user_id, service_id)

                return deleted

    async def _sync_service_paid_amount(self, conn: Any, user_id: UUID, service_id: UUID) -> None:
        """Sync service paid_amount with sum of linked fees that are paid."""
        async with conn.cursor(row_factory=dict_row) as cur:
            # Calculate total paid from fees linked to this service with status='paid'
            await cur.execute(
                """
                SELECT COALESCE(SUM(amount), 0) as total_paid
                FROM office_api.fees
                WHERE user_id = %s AND service_id = %s AND status = 'paid'
                """,
                (str(user_id), str(service_id)),
            )
            row = await cur.fetchone()
            total_paid = row["total_paid"] if row else 0

            # Update service paid_amount
            await cur.execute(
                """
                UPDATE office_api.services
                SET paid_amount = %s, updated_at = NOW()
                WHERE user_id = %s AND id = %s
                """,
                (total_paid, str(user_id), str(service_id)),
            )

    async def get_summary_by_client(self, user_id: UUID, client_id: UUID) -> FeeSummaryResponse:
        """Get fee summary for a client."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        COALESCE(SUM(amount), 0) as total_amount,
                        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
                        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
                        COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) as total_overdue,
                        COUNT(*) as fees_count,
                        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
                        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
                    FROM office_api.fees
                    WHERE user_id = %s AND client_id = %s
                    """,
                    (str(user_id), str(client_id)),
                )
                row = await cur.fetchone()

                if not row:
                    return FeeSummaryResponse(
                        total_amount=Decimal(0),
                        total_paid=Decimal(0),
                        total_pending=Decimal(0),
                        total_overdue=Decimal(0),
                        fees_count=0,
                        paid_count=0,
                        pending_count=0,
                        overdue_count=0,
                    )

                return FeeSummaryResponse(**row)

    async def mark_as_paid(self, user_id: UUID, fee_id: UUID) -> FeeResponse | None:
        """Mark a fee as paid."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    UPDATE office_api.fees
                    SET status = 'paid', paid_date = NOW(), updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *, paid_date as paid_at
                    """,
                    (str(user_id), str(fee_id)),
                )
                row = await cur.fetchone()

                # Get service_id to sync if needed
                if row and row.get("service_id"):
                    await self._sync_service_paid_amount(conn, user_id, row["service_id"])

                return FeeResponse(**row) if row else None


fees_service = FeesService()
