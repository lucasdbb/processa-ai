"""Tests for rate limiting middleware."""

import time
from unittest.mock import MagicMock, AsyncMock

import pytest

from src.core.rate_limit import (
    _get_client_ip,
    _get_route_limit,
    _cleanup_old_entries,
    _request_log,
    ROUTE_LIMITS,
    DEFAULT_LIMIT,
)


class TestGetClientIP:
    def test_forwarded_ip(self):
        request = MagicMock()
        request.headers.get.return_value = "203.0.113.1, 10.0.0.1"
        assert _get_client_ip(request) == "203.0.113.1"

    def test_direct_ip(self):
        request = MagicMock()
        request.headers.get.return_value = None
        request.client.host = "192.168.1.1"
        assert _get_client_ip(request) == "192.168.1.1"

    def test_no_client(self):
        request = MagicMock()
        request.headers.get.return_value = None
        request.client = None
        assert _get_client_ip(request) == "unknown"


class TestGetRouteLimit:
    def test_ai_route(self):
        prefix, max_req, window = _get_route_limit("/api/v1/ai/tools/cnis")
        assert prefix == "/api/v1/ai"
        assert max_req == 20

    def test_newsletter_route(self):
        prefix, max_req, window = _get_route_limit("/api/v1/newsletter/subscribe")
        assert prefix == "/api/v1/newsletter"
        assert max_req == 10

    def test_default_route(self):
        prefix, max_req, window = _get_route_limit("/api/v1/unknown/endpoint")
        assert prefix == "/api"
        assert max_req == DEFAULT_LIMIT[0]


class TestCleanupOldEntries:
    def test_removes_expired(self):
        now = time.time()
        entries = [now - 120, now - 90, now - 30, now - 5]
        result = _cleanup_old_entries(entries, window=60, now=now)
        assert len(result) == 2  # Only last 2 are within 60s window

    def test_keeps_all_fresh(self):
        now = time.time()
        entries = [now - 10, now - 5, now - 1]
        result = _cleanup_old_entries(entries, window=60, now=now)
        assert len(result) == 3

    def test_empty_list(self):
        result = _cleanup_old_entries([], window=60, now=time.time())
        assert result == []


class TestRateLimitMiddleware:
    def test_health_endpoint_not_rate_limited(self, client):
        """Health endpoint should bypass rate limiting."""
        for _ in range(100):
            response = client.get("/health")
            assert response.status_code == 200

    def test_api_returns_rate_limit_headers(self, client, auth_headers, mock_auth_user):
        """API responses should include rate limit headers."""
        response = client.get("/api/v1/plans", headers=auth_headers)
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
