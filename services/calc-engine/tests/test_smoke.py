import sys

from fastapi.testclient import TestClient


def make_client(monkeypatch):
    for mod in (
        "src.main",
        "src.api.router",
        "src.features.calculators.router",
        "src.features.calculators.service",
        "src.core.config",
    ):
        sys.modules.pop(mod, None)

    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("CALC_ENGINE_INTERNAL_TOKEN", "test-token")

    from src.main import app

    return TestClient(app)


def test_health(monkeypatch):
    client = make_client(monkeypatch)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_rescisao_requires_internal_token(monkeypatch):
    client = make_client(monkeypatch)
    res = client.post(
        "/api/v1/calculators/trabalhista/rescisao-trabalhista",
        json={
            "user_id": "user",
            "client_id": "client_1",
            "salario_mensal": 3000,
            "data_admissao": "2020-01-01",
            "data_rescisao": "2020-02-01",
            "tipo_rescisao": "sem_justa_causa",
        },
    )
    assert res.status_code == 401


def test_rescisao_ok(monkeypatch):
    client = make_client(monkeypatch)
    res = client.post(
        "/api/v1/calculators/trabalhista/rescisao-trabalhista",
        headers={"X-Internal-Token": "test-token"},
        json={
            "user_id": "user",
            "client_id": "client_1",
            "salario_mensal": 3000,
            "data_admissao": "2020-01-01",
            "data_rescisao": "2020-02-01",
            "tipo_rescisao": "sem_justa_causa",
            "ferias_vencidas": 30,
            "export_pdf": False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["calculator_key"] == "trabalhista.rescisao-trabalhista"
    assert float(payload["detalhes"]["ferias_vencidas"]) == 4000.0
