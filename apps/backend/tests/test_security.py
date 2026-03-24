"""Tests for security utilities (reCAPTCHA, CPF validation, rate limiting, disposable emails)."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.core.security import (
    validate_cpf,
    is_disposable_email,
    verify_recaptcha,
    check_ip_rate_limit,
    log_registration_ip,
)


# --- CPF Validation ---


class TestValidateCPF:
    def test_valid_cpf(self):
        assert validate_cpf("123.456.789-09") is True

    def test_valid_cpf_numbers_only(self):
        assert validate_cpf("12345678909") is True

    def test_invalid_cpf_all_same_digits(self):
        assert validate_cpf("111.111.111-11") is False

    def test_invalid_cpf_all_zeros(self):
        assert validate_cpf("000.000.000-00") is False

    def test_invalid_cpf_wrong_check_digit(self):
        assert validate_cpf("123.456.789-00") is False

    def test_invalid_cpf_too_short(self):
        assert validate_cpf("1234567") is False

    def test_invalid_cpf_too_long(self):
        assert validate_cpf("123456789012") is False

    def test_invalid_cpf_empty(self):
        assert validate_cpf("") is False


# --- Disposable Email Detection ---


class TestDisposableEmail:
    def test_disposable_email_detected(self):
        assert is_disposable_email("test@guerrillamail.com") is True

    def test_disposable_email_yopmail(self):
        assert is_disposable_email("test@yopmail.com") is True

    def test_disposable_email_mailinator(self):
        assert is_disposable_email("test@mailinator.com") is True

    def test_valid_email_not_disposable(self):
        assert is_disposable_email("test@gmail.com") is False

    def test_valid_email_corporate(self):
        assert is_disposable_email("lawyer@lawfirm.com.br") is False

    def test_invalid_email_format(self):
        assert is_disposable_email("not-an-email") is False

    def test_empty_email(self):
        assert is_disposable_email("") is False


# --- reCAPTCHA Verification ---


class TestVerifyRecaptcha:
    @pytest.mark.asyncio
    async def test_valid_recaptcha_token(self):
        """reCAPTCHA returns success with high score."""
        with patch("src.core.security.httpx.AsyncClient") as mock_client_class:
            mock_response = MagicMock()
            mock_response.json.return_value = {"success": True, "score": 0.9}
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            is_valid, score = await verify_recaptcha("token", "secret")
            assert is_valid is True
            assert score == 0.9

    @pytest.mark.asyncio
    async def test_low_score_recaptcha(self):
        """reCAPTCHA returns success but score is below threshold."""
        with patch("src.core.security.httpx.AsyncClient") as mock_client_class:
            mock_response = MagicMock()
            mock_response.json.return_value = {"success": True, "score": 0.2}
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            is_valid, score = await verify_recaptcha("token", "secret")
            assert is_valid is False
            assert score == 0.2

    @pytest.mark.asyncio
    async def test_failed_recaptcha_token(self):
        """reCAPTCHA returns failure (invalid token)."""
        with patch("src.core.security.httpx.AsyncClient") as mock_client_class:
            mock_response = MagicMock()
            mock_response.json.return_value = {"success": False}
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            is_valid, score = await verify_recaptcha("bad-token", "secret")
            assert is_valid is False
            assert score is None

    @pytest.mark.asyncio
    async def test_recaptcha_api_error_fails_closed(self):
        """When Google API is unreachable, reCAPTCHA should DENY (fail-closed)."""
        with patch("src.core.security.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("Connection refused")
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            is_valid, score = await verify_recaptcha("token", "secret")
            assert is_valid is False  # CRITICAL: must be False (fail-closed)
            assert score is None


# --- IP Rate Limiting ---


class TestIPRateLimit:
    @pytest.mark.asyncio
    async def test_first_registration_allowed(self):
        result = await check_ip_rate_limit(None, "192.168.1.100", max_per_day=3)
        assert result is True

    @pytest.mark.asyncio
    async def test_exceeds_rate_limit(self):
        ip = "192.168.1.200"
        # Register 3 times (max)
        for _ in range(3):
            await log_registration_ip(None, ip, "test-user")

        result = await check_ip_rate_limit(None, ip, max_per_day=3)
        assert result is False
