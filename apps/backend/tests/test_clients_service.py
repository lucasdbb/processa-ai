from datetime import datetime
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.features.office.clients.service import ClientsService
from src.features.office.clients.schemas import ClientCreate, ClientUpdate


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


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def cursor(self, *args, **kwargs):
        return self._cursor


class _FakePool:
    def __init__(self, conn):
        self._conn = conn

    def connection(self):
        return self._conn


def _client_row(user_id, client_id=None):
    now = datetime.utcnow()
    return {
        "id": client_id or uuid4(),
        "user_id": user_id,
        "name": "Cliente Teste",
        "email": "cliente@teste.com",
        "phone": "11999999999",
        "cpf_cnpj": "12345678901",
        "address": None,
        "city": None,
        "state": None,
        "zip_code": None,
        "notes": None,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }


@pytest.mark.asyncio
async def test_create_client_returns_client_response():
    user_id = uuid4()
    cursor = _FakeCursor(fetchone_results=[_client_row(user_id)])
    pool = _FakePool(_FakeConn(cursor))

    with patch("src.features.office.clients.service.get_pool", new=AsyncMock(return_value=pool)):
        service = ClientsService()
        data = ClientCreate(name="Cliente Teste", email="cliente@teste.com")
        result = await service.create_client(user_id, data)

    assert result.name == "Cliente Teste"
    assert str(result.user_id) == str(user_id)


@pytest.mark.asyncio
async def test_get_client_not_found_returns_none():
    user_id = uuid4()
    client_id = uuid4()
    cursor = _FakeCursor(fetchone_results=[None])
    pool = _FakePool(_FakeConn(cursor))

    with patch("src.features.office.clients.service.get_pool", new=AsyncMock(return_value=pool)):
        service = ClientsService()
        result = await service.get_client(user_id, client_id)

    assert result is None


@pytest.mark.asyncio
async def test_update_client_with_no_fields_returns_current_client():
    user_id = uuid4()
    client_id = uuid4()
    cursor = _FakeCursor()
    pool = _FakePool(_FakeConn(cursor))

    with patch("src.features.office.clients.service.get_pool", new=AsyncMock(return_value=pool)):
        service = ClientsService()
        expected = MagicMock()
        service.get_client = AsyncMock(return_value=expected)
        result = await service.update_client(user_id, client_id, ClientUpdate())

    assert result is expected
    service.get_client.assert_awaited_once_with(user_id, client_id)


@pytest.mark.asyncio
async def test_update_client_applies_allowlist_only():
    user_id = uuid4()
    client_id = uuid4()
    row = _client_row(user_id, client_id)
    cursor = _FakeCursor(fetchone_results=[row])
    pool = _FakePool(_FakeConn(cursor))

    data = MagicMock()
    data.model_dump.return_value = {"name": "Novo Nome", "hacker": "x"}

    with patch("src.features.office.clients.service.get_pool", new=AsyncMock(return_value=pool)):
        service = ClientsService()
        result = await service.update_client(user_id, client_id, data)

    executed_query = cursor.executed[0][0]
    assert "name = %s" in executed_query
    assert "hacker" not in executed_query
    assert result.name == "Cliente Teste"


@pytest.mark.asyncio
async def test_delete_client_returns_true_when_row_deleted():
    user_id = uuid4()
    client_id = uuid4()
    cursor = _FakeCursor(rowcount=1)
    pool = _FakePool(_FakeConn(cursor))

    with patch("src.features.office.clients.service.get_pool", new=AsyncMock(return_value=pool)):
        service = ClientsService()
        result = await service.delete_client(user_id, client_id)

    assert result is True


@pytest.mark.asyncio
async def test_delete_client_returns_false_when_missing():
    user_id = uuid4()
    client_id = uuid4()
    cursor = _FakeCursor(rowcount=0)
    pool = _FakePool(_FakeConn(cursor))

    with patch("src.features.office.clients.service.get_pool", new=AsyncMock(return_value=pool)):
        service = ClientsService()
        result = await service.delete_client(user_id, client_id)

    assert result is False
