from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from src.features.office.fee_payments.schemas import FeePaymentCreate
from src.features.office.fee_payments.service import FeePaymentsService


class _FakeCursor:
    def __init__(self, *, fetchone_results=None, fetchall_results=None, rowcount=0):
        self._fetchone_results = list(fetchone_results or [])
        self._fetchall_results = list(fetchall_results or [])
        self.rowcount = rowcount
        self.executed = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, query, params=None):
        self.executed.append((query, params))

    async def fetchone(self):
        if self._fetchone_results:
            return self._fetchone_results.pop(0)
        return None

    async def fetchall(self):
        if self._fetchall_results:
            return self._fetchall_results.pop(0)
        return []


class _FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def cursor(self, *args, **kwargs):
        return self._cursor

    def transaction(self):
        return _FakeTransaction()


class _FakePool:
    def __init__(self, conn):
        self._conn = conn

    def connection(self):
        return self._conn


@pytest.mark.asyncio
async def test_recalculate_fee_status_sets_overdue_for_partial_payment_after_due_date():
    user_id = uuid4()
    fee_id = uuid4()
    cursor = _FakeCursor(
        fetchone_results=[
            {"total_paid": Decimal("40.00")},
            {
                "amount": Decimal("100.00"),
                "due_date": date.today() - timedelta(days=1),
                "status": "pending",
            },
        ]
    )

    service = FeePaymentsService()
    await service._recalculate_fee_paid_amount(cursor, user_id, fee_id)

    update_query, update_params = cursor.executed[2]
    assert "SET paid_amount = %s, status = %s, paid_date = %s" in update_query
    assert update_params[0] == Decimal("40.00")
    assert update_params[1] == "overdue"
    assert update_params[2] is None


@pytest.mark.asyncio
async def test_recalculate_fee_status_sets_paid_when_total_paid_reaches_amount():
    user_id = uuid4()
    fee_id = uuid4()
    cursor = _FakeCursor(
        fetchone_results=[
            {"total_paid": Decimal("150.00")},
            {
                "amount": Decimal("100.00"),
                "due_date": date.today() + timedelta(days=5),
                "status": "pending",
            },
        ]
    )

    service = FeePaymentsService()
    await service._recalculate_fee_paid_amount(cursor, user_id, fee_id)

    _, update_params = cursor.executed[2]
    assert update_params[0] == Decimal("100.00")
    assert update_params[1] == "paid"
    assert update_params[2] == date.today()


@pytest.mark.asyncio
async def test_create_payment_uses_sql_current_date_fallback_when_payment_date_missing():
    user_id = uuid4()
    fee_id = uuid4()
    cursor = _FakeCursor(
        fetchone_results=[
            {
                "id": fee_id,
                "amount": Decimal("100.00"),
                "paid_amount": Decimal("0.00"),
                "service_id": None,
            },
            {
                "id": uuid4(),
                "user_id": user_id,
                "fee_id": fee_id,
                "amount": Decimal("10.00"),
                "payment_date": date.today(),
                "payment_method": None,
                "notes": None,
                "created_at": "2026-04-06T10:00:00Z",
                "updated_at": "2026-04-06T10:00:00Z",
            },
            {"total_paid": Decimal("10.00")},
            {
                "amount": Decimal("100.00"),
                "due_date": date.today() + timedelta(days=10),
                "status": "pending",
            },
        ]
    )
    pool = _FakePool(_FakeConn(cursor))

    with patch(
        "src.features.office.fee_payments.service.get_pool", new=AsyncMock(return_value=pool)
    ):
        service = FeePaymentsService()
        result = await service.create_payment(
            user_id,
            FeePaymentCreate(
                fee_id=fee_id,
                amount=Decimal("10.00"),
                payment_date=None,
                payment_method=None,
                notes=None,
            ),
        )

    assert result.fee_id == fee_id

    insert_query, insert_params = cursor.executed[1]
    assert "COALESCE(%s, CURRENT_DATE)" in insert_query
    assert insert_params[3] is None
