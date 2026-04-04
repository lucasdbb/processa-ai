"""Parser de CNIS PDF via Gemini structured output.

Envia o PDF diretamente ao Gemini para extração de dados estruturados
(segurado, vínculos, remunerações). O modelo lê o documento inteiro,
resolvendo problemas de tabelas quebradas entre páginas.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal, InvalidOperation

from src.core.config import get_gemini_model
from src.core.gemini import analyze_pdf
from src.core.logging import logger

from .tipos import CnisExtraido, CnisSegurado, CnisVinculo, Remuneracao

_SYSTEM_INSTRUCTION = """\
Você é um parser especializado em extrair dados estruturados do CNIS \
(Cadastro Nacional de Informações Sociais) brasileiro.

Extraia TODOS os dados do documento e retorne um JSON válido seguindo \
EXATAMENTE este schema — sem campos extras e sem omitir campos:

{
  "segurado": {
    "nome": "string | null",
    "cpf": "string (formato 000.000.000-00) | null",
    "nit": "string (formato 000.00000.00-0) | null",
    "data_nascimento": "string (YYYY-MM-DD) | null",
    "nome_mae": "string | null"
  },
  "vinculos": [
    {
      "sequencia": 1,
      "empresa": "string | null",
      "cnpj": "string | null",
      "tipo": "um de: Empregado | Contribuinte Individual | Facultativo | Avulso | Empregado Doméstico | Segurado Especial | Servidor Público | Benefício | null",
      "data_inicio": "YYYY-MM-DD",
      "data_fim": "YYYY-MM-DD | null",
      "ultima_remuneracao": 1234.56,
      "indicadores": ["string"],
      "remuneracoes": [
        {
          "competencia": "YYYY-MM-01",
          "valor": 1234.56,
          "indicadores": ["string"]
        }
      ]
    }
  ]
}

Regras obrigatórias:
1. Extraia TODOS os vínculos do documento, mesmo que a tabela quebre entre páginas.
2. Extraia TODAS as remunerações de cada vínculo.
3. Datas no formato ISO: YYYY-MM-DD. Competências sempre com dia 01.
4. Valores monetários como números decimais (ex: 1234.56), sem formatação brasileira.
5. Se data_fim não existir (vínculo ativo/aberto), use null.
6. Se um campo não for encontrado no documento, use null.
7. Mantenha a numeração sequencial dos vínculos (campo "sequencia").
8. O campo "tipo" DEVE ser exatamente um dos valores listados no schema. \
Normalize variações do CNIS (ex: "Empregado ou Agente Público" → "Empregado", \
"Contrib. Individual" → "Contribuinte Individual").
9. Indicadores são os códigos que aparecem ao lado das remunerações \
(ex: IREM-INDPEND, PREC-MENOR-MIN, PEXT, IREC-LC123).
10. Retorne APENAS o JSON, sem texto adicional.\
"""

_USER_PROMPT = "Extraia todos os dados estruturados deste CNIS."


def _safe_date(value: str | None) -> date | None:
    """Converte string ISO (YYYY-MM-DD) para date."""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _safe_decimal(value: float | int | str | None) -> Decimal | None:
    """Converte valor numérico para Decimal."""
    if value is None:
        return None
    try:
        d = Decimal(str(value))
        return d if d > 0 else None
    except (InvalidOperation, ValueError, TypeError):
        return None


def _build_cnis_extraido(data: dict) -> CnisExtraido:
    """Converte o dict JSON do Gemini em CnisExtraido tipado."""
    seg_raw = data.get("segurado") or {}
    segurado = CnisSegurado(
        nome=seg_raw.get("nome"),
        cpf=seg_raw.get("cpf"),
        nit=seg_raw.get("nit"),
        data_nascimento=_safe_date(seg_raw.get("data_nascimento")),
        nome_mae=seg_raw.get("nome_mae"),
    )

    vinculos: list[CnisVinculo] = []
    alertas: list[str] = []

    for i, v_raw in enumerate(data.get("vinculos") or [], start=1):
        remuneracoes: list[Remuneracao] = []
        for r_raw in v_raw.get("remuneracoes") or []:
            comp = _safe_date(r_raw.get("competencia"))
            valor = _safe_decimal(r_raw.get("valor"))
            if comp and valor:
                remuneracoes.append(
                    Remuneracao(
                        competencia=comp,
                        valor=valor,
                        indicadores=r_raw.get("indicadores") or [],
                    )
                )

        data_inicio = _safe_date(v_raw.get("data_inicio"))
        if not data_inicio:
            continue

        v = CnisVinculo(
            sequencia=v_raw.get("sequencia") or i,
            empresa=v_raw.get("empresa"),
            cnpj=v_raw.get("cnpj"),
            tipo=v_raw.get("tipo"),
            data_inicio=data_inicio,
            data_fim=_safe_date(v_raw.get("data_fim")),
            ultima_remuneracao=_safe_decimal(v_raw.get("ultima_remuneracao")),
            indicadores=v_raw.get("indicadores") or [],
            remuneracoes=remuneracoes,
        )
        vinculos.append(v)

    for v in vinculos:
        if v.data_fim is None and v.data_inicio:
            emp = v.empresa or v.cnpj or f"Vínculo {v.sequencia}"
            alertas.append(
                f"Vínculo aberto: '{emp}' "
                f"(início {v.data_inicio.strftime('%d/%m/%Y')})"
            )

    if not vinculos:
        alertas.append(
            "Nenhum vínculo foi encontrado no documento. "
            "Verifique se o arquivo é um CNIS válido do Meu INSS."
        )

    return CnisExtraido(
        segurado=segurado,
        vinculos=vinculos,
        alertas=alertas,
    )


async def parse_cnis_pdf(pdf_bytes: bytes) -> CnisExtraido:
    """Parse do CNIS PDF via Gemini.

    Envia o PDF diretamente ao Gemini para extração estruturada.
    O modelo lê o documento completo, resolvendo tabelas multi-página.

    Args:
        pdf_bytes: Conteúdo do PDF em bytes.

    Returns:
        CnisExtraido com segurado, vínculos e alertas.

    Raises:
        RuntimeError: Se o Gemini falhar ou retornar JSON inválido.
    """
    model = get_gemini_model("parse_cnis")

    text, _ = await analyze_pdf(
        pdf_bytes=pdf_bytes,
        system_instruction=_SYSTEM_INSTRUCTION,
        user_prompt=_USER_PROMPT,
        model=model,
        response_mime_type="application/json",
    )

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("Gemini retornou JSON inválido para CNIS: %s", e)
        raise RuntimeError(
            f"Falha ao interpretar resposta do Gemini: {e}"
        ) from e

    resultado = _build_cnis_extraido(data)

    logger.info(
        "CNIS parseado via Gemini: %d vínculos, %d remunerações totais, %d alertas",
        len(resultado.vinculos),
        sum(len(v.remuneracoes) for v in resultado.vinculos),
        len(resultado.alertas),
    )

    return resultado
