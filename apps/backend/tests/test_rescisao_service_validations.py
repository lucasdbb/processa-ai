from datetime import date

import pytest
from fastapi import HTTPException

from src.features.calculators.service import CalculatorsService


def _base_payload() -> dict:
    return {
        "salario_base": 3000.0,
        "adicional_periculosidade": False,
        "adicional_insalubridade_grau": 0,
        "base_insalubridade": 1621.0,
        "adicional_noturno_percent": 20.0,
        "media_horas_noturnas": 0.0,
        "outras_verbas": 0.0,
        "data_admissao": date(2024, 1, 1),
        "data_rescisao": date(2026, 1, 15),
        "tipo_rescisao": "sem_justa_causa",
        "tipo_aviso_previo": "trabalhado",
        "ferias_vencidas": 0,
        "ferias_proporcionais": True,
        "decimo_terceiro": True,
    }


def test_rejects_periculosidade_with_insalubridade():
    service = CalculatorsService()
    payload = _base_payload()
    payload["adicional_periculosidade"] = True
    payload["adicional_insalubridade_grau"] = 20

    with pytest.raises(HTTPException) as exc:
        service.calculate_rescisao_trabalhista(**payload)

    assert exc.value.status_code == 400
    assert "não podem ser acumuladas" in str(exc.value.detail)


def test_rejects_invalid_aviso_for_tipo_rescisao():
    service = CalculatorsService()
    payload = _base_payload()
    payload["tipo_rescisao"] = "sem_justa_causa"
    payload["tipo_aviso_previo"] = "nao_cumprido"

    with pytest.raises(HTTPException) as exc:
        service.calculate_rescisao_trabalhista(**payload)

    assert exc.value.status_code == 400
    assert "tipo_aviso_previo inválido" in str(exc.value.detail)


def test_rejects_invalid_insalubridade_grau_value():
    service = CalculatorsService()
    payload = _base_payload()
    payload["adicional_insalubridade_grau"] = 15

    with pytest.raises(HTTPException) as exc:
        service.calculate_rescisao_trabalhista(**payload)

    assert exc.value.status_code == 400
    assert "adicional_insalubridade_grau inválido" in str(exc.value.detail)


def test_por_pedido_nao_cumprido_remains_allowed_with_discount():
    service = CalculatorsService()
    payload = _base_payload()
    payload["tipo_rescisao"] = "por_pedido"
    payload["tipo_aviso_previo"] = "nao_cumprido"

    result = service.calculate_rescisao_trabalhista(**payload)

    assert result["detalhes"]["aviso_previo"] < 0
