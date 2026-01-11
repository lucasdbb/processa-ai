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


def test_cnis_analysis_pdf_returns_pdf(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test.test.test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test.test.test")

    from src.core.dependencies import get_current_user
    from src.features.ai.service import AiService
    from src.main import app

    async def override_user():
        return SimpleNamespace(id="user")

    app.dependency_overrides[get_current_user] = override_user

    def fake_signed_pdf(self, markdown: str, user_id: str, pipeline_name: str, title=None):
        return {
            "download_url": "https://example.com/signed.pdf",
            "expires_in": 600,
            "document_id": "doc_123",
            "storage_path": "cnis-analysis/hash_1.0.0.pdf",
            "pipeline_version": "1.0.0",
        }

    monkeypatch.setattr(AiService, "markdown_to_signed_pdf", fake_signed_pdf, raising=True)

    client = TestClient(app)
    res = client.post(
        "/api/ai/cnis-analysis/pdf",
        json={"markdown": "# Título\n\n- Item 1\n- Item 2", "filename": "cnis"},
    )

    assert res.status_code == 200
    payload = res.json()
    assert payload["download_url"] == "https://example.com/signed.pdf"
    assert payload["expires_in"] == 600
    assert payload["document_id"] == "doc_123"

    app.dependency_overrides.clear()


def test_cnis_analysis_pdf_supports_basic_markdown_formatting(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test.test.test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test.test.test")

    from src.core.dependencies import get_current_user
    from src.features.ai.service import AiService
    from src.main import app

    async def override_user():
        return SimpleNamespace(id="user")

    app.dependency_overrides[get_current_user] = override_user

    def fake_signed_pdf(self, markdown: str, user_id: str, pipeline_name: str, title=None):
        return {
            "download_url": "https://example.com/signed.pdf",
            "expires_in": 600,
            "document_id": "doc_123",
            "storage_path": "cnis-analysis/hash_1.0.0.pdf",
            "pipeline_version": "1.0.0",
        }

    monkeypatch.setattr(AiService, "markdown_to_signed_pdf", fake_signed_pdf, raising=True)

    client = TestClient(app)
    markdown = """# Título

Texto com **negrito**, *itálico* e `código`.

1. Primeiro item
2) Segundo item

> Bloco de citação com [link](https://example.com)

---

```txt
linha 1
  linha 2
```
"""

    res = client.post(
        "/api/ai/cnis-analysis/pdf",
        json={"markdown": markdown, "filename": "cnis"},
    )

    assert res.status_code == 200
    payload = res.json()
    assert payload["download_url"] == "https://example.com/signed.pdf"
    assert payload["expires_in"] == 600
    assert payload["document_id"] == "doc_123"

    app.dependency_overrides.clear()


def test_cnis_analysis_pdf_rejects_empty_markdown(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test.test.test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test.test.test")

    from src.core.dependencies import get_current_user
    from src.main import app

    async def override_user():
        return SimpleNamespace(id="user")

    app.dependency_overrides[get_current_user] = override_user

    client = TestClient(app)
    res = client.post(
        "/api/ai/cnis-analysis/pdf",
        json={"markdown": "  ", "filename": "cnis"},
    )

    assert res.status_code == 400

    app.dependency_overrides.clear()
