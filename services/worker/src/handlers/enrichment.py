"""LLM-based document classification and chunk enrichment.

Two strategic LLM calls per document:
1. classify_document — identifies legislação, area, tipo from first ~3000 chars
2. enrich_chunks_batch — adds tema, resumo, quality, and revogado_por per chunk

Uses gemini-flash-lite for minimal cost (~US$ 0.006 per CLT-sized document).
"""

from __future__ import annotations

import json
import re

from google import genai
from google.genai.types import GenerateContentConfig

from src.core.config import settings
from src.core.logging import logger

_client: genai.Client | None = None

# Model used for enrichment (cheap, fast) — configurable via env
ENRICHMENT_MODEL = settings.GEMINI_ENRICHMENT_MODEL

# Max chunks per enrichment batch (balance between token usage and API calls)
ENRICHMENT_BATCH_SIZE = 50

# Max chars per chunk in compact representation sent to LLM
COMPACT_CHUNK_CHARS = 200


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


# ──────────────────────────────────────────────────────────────────────
# Step 1: Document classification
# ──────────────────────────────────────────────────────────────────────

CLASSIFY_PROMPT = """\
Você é um classificador de documentos jurídicos brasileiros.
Analise o trecho inicial do documento abaixo e retorne SOMENTE um JSON válido (sem markdown, sem ```).

Campos obrigatórios:
- "legislacao": nome completo da legislação (ex: "CLT - Decreto-Lei nº 5.452/1943", "Código Civil - Lei nº 10.406/2002", "Súmula 331 do TST"). Se não for legislação, descreva o documento.
- "area": slug da área jurídica. Escolha EXATAMENTE uma destas opções: {areas}
- "tipo": tipo do documento. Escolha uma: "legislacao", "jurisprudencia", "sumula", "doutrina", "parecer", "contrato", "outro"

Responda APENAS com o JSON, nada mais.

--- TRECHO DO DOCUMENTO ---
{text}
"""


async def classify_document(
    text: str,
    *,
    available_areas: list[str] | None = None,
) -> dict:
    """Classify a document using LLM analysis of the first ~3000 chars.

    Returns dict with keys: legislacao, area, tipo.
    Falls back to empty values if LLM fails.
    """
    areas = available_areas or [
        "trabalhista", "previdenciario", "civil", "processual-civil",
        "consumidor", "constitucional", "penal", "administrativo",
        "tributario", "ambiental", "empresarial", "familia", "geral",
    ]

    sample = text[:3000]
    prompt = CLASSIFY_PROMPT.format(areas=", ".join(areas), text=sample)

    try:
        client = _get_client()
        response = client.models.generate_content(
            model=ENRICHMENT_MODEL,
            contents=prompt,
            config=GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=300,
            ),
        )

        raw = response.text.strip()
        result = _parse_json(raw)

        if result:
            # Validate area against allowed list
            if result.get("area") not in areas:
                result["area"] = "geral"
            logger.info(
                "LLM classified document: legislacao=%s, area=%s, tipo=%s",
                result.get("legislacao"),
                result.get("area"),
                result.get("tipo"),
            )
            return result

    except Exception as e:
        logger.warning("LLM document classification failed: %s", e)

    return {"legislacao": None, "area": "geral", "tipo": "outro"}


# ──────────────────────────────────────────────────────────────────────
# Step 2: Chunk enrichment (batch)
# ──────────────────────────────────────────────────────────────────────

ENRICH_PROMPT = """\
Você é um especialista em direito brasileiro. Analise os chunks de um documento jurídico e enriqueça cada um.

Documento: {legislacao} (área: {area})

Para cada chunk, retorne:
- "i": índice do chunk (OBRIGATÓRIO, número inteiro)
- "tema": tema específico em slug (ex: "jornada-de-trabalho", "ferias", "rescisao-contratual", "verbas-rescisorias"). Use sempre lowercase com hífens, sem acentos.
- "resumo": uma frase curta em linguagem moderna que descreve o conteúdo do artigo. Máximo 120 caracteres. Ex: "Limite da jornada: 8h diárias e 44h semanais, com possibilidade de compensação"
- "quality": 0 se o chunk é inútil (artigo só com "Revogado." ou texto vazio), 1 se normal, 2 se altamente relevante (artigo muito citado na prática)
- "revogado_por": se o chunk está marcado como revogado/alterado, identifique a lei alteradora. Null se vigente.

Retorne SOMENTE um JSON array válido (sem markdown, sem ```). Exemplo:
[{{"i":0,"tema":"disposicoes-preliminares","resumo":"Aprovação da CLT","quality":1,"revogado_por":null}}]

--- CHUNKS ---
{chunks}
"""


