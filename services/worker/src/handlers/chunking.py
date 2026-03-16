"""Legal document chunking — articles as atomic units."""

from __future__ import annotations

import re
from dataclasses import dataclass

MIN_CHUNK_SIZE = 200
MAX_CHUNK_SIZE = 2400
OVERLAP_SIZE = 150

# Regex patterns for legal article boundaries
ARTICLE_PATTERN = re.compile(
    r"^(Art(?:igo)?\.?\s*\d+[\w.-]*)", re.MULTILINE | re.IGNORECASE
)
SECTION_PATTERN = re.compile(
    r"^(TÍTULO|CAPÍTULO|SEÇÃO|SUBSEÇÃO|LIVRO|PARTE)\s+",
    re.MULTILINE | re.IGNORECASE,
)


@dataclass
class LegalChunk:
    content: str
    section_title: str | None
    legislacao: str | None
    artigo: str | None
    chunk_index: int


def chunk_legal_text(
    text: str,
    *,
    legislacao: str | None = None,
) -> list[LegalChunk]:
    """Split legal text into chunks using articles as atomic units.

    Strategy:
    1. Try to split by article boundaries (Art. N)
    2. If no articles found, fall back to paragraph-based splitting
    3. Merge small chunks, split oversized chunks

    Args:
        text: The full extracted text.
        legislacao: Name of the legislation (e.g., "CLT", "Código Civil").

    Returns:
        List of LegalChunk with content and metadata.
    """
    if not text or not text.strip():
        return []

    # Try article-based splitting first
    chunks = _split_by_articles(text, legislacao=legislacao)

    # Fallback to paragraph splitting if no articles found
    if not chunks:
        chunks = _split_by_paragraphs(text, legislacao=legislacao)

    # Merge small chunks and split oversized ones
    chunks = _normalize_chunks(chunks)

    # Re-index
    for i, chunk in enumerate(chunks):
        chunk.chunk_index = i

    return chunks


def _split_by_articles(text: str, *, legislacao: str | None) -> list[LegalChunk]:
    """Split text by article boundaries."""
    splits = ARTICLE_PATTERN.split(text)

    if len(splits) <= 1:
        return []

    chunks: list[LegalChunk] = []
    current_section: str | None = None

    # First element is text before any article
    preamble = splits[0].strip()
    if preamble and len(preamble) >= MIN_CHUNK_SIZE:
        # Check for section title in preamble
        section_match = SECTION_PATTERN.search(preamble)
        if section_match:
            current_section = preamble[section_match.start() :].split("\n")[0].strip()

        chunks.append(
            LegalChunk(
                content=preamble,
                section_title=current_section,
                legislacao=legislacao,
                artigo=None,
                chunk_index=0,
            )
        )

    # Process article pairs (header, body)
    for i in range(1, len(splits), 2):
        article_header = splits[i].strip()
        article_body = splits[i + 1].strip() if i + 1 < len(splits) else ""

        # Extract article number
        artigo_match = re.match(r"Art(?:igo)?\.?\s*(\d+[\w.-]*)", article_header, re.IGNORECASE)
        artigo = f"Art. {artigo_match.group(1)}" if artigo_match else article_header

        # Check for section changes within body
        section_match = SECTION_PATTERN.search(article_body)
        if section_match:
            current_section = article_body[section_match.start() :].split("\n")[0].strip()

        content = f"{article_header} {article_body}".strip()

        chunks.append(
            LegalChunk(
                content=content,
                section_title=current_section,
                legislacao=legislacao,
                artigo=artigo,
                chunk_index=0,
            )
        )

    return chunks


def _split_by_paragraphs(text: str, *, legislacao: str | None) -> list[LegalChunk]:
    """Fallback: split by double newlines / paragraphs."""
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: list[LegalChunk] = []
    current_content = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_content) + len(para) + 1 > MAX_CHUNK_SIZE and current_content:
            chunks.append(
                LegalChunk(
                    content=current_content.strip(),
                    section_title=None,
                    legislacao=legislacao,
                    artigo=None,
                    chunk_index=0,
                )
            )
            # Keep overlap
            current_content = current_content[-OVERLAP_SIZE:] + "\n" + para
        else:
            current_content += ("\n" if current_content else "") + para

    if current_content.strip():
        chunks.append(
            LegalChunk(
                content=current_content.strip(),
                section_title=None,
                legislacao=legislacao,
                artigo=None,
                chunk_index=0,
            )
        )

    return chunks


def _normalize_chunks(chunks: list[LegalChunk]) -> list[LegalChunk]:
    """Merge small chunks and split oversized chunks."""
    if not chunks:
        return []

    normalized: list[LegalChunk] = []

    for chunk in chunks:
        if len(chunk.content) > MAX_CHUNK_SIZE:
            # Split oversized chunk
            text = chunk.content
            while text:
                split_point = min(MAX_CHUNK_SIZE, len(text))

                # Try to split at a sentence boundary
                if split_point < len(text):
                    last_period = text.rfind(".", 0, split_point)
                    if last_period > MIN_CHUNK_SIZE:
                        split_point = last_period + 1

                part = text[:split_point].strip()
                if part:
                    normalized.append(
                        LegalChunk(
                            content=part,
                            section_title=chunk.section_title,
                            legislacao=chunk.legislacao,
                            artigo=chunk.artigo,
                            chunk_index=0,
                        )
                    )

                # Keep overlap for continuity
                overlap_start = max(0, split_point - OVERLAP_SIZE)
                text = text[overlap_start:] if split_point < len(text) else ""
                if text == part:
                    break

        elif len(chunk.content) < MIN_CHUNK_SIZE and normalized:
            # Merge with previous chunk if it won't exceed max
            prev = normalized[-1]
            merged = prev.content + "\n" + chunk.content
            if len(merged) <= MAX_CHUNK_SIZE:
                prev.content = merged
            else:
                normalized.append(chunk)
        else:
            normalized.append(chunk)

    return normalized
