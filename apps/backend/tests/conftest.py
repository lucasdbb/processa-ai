"""Shared fixtures for backend tests."""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Set test environment before importing app
os.environ["ENVIRONMENT"] = "test"
os.environ["INTERNAL_TOKEN"] = "test-internal-token"
os.environ["SUPABASE_JWT_SECRET"] = "test-jwt-secret-that-is-long-enough-for-hs256"
os.environ["DATABASE_URL"] = ""
os.environ["SUPABASE_URL"] = "http://localhost:54321"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake"
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:5173"

from src.main import app  # noqa: E402


@pytest.fixture
def client():
    """FastAPI test client with test headers."""
    return TestClient(app)


@pytest.fixture
def internal_headers():
    """Headers with valid internal token."""
    return {"X-Internal-Token": "test-internal-token"}


@pytest.fixture
def auth_headers(internal_headers):
    """Headers with internal token + a mock JWT.

    The middleware will decode this JWT and set request.state.user_id.
    We patch the middleware to simulate an authenticated user.
    """
    return {
        **internal_headers,
        "Authorization": "Bearer mock-jwt-token",
    }


TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_ADMIN_ID = "00000000-0000-0000-0000-000000000099"


@pytest.fixture
def mock_auth_user():
    """Patch the auth middleware to inject a regular user."""
    with patch("src.core.middleware.jwt") as mock_jwt, \
         patch("src.core.middleware.get_supabase") as mock_supabase:
        mock_jwt.decode.return_value = {"sub": TEST_USER_ID}
        mock_supabase_client = MagicMock()
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
            data={"role": "client"}
        )
        mock_supabase.return_value = mock_supabase_client
        yield TEST_USER_ID


@pytest.fixture
def mock_auth_admin():
    """Patch the auth middleware to inject an admin user."""
    with patch("src.core.middleware.jwt") as mock_jwt, \
         patch("src.core.middleware.get_supabase") as mock_supabase:
        mock_jwt.decode.return_value = {"sub": TEST_ADMIN_ID}
        mock_supabase_client = MagicMock()
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
            data={"role": "admin"}
        )
        mock_supabase.return_value = mock_supabase_client
        yield TEST_ADMIN_ID
