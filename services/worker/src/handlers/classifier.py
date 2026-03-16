"""Taxonomic classifier for legal documents."""

from __future__ import annotations

import re

from src.core.logging import logger

# Dictionary mapping legislation names/patterns to legal areas
LEGISLATION_AREA_MAP: dict[str, str] = {
    # Trabalhista
    "clt": "trabalhista",
    "consolidação das leis do trabalho": "trabalhista",
    "lei 13.467": "trabalhista",  # Reforma Trabalhista
    "súmula.*tst": "trabalhista",
    "orientação jurisprudencial.*tst": "trabalhista",
    # Previdenciário
    "lei 8.213": "previdenciario",
    "lei 8.212": "previdenciario",
    "inss": "previdenciario",
    "benefício previdenciário": "previdenciario",
    "aposentadoria": "previdenciario",
    # Civil
    "código civil": "civil",
    "lei 10.406": "civil",
    "lei 13.105": "processual-civil",  # CPC
    "código de processo civil": "processual-civil",
    "cpc": "processual-civil",
    # Consumidor
    "cdc": "consumidor",
    "código de defesa do consumidor": "consumidor",
    "lei 8.078": "consumidor",
    # Constitucional
    "constituição federal": "constitucional",
    "cf/88": "constitucional",
    "emenda constitucional": "constitucional",
    # Penal
    "código penal": "penal",
    "lei 2.848": "penal",
    "cpp": "penal",
    "código de processo penal": "penal",
    # Administrativo
    "lei 8.666": "administrativo",
    "lei 14.133": "administrativo",  # Nova lei de licitações
    "lei 9.784": "administrativo",
}

# Patterns for compound documents (e.g., Vade Mecum)
COMPOUND_PATTERNS = [
    re.compile(r"vade\s*mecum", re.IGNORECASE),
    re.compile(r"coletânea\s+de\s+leis", re.IGNORECASE),
    re.compile(r"legislação\s+compilada", re.IGNORECASE),
]


def classify_area(text: str, *, filename: str = "") -> str | None:
    """Classify the legal area of a document based on its content.

    Args:
        text: Document text (or first ~2000 chars for efficiency).
        filename: Original filename for additional hints.

    Returns:
        Area slug (e.g., "trabalhista") or None if unclassifiable.
    """
    sample = (text[:3000] + " " + filename).lower()

    # Score each area by keyword matches
    area_scores: dict[str, int] = {}

    for pattern, area in LEGISLATION_AREA_MAP.items():
        try:
            matches = len(re.findall(pattern, sample, re.IGNORECASE))
            if matches > 0:
                area_scores[area] = area_scores.get(area, 0) + matches
        except re.error:
            if pattern in sample:
                area_scores[area] = area_scores.get(area, 0) + 1

    if not area_scores:
        logger.info("Could not classify area for document: %s", filename)
        return None

    best_area = max(area_scores, key=lambda k: area_scores[k])
    logger.info(
        "Classified document '%s' as area '%s' (scores: %s)",
        filename,
        best_area,
        area_scores,
    )
    return best_area


def detect_compound_document(text: str, *, filename: str = "") -> bool:
    """Detect if a document is a compound document (e.g., Vade Mecum).

    Compound documents contain multiple laws and need special handling.
    """
    sample = text[:5000] + " " + filename

    for pattern in COMPOUND_PATTERNS:
        if pattern.search(sample):
            return True

    # Heuristic: if more than 3 different areas are detected, likely compound
    sample_lower = sample.lower()
    areas_found = set()
    for pattern, area in LEGISLATION_AREA_MAP.items():
        try:
            if re.search(pattern, sample_lower, re.IGNORECASE):
                areas_found.add(area)
        except re.error:
            if pattern in sample_lower:
                areas_found.add(area)

    return len(areas_found) >= 4


def extract_legislacao_from_text(text: str) -> str | None:
    """Try to extract the legislation name from the beginning of a document."""
    first_lines = text[:500]

    # Common patterns for law names
    patterns = [
        r"(LEI\s+(?:Nº\s*)?[\d.]+(?:/\d+)?)",
        r"(DECRETO(?:-LEI)?\s+(?:Nº\s*)?[\d.]+(?:/\d+)?)",
        r"(CONSOLIDAÇÃO\s+DAS\s+LEIS\s+DO\s+TRABALHO)",
        r"(CÓDIGO\s+(?:CIVIL|PENAL|DE\s+PROCESSO\s+\w+|DE\s+DEFESA\s+DO\s+CONSUMIDOR))",
        r"(CONSTITUIÇÃO\s+(?:DA\s+REPÚBLICA\s+)?FEDERAL(?:IVA)?)",
        r"(SÚMULA\s+(?:Nº\s*)?\d+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, first_lines, re.IGNORECASE)
        if match:
            return match.group(1).strip()

    return None
