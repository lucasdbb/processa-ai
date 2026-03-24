"""Tests for authentication middleware and dependencies."""

import pytest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from src.core.auth import (
    get_user_id,
    get_user_role,
    get_current_user,
    get_current_admin,
    verify_internal_token,
    require_internal_auth,
    CurrentUser,
)


class TestVerifyInternalToken:
    def test_valid_internal_token(self):
        """Should not raise with correct token."""
        verify_internal_token("test-internal-token")

    def test_invalid_internal_token(self):
        """Should raise 401 with wrong token."""
        with pytest.raises(HTTPException) as exc_info:
            verify_internal_token("wrong-token")
        assert exc_info.value.status_code == 401

    def test_empty_internal_token(self):
        """Should raise 401 with empty token."""
        with pytest.raises(HTTPException) as exc_info:
            verify_internal_token("")
        assert exc_info.value.status_code == 401


class TestGetUserId:
    def test_valid_user_id(self):
        """Should return user_id from request state."""
        request = MagicMock()
        request.state.user_id = "user-123"
        assert get_user_id(request) == "user-123"

    def test_missing_user_id(self):
        """Should raise 401 when user_id not in request state."""
        request = MagicMock()
        # Simulate missing user_id by making getattr return None
        request.state = MagicMock(spec=[])
        with pytest.raises((HTTPException, AttributeError)):
            get_user_id(request)


class TestGetUserRole:
    def test_valid_role(self):
        request = MagicMock()
        request.state.user_role = "admin"
        assert get_user_role(request) == "admin"

    def test_missing_role(self):
        request = MagicMock()
        request.state = MagicMock(spec=[])
        with pytest.raises((HTTPException, AttributeError)):
            get_user_role(request)


class TestGetCurrentUser:
    def test_returns_current_user(self):
        request = MagicMock()
        request.state.user_id = "user-456"
        request.state.user_role = "client"

        user = get_current_user(request)
        assert isinstance(user, CurrentUser)
        assert user.id == "user-456"
        assert user.role == "client"

    def test_unauthenticated(self):
        request = MagicMock()
        request.state = MagicMock(spec=[])
        with pytest.raises((HTTPException, AttributeError)):
            get_current_user(request)


class TestGetCurrentAdmin:
    def test_admin_access(self):
        admin = CurrentUser(id="admin-1", role="admin")
        result = get_current_admin(admin)
        assert result.role == "admin"

    def test_non_admin_denied(self):
        client = CurrentUser(id="user-1", role="client")
        with pytest.raises(HTTPException) as exc_info:
            get_current_admin(client)
        assert exc_info.value.status_code == 403


class TestRequireInternalAuth:
    @pytest.mark.asyncio
    async def test_valid_token(self):
        """Should not raise with correct token."""
        await require_internal_auth("test-internal-token")

    @pytest.mark.asyncio
    async def test_invalid_token(self):
        with pytest.raises(HTTPException) as exc_info:
            await require_internal_auth("wrong")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_token(self):
        with pytest.raises(HTTPException) as exc_info:
            await require_internal_auth(None)
        assert exc_info.value.status_code == 401