async def enrich_chunks(
    chunks_data: list[dict],
    *,
    legislacao: str | None = None,
    area: str = "geral",
) -> list[dict]:
    """Enrich chunks with tema, resumo, quality, and revogado_por using LLM.

    Args:
        chunks_data: List of dicts with keys: index, content, artigo, status.
        legislacao: Name of the legislation.
        area: Legal area slug.

    Returns:
        List of enrichment dicts with keys: i, tema, resumo, quality, revogado_por.
        Missing chunks get default values.
    """
    all_enrichments: list[dict] = []

    for batch_start in range(0, len(chunks_data), ENRICHMENT_BATCH_SIZE):
        batch = chunks_data[batch_start : batch_start + ENRICHMENT_BATCH_SIZE]

        compact = _build_compact_representation(batch)
        prompt = ENRICH_PROMPT.format(
            legislacao=legislacao or "Documento jurídico",
            area=area,
            chunks=compact,
        )

        try:
            client = _get_client()
            response = client.models.generate_content(
                model=ENRICHMENT_MODEL,
                contents=prompt,
                config=GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=4096,
                ),
            )

            raw = response.text.strip()
            batch_result = _parse_json_array(raw)

            if batch_result:
                all_enrichments.extend(batch_result)
                logger.info(
                    "Enriched batch %d-%d: %d chunks",
                    batch_start,
                    batch_start + len(batch),
                    len(batch_result),
                )
            else:
                logger.warning("LLM returned unparseable enrichment for batch %d", batch_start)
                all_enrichments.extend(_default_enrichments(batch))

        except Exception as e:
            logger.warning("LLM enrichment failed for batch %d: %s", batch_start, e)
            all_enrichments.extend(_default_enrichments(batch))

    return all_enrichments


def _build_compact_representation(chunks: list[dict]) -> str:
    """Build a compact text representation of chunks for the LLM prompt.

    Sends only index + artigo + status + first N chars of content.
    This massively reduces token usage compared to sending full content.
    """
    lines = []
    for c in chunks:
        idx = c["index"]
        artigo = c.get("artigo") or "—"
        status = c.get("status", "vigente")
        content = c["content"][:COMPACT_CHUNK_CHARS].replace("\n", " ")

        status_tag = f" ({status})" if status != "vigente" else ""
        revogado_por = c.get("revogado_por")
        ref_tag = f" [ref: {revogado_por}]" if revogado_por else ""

        lines.append(f"[{idx}] {artigo}{status_tag}{ref_tag}: \"{content}\"")

    return "\n".join(lines)


def _default_enrichments(batch: list[dict]) -> list[dict]:
    """Generate default enrichment values when LLM fails."""
    return [
        {
            "i": c["index"],
            "tema": None,
            "resumo": None,
            "quality": 1,
            "revogado_por": c.get("revogado_por"),
        }
        for c in batch
    ]


# ──────────────────────────────────────────────────────────────────────
# JSON parsing helpers
# ──────────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict | None:
    """Parse a JSON object from LLM output, stripping markdown fences if present."""
    text = _strip_markdown_fences(text)
    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        # Try to extract JSON object from mixed text
        match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None


def _parse_json_array(text: str) -> list[dict] | None:
    """Parse a JSON array from LLM output."""
    text = _strip_markdown_fences(text)
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        # Try to find array in text
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group())
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass
    return None


def _strip_markdown_fences(text: str) -> str:
    """Strip ```json ... ``` fences from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()
