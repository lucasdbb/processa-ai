from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.features.billing.credits.constants import CHECKLIST_BONUS_AMOUNT, WELCOME_CREDITS_AMOUNT
from src.features.billing.credits.service import CreditsService


class _QueryChain:
    def __init__(self, data):
        self._result = SimpleNamespace(data=data)

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def update(self, *args, **kwargs):
        return self

    def insert(self, *args, **kwargs):
        return self

    def single(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self, *args, **kwargs):
        return self._result


@pytest.mark.asyncio
async def test_consume_credits_success():
    supabase = MagicMock()
    supabase.rpc.return_value.execute.return_value = SimpleNamespace(data=True)

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    service.get_user_credits = AsyncMock(return_value={"total_available": 7})

    result = await service.consume_credits("user-1", "brief_scanner")

    assert result.success is True
    assert result.credits_consumed == 3
    assert result.remaining == 7


@pytest.mark.asyncio
async def test_consume_credits_failure_returns_zero_consumed():
    supabase = MagicMock()
    supabase.rpc.return_value.execute.return_value = SimpleNamespace(data=False)

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    service.get_user_credits = AsyncMock(return_value={"total_available": 2})

    result = await service.consume_credits("user-1", "brief_scanner")

    assert result.success is False
    assert result.credits_consumed == 0
    assert result.remaining == 2


@pytest.mark.asyncio
async def test_consume_credits_rpc_exception_returns_failure():
    supabase = MagicMock()
    supabase.rpc.return_value.execute.side_effect = Exception("rpc down")

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    result = await service.consume_credits("user-1", "brief_scanner")

    assert result.success is False
    assert result.credits_consumed == 0
    assert result.remaining == 0


@pytest.mark.asyncio
async def test_grant_welcome_credits_invalid_cpf_returns_400():
    with patch("src.features.billing.credits.service.get_supabase", return_value=MagicMock()):
        service = CreditsService()

    with patch("src.features.billing.credits.service.validate_cpf", return_value=False):
        with pytest.raises(HTTPException) as exc:
            await service.grant_welcome_credits(
                "user-1", "000.000.000-00", "11999999999", "127.0.0.1"
            )

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_grant_welcome_credits_duplicate_cpf_returns_409():
    supabase = MagicMock()
    supabase.table.side_effect = [_QueryChain(data=[{"id": "existing-user"}])]

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    with (
        patch("src.features.billing.credits.service.validate_cpf", return_value=True),
        patch(
            "src.features.billing.credits.service.check_phone_verified",
            new=AsyncMock(return_value=True),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.grant_welcome_credits(
                "user-1", "123.456.789-09", "11999999999", "127.0.0.1"
            )

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_grant_welcome_credits_rate_limited_returns_429():
    supabase = MagicMock()
    supabase.table.side_effect = [_QueryChain(data=[]), _QueryChain(data=[])]

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    with (
        patch("src.features.billing.credits.service.validate_cpf", return_value=True),
        patch(
            "src.features.billing.credits.service.check_phone_verified",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "src.features.billing.credits.service.check_ip_rate_limit",
            new=AsyncMock(return_value=False),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.grant_welcome_credits(
                "user-1", "123.456.789-09", "11999999999", "127.0.0.1"
            )

    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_grant_welcome_credits_requires_verified_phone_returns_400():
    supabase = MagicMock()

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    with (
        patch("src.features.billing.credits.service.validate_cpf", return_value=True),
        patch(
            "src.features.billing.credits.service.check_phone_verified",
            new=AsyncMock(return_value=False),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.grant_welcome_credits(
                "user-1", "123.456.789-09", "11999999999", "127.0.0.1"
            )

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_grant_welcome_credits_success():
    supabase = MagicMock()
    supabase.table.side_effect = [
        _QueryChain(data=[]),
        _QueryChain(data=[]),
        _QueryChain(data=[{"id": "user-1", "welcome_credits_claimed": True}]),
    ]

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    with (
        patch("src.features.billing.credits.service.validate_cpf", return_value=True),
        patch(
            "src.features.billing.credits.service.check_phone_verified",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "src.features.billing.credits.service.check_ip_rate_limit",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "src.features.billing.credits.service.log_registration_ip",
            new=AsyncMock(),
        ),
    ):
        result = await service.grant_welcome_credits(
            "user-1", "123.456.789-09", "11999999999", "127.0.0.1"
        )

    assert result["success"] is True
    assert result["credits_granted"] == WELCOME_CREDITS_AMOUNT


@pytest.mark.asyncio
async def test_grant_welcome_credits_grant_failure_rolls_back_claim():
    supabase = MagicMock()
    rollback_chain = _QueryChain(data=[{"id": "user-1"}])
    supabase.table.side_effect = [
        _QueryChain(data=[]),
        _QueryChain(data=[]),
        _QueryChain(data=[{"id": "user-1", "welcome_credits_claimed": True}]),
        rollback_chain,
    ]
    supabase.rpc.return_value.execute.side_effect = Exception("grant failed")

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    with (
        patch("src.features.billing.credits.service.validate_cpf", return_value=True),
        patch(
            "src.features.billing.credits.service.check_phone_verified",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "src.features.billing.credits.service.check_ip_rate_limit",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "src.features.billing.credits.service.log_registration_ip",
            new=AsyncMock(),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.grant_welcome_credits(
                "user-1", "123.456.789-09", "11999999999", "127.0.0.1"
            )

    assert exc.value.status_code == 500


@pytest.mark.asyncio
async def test_grant_checklist_bonus_already_claimed_returns_400():
    supabase = MagicMock()
    supabase.table.side_effect = [_QueryChain(data=[])]

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    with pytest.raises(HTTPException) as exc:
        await service.grant_checklist_bonus("user-1")

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_grant_checklist_bonus_failure_rolls_back():
    supabase = MagicMock()
    rollback_chain = _QueryChain(data=[{"id": "user-1"}])
    supabase.table.side_effect = [
        _QueryChain(data=[{"id": "user-1", "checklist_bonus_claimed": True}]),
        rollback_chain,
    ]
    supabase.rpc.return_value.execute.side_effect = Exception("grant failed")

    with patch("src.features.billing.credits.service.get_supabase", return_value=supabase):
        service = CreditsService()

    with pytest.raises(HTTPException) as exc:
        await service.grant_checklist_bonus("user-1")

    assert exc.value.status_code == 500
    assert CHECKLIST_BONUS_AMOUNT > 0
