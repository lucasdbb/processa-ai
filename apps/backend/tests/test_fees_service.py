from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from src.features.office.fees.schemas import FeeUpdate
from src.features.office.fees.service import FeesService


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


def _fee_row(user_id, fee_id=None, *, status="pending", amount=Decimal("100.00"), paid_amount=Decimal("0.00"), service_id=None):
    now = datetime.now(UTC)
    return {
        "id": fee_id or uuid4(),
        "user_id": user_id,
        "client_id": uuid4(),
        "process_id": uuid4(),
        "service_id": service_id,
        "fee_type": "initial",
        "description": "Honorario teste",
        "amount": amount,
        "paid_amount": paid_amount,
        "due_date": date.today(),
        "paid_at": date.today() if status == "paid" else None,
        "status": status,
        "notes": None,
        "created_at": now,
        "updated_at": now,
    }


@pytest.mark.asyncio
async def test_mark_as_paid_accepts_amount_parameter_and_returns_fee():
    user_id = uuid4()
    fee_id = uuid4()
    cursor = _FakeCursor(
        fetchone_results=[
            _fee_row(
                user_id,
                fee_id,
                status="pending",
                amount=Decimal("100.00"),
                paid_amount=Decimal("50.00"),
            )
        ]
    )
    pool = _FakePool(_FakeConn(cursor))

    with patch("src.features.office.fees.service.get_pool", new=AsyncMock(return_value=pool)):
        service = FeesService()
        result = await service.mark_as_paid(user_id, fee_id, Decimal("50.00"))

    assert result is not None
    assert result.paid_amount == Decimal("50.00")

    update_query, params = cursor.executed[0]
    assert "paid_amount = LEAST(GREATEST(COALESCE(%s, amount), 0), amount)" in update_query
    assert params[0] == Decimal("50.00")
    assert str(params[3]) == str(user_id)
    assert str(params[4]) == str(fee_id)


@pytest.mark.asyncio
async def test_update_fee_sets_paid_amount_and_paid_date_when_status_paid():
    user_id = uuid4()
    fee_id = uuid4()

    old_fee = {
        "service_id": None,
        "status": "pending",
        "amount": Decimal("100.00"),
    }
    updated_fee = _fee_row(
        user_id,
        fee_id,
        status="paid",
        amount=Decimal("100.00"),
        paid_amount=Decimal("100.00"),
    )

    cursor = _FakeCursor(fetchone_results=[old_fee, updated_fee])
    pool = _FakePool(_FakeConn(cursor))

    with patch("src.features.office.fees.service.get_pool", new=AsyncMock(return_value=pool)):
        service = FeesService()
        result = await service.update_fee(user_id, fee_id, FeeUpdate(status="paid"))

    assert result is not None
    assert result.status == "paid"
    assert result.paid_amount == Decimal("100.00")

    update_query, update_params = cursor.executed[1]
    assert "paid_amount = %s" in update_query
    assert "paid_date = %s" in update_query
    assert Decimal("100.00") in update_params


@pytest.mark.asyncio
async def test_update_fee_returns_none_when_fee_does_not_exist():
    user_id = uuid4()
    fee_id = uuid4()
    cursor = _FakeCursor(fetchone_results=[None])
    pool = _FakePool(_FakeConn(cursor))

    with patch("src.features.office.fees.service.get_pool", new=AsyncMock(return_value=pool)):
        service = FeesService()
        result = await service.update_fee(user_id, fee_id, FeeUpdate(status="paid"))

    assert result is None


@pytest.mark.asyncio
async def test_sync_service_paid_amount_uses_paid_amount_sum_not_status_paid_filter():
    user_id = uuid4()
    service_id = uuid4()
    cursor = _FakeCursor(fetchone_results=[{"total_paid": Decimal("30.00")}])
    conn = _FakeConn(cursor)

    service = FeesService()
    await service._sync_service_paid_amount(conn, user_id, service_id)

    sum_query, _ = cursor.executed[0]
    assert "SUM(paid_amount)" in sum_query
    assert "status = 'paid'" not in sum_query
