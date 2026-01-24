import importlib
import os
import sys


def _load_app():
    os.environ.setdefault("AI_WORKER_INTERNAL_TOKEN", "test-token")
    os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/postgres")
    os.environ.setdefault("ENVIRONMENT", "test")

    sys.modules.pop("src.main", None)
    sys.modules.pop("src.core.config", None)
    sys.modules.pop("src.features.ai.router", None)

    main = importlib.import_module("src.main")
    return main.app


def test_enqueue_job_returns_job_id(monkeypatch) -> None:
    app = _load_app()

    async def _noop(*args, **kwargs):
        return None

    from src.features.ai import router as ai_router

    monkeypatch.setattr(ai_router, "set_job_status", _noop)
    monkeypatch.setattr(ai_router, "enqueue_job", _noop)
    monkeypatch.setattr(ai_router, "create_job", _noop)
    monkeypatch.setattr(ai_router, "add_job_event", _noop)

    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.post(
        "/api/v1/ai/analyses/cnis",
        headers={"X-Internal-Token": "test-token"},
        json={"file_url": "https://example.com/a.pdf", "user_id": "u1"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert isinstance(data.get("job_id"), str)
    assert data["job_id"].startswith("ai:")


def test_enqueue_job_rejects_job_id_in_request() -> None:
    app = _load_app()

    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.post(
        "/api/v1/ai/analyses/cnis",
        headers={"X-Internal-Token": "test-token"},
        json={
            "job_id": "ai:123e4567-e89b-12d3-a456-426614174000",
            "file_url": "x",
            "user_id": "u1",
        },
    )
    assert resp.status_code == 422


def test_get_job_status_falls_back_to_db(monkeypatch) -> None:
    app = _load_app()

    async def _no_redis(*args, **kwargs):
        return None

    async def _db_status(*args, **kwargs):
        return {"status": "completed", "progress": 100, "error": None, "result": {"x": 1}}

    from src.features.ai import router as ai_router

    monkeypatch.setattr(ai_router, "get_job_status", _no_redis)
    monkeypatch.setattr(ai_router, "get_job_status_from_db", _db_status)

    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.get(
        "/api/v1/ai/jobs/ai:123e4567-e89b-12d3-a456-426614174000",
        headers={"X-Internal-Token": "test-token"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["progress"] == 100
    assert data["result"] == {"x": 1}
