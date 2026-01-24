import importlib
import os
import sys

import pytest


def test_health_endpoint() -> None:
    os.environ.setdefault("AI_WORKER_INTERNAL_TOKEN", "test-token")
    os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/postgres")
    os.environ.setdefault("ENVIRONMENT", "test")

    sys.modules.pop("src.main", None)
    sys.modules.pop("src.core.config", None)

    main = importlib.import_module("src.main")

    from fastapi.testclient import TestClient

    client = TestClient(main.app)
    resp = client.get("/health")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_n8n_contract_sends_pdf_url_in_json(monkeypatch) -> None:
    os.environ.setdefault("AI_WORKER_INTERNAL_TOKEN", "test-token")
    os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/postgres")
    os.environ.setdefault("ENVIRONMENT", "test")
    os.environ.setdefault("N8N_BASE_URL", "http://n8n:5678")
    os.environ.setdefault("N8N_CNIS_WORKFLOW_ID", "cnis-analyzer")

    sys.modules.pop("src.core.config", None)
    sys.modules.pop("src.features.ai.service", None)

    service_module = importlib.import_module("src.features.ai.service")

    calls: list[dict] = []

    class DummyResponse:
        def __init__(self, status_code: int, payload: dict):
            self.status_code = status_code
            self._payload = payload
            self.headers = {"content-type": "application/json"}
            self.text = ""

        def json(self):
            return self._payload

    class DummyAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, **kwargs):
            calls.append({"url": url, "kwargs": kwargs})
            return DummyResponse(200, {"status": "ok", "text": "x", "metadata": {}})

    monkeypatch.setattr(service_module.httpx, "AsyncClient", DummyAsyncClient)

    svc = service_module.AiService()
    await svc._call_n8n_cnis_workflow(
        pdf_url="https://example.com/a.pdf",
        job_id="ai:123e4567-e89b-12d3-a456-426614174000",
        callback_url="http://host.docker.internal:8001/api/v1/ai/jobs/progress",
    )

    assert len(calls) == 1
    kwargs = calls[0]["kwargs"]
    assert "files" not in kwargs
    assert kwargs["json"] == {
        "pdf_url": "https://example.com/a.pdf",
        "job_id": "ai:123e4567-e89b-12d3-a456-426614174000",
        "callback_url": "http://host.docker.internal:8001/api/v1/ai/jobs/progress",
    }
