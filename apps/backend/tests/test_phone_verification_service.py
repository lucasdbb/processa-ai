from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.features.billing.credits.phone_verification import verify_phone_code


class _Result:
    def __init__(self, row):
        self._row = row

    async def fetchone(self):
        return self._row


class _Connection:
    def __init__(self, rows):
        self._rows = list(rows)
        self.executed = []

    async def execute(self, query, params=None):
        self.executed.append((query, params))
        row = self._rows.pop(0) if self._rows else None
        return _Result(row)


class _ConnectionContext:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Pool:
    def __init__(self, conn):
        self.conn = conn

    def connection(self):
        return _ConnectionContext(self.conn)


@pytest.mark.asyncio
async def test_verify_phone_code_success_marks_verified():
    conn = _Connection(rows=[("verification-1", "123456", 0), None])
    pool = _Pool(conn)

    with patch(
        "src.features.billing.credits.phone_verification.get_pool",
        new=AsyncMock(return_value=pool),
    ):
        result = await verify_phone_code("user-1", "(11) 99999-9999", "123456")

    assert result == {"verified": True}
    assert any("UPDATE public.profiles" in query for query, _ in conn.executed)
    assert any("SET verified = TRUE" in query for query, _ in conn.executed)


@pytest.mark.asyncio
async def test_verify_phone_code_conflict_when_phone_already_verified_by_other_user():
    conn = _Connection(rows=[("verification-1", "123456", 0), ("other-user",)])
    pool = _Pool(conn)

    with patch(
        "src.features.billing.credits.phone_verification.get_pool",
        new=AsyncMock(return_value=pool),
    ):
        with pytest.raises(HTTPException) as exc:
            await verify_phone_code("user-1", "(11) 99999-9999", "123456")

    assert exc.value.status_code == 409
    assert not any("UPDATE public.profiles" in query for query, _ in conn.executed)


@pytest.mark.asyncio
async def test_verify_phone_code_not_found_returns_400():
    conn = _Connection(rows=[None])
    pool = _Pool(conn)

    with patch(
        "src.features.billing.credits.phone_verification.get_pool",
        new=AsyncMock(return_value=pool),
    ):
        with pytest.raises(HTTPException) as exc:
            await verify_phone_code("user-1", "11999999999", "123456")

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_verify_phone_code_blocks_after_max_attempts():
    conn = _Connection(rows=[("verification-1", "123456", 5)])
    pool = _Pool(conn)

    with patch(
        "src.features.billing.credits.phone_verification.get_pool",
        new=AsyncMock(return_value=pool),
    ):
        with pytest.raises(HTTPException) as exc:
            await verify_phone_code("user-1", "11999999999", "123456")

    assert exc.value.status_code == 429
    assert not any("SET attempts = attempts + 1" in query for query, _ in conn.executed)


@pytest.mark.asyncio
async def test_verify_phone_code_wrong_code_increments_attempts():
    conn = _Connection(rows=[("verification-1", "999999", 2)])
    pool = _Pool(conn)

    with patch(
        "src.features.billing.credits.phone_verification.get_pool",
        new=AsyncMock(return_value=pool),
    ):
        with pytest.raises(HTTPException) as exc:
            await verify_phone_code("user-1", "11999999999", "123456")

    assert exc.value.status_code == 400
    assert any("SET attempts = attempts + 1" in query for query, _ in conn.executed)


@pytest.mark.asyncio
async def test_verify_phone_code_rejects_invalid_phone():
    with pytest.raises(HTTPException) as exc:
        await verify_phone_code("user-1", "123", "123456")

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_verify_phone_code_rejects_invalid_code_format():
    with pytest.raises(HTTPException) as exc:
        await verify_phone_code("user-1", "11999999999", "12a")

    assert exc.value.status_code == 400
