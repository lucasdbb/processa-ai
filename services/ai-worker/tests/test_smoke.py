import importlib
import os
import sys


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
