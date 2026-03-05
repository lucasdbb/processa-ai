"""Shared pytest fixtures for the worker test suite."""

import pytest


@pytest.fixture
def cnis_payload() -> dict:
    """Sample CNIS analysis payload matching the Gemini JSON output schema."""
    return {
        "resumo_segurado": {
            "cpf": "000.000.000-00",
            "nit": "000.00000.00-0",
            "nome": "FULANA DE TAL SILVA",
            "nome_mae": "BELTRANA DE TAL",
            "data_nascimento": "01/01/1970",
        },
        "resumo_executivo": (
            "A segurada possui histórico contributivo de aproximadamente 30 anos. "
            "Existem vínculos com indicadores que requerem documentação adicional."
        ),
        "vinculos": [
            {
                "empresa": "EMPRESA ALPHA LTDA (00.000.001/0001-00)",
                "periodo": {"inicio": "01/01/1990", "fim": "31/12/1995"},
                "indicadores": [],
                "analise_critica": "Vínculo regular.",
            },
            {
                "empresa": "EMPRESA BETA S.A. (00.000.002/0001-00)",
                "periodo": {"inicio": "01/03/2000", "fim": "28/02/2010"},
                "indicadores": ["PEXT"],
                "analise_critica": "Indicador PEXT requer documentação.",
            },
            {
                "empresa": "EMPRESA GAMMA LTDA (00.000.003/0001-00)",
                "periodo": {"inicio": "01/01/2015"},
                "indicadores": ["IVIN-JORN-DIFERENCIADA"],
                "analise_critica": "Vínculo ativo, sem data de encerramento.",
            },
        ],
        "indicadores": [
            {
                "codigo": "PEXT",
                "descricao": "Vínculo com informação extemporânea.",
                "implicacao": "Requer documentação para averbação.",
            },
            {
                "codigo": "IVIN-JORN-DIFERENCIADA",
                "descricao": "Vínculo com jornada diferenciada.",
                "implicacao": "Verificar atingimento do salário mínimo.",
            },
        ],
        "dados_previdenciarios": {
            "quantidade_vinculos": 3,
            "tempo_total_estimado": {"anos": 20, "meses": 6, "dias": 0},
            "periodos_sem_contribuicao": 1,
            "maior_salario_contribuicao": 5000.00,
            "contribuicoes_abaixo_minimo": 0,
        },
        "alertas_gerais": [
            "Vínculo aberto sem data de encerramento.",
            "Indicador PEXT requer regularização preventiva.",
        ],
    }
