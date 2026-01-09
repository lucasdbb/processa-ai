from types import SimpleNamespace

from fastapi.testclient import TestClient


def test_cnis_analysis_rejects_non_pdf(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test.test.test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test.test.test")
    monkeypatch.setenv("MISTRAL_API_KEY", "test")

    from src.core.config import settings

    settings.MISTRAL_API_KEY = "test"

    from src.core.dependencies import get_current_user
    from src.main import app

    async def override_user():
        return SimpleNamespace(id="user")

    app.dependency_overrides[get_current_user] = override_user

    client = TestClient(app)
    res = client.post(
        "/api/ai/cnis-analysis",
        files={"file": ("cnis.txt", b"oi", "text/plain")},
    )

    assert res.status_code == 400
    assert res.json()["detail"] == "Envie um arquivo PDF"

    app.dependency_overrides.clear()


def test_cnis_analysis_calls_mistral_agent(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test.test.test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test.test.test")
    monkeypatch.setenv("MISTRAL_API_KEY", "test")
    monkeypatch.setenv("MISTRAL_CNIS_AGENT_ID", "agent_123")

    from src.core.config import settings

    settings.MISTRAL_API_KEY = "test"
    settings.MISTRAL_CNIS_AGENT_ID = "agent_123"

    import httpx

    calls = []

    class DummyResponse:
        def __init__(self, status_code: int, payload: dict):
            self.status_code = status_code
            self._payload = payload

        def json(self):
            return self._payload

    async def fake_post(self, url, **kwargs):
        calls.append({"url": url, "kwargs": kwargs})
        return DummyResponse(
            200,
            {
                "choices": [
                    {
                        "message": {
                            "content": "RELATÓRIO CNIS\n\n1) Resumo\n- ...",
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post, raising=True)

    from src.core.dependencies import get_current_user
    from src.main import app

    async def override_user():
        return SimpleNamespace(id="user")

    app.dependency_overrides[get_current_user] = override_user

    client = TestClient(app)
    res = client.post(
        "/api/ai/cnis-analysis",
        files={"file": ("cnis.pdf", b"%PDF-1.4\n%", "application/pdf")},
    )

    assert res.status_code == 200
    assert "RELATÓRIO CNIS" in res.json()["text"]

    assert calls
    assert calls[0]["url"].endswith("/v1/agents/completions")
    assert calls[0]["kwargs"]["json"]["agent_id"] == "agent_123"

    app.dependency_overrides.clear()
