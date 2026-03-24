"""Tests for critical API endpoints (auth, health, basic routes)."""

import pytest


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "processa-ai-backend"
        assert "version" in data
        assert "timestamp" in data

    def test_root_returns_service_info(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "processa-ai-backend"


class TestAuthProtection:
    """Verify that endpoints require proper authentication."""

    def test_clients_rejects_no_auth(self, client):
        """Requests without any auth should be rejected (401)."""
        response = client.get("/api/v1/office/clients")
        assert response.status_code == 401

    def test_clients_requires_valid_internal_token(self, client):
        """Requests with wrong token should be rejected."""
        response = client.get(
            "/api/v1/office/clients",
            headers={"X-Internal-Token": "wrong-token"},
        )
        assert response.status_code == 401

    def test_clients_requires_jwt(self, client, internal_headers):
        """Requests with valid internal token but no JWT should be rejected."""
        response = client.get("/api/v1/office/clients", headers=internal_headers)
        assert response.status_code == 401

    def test_processes_rejects_no_auth(self, client):
        response = client.get("/api/v1/office/processes")
        assert response.status_code == 401

    def test_unauthenticated_request_is_rejected(self, client):
        """Any protected endpoint without auth should return 401, not 500."""
        endpoints = [
            "/api/v1/office/clients",
            "/api/v1/office/processes",
            "/api/v1/office/fees",
            "/api/v1/office/deadlines",
        ]
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code in (401, 422), (
                f"{endpoint} returned {response.status_code}"
            )


class TestPublicEndpoints:
    """Verify that public endpoints work without auth."""

    def test_health_is_public(self, client):
        """Health check should always be accessible."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_root_is_public(self, client):
        response = client.get("/")
        assert response.status_code == 200

    def test_blog_list_does_not_crash(self, client):
        """Blog listing should not return 500."""
        response = client.get("/api/v1/blog/posts")
        assert response.status_code != 500
