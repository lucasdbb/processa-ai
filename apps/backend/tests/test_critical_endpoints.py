"""Critical HTTP contract smoke tests for high-risk endpoints."""


def test_post_claim_checklist_bonus_requires_auth(client, internal_headers):
    response = client.post("/api/v1/credits/claim-checklist-bonus", headers=internal_headers)
    assert response.status_code in (401, 403)


def test_post_ai_job_requires_auth(client, internal_headers):
    # CNIS route is representative of AI job creation paths.
    response = client.post(
        "/api/v1/ai/analyses/cnis",
        json={"file_url": "https://example.com/doc.pdf"},
        headers=internal_headers,
    )
    assert response.status_code in (401, 403)


def test_post_billing_webhook_invalid_signature(client):
    response = client.post(
        "/api/v1/billing/webhooks/stripe",
        data=b"{}",
        headers={"stripe-signature": "invalid"},
    )
    assert response.status_code == 400


def test_get_office_clients_requires_internal_and_jwt(client):
    response = client.get("/api/v1/office/clients")
    assert response.status_code in (401, 403)
