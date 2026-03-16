"""RAG search for worker AI agents — dual embedding pgvector cosine similarity."""

from __future__ import annotations

from dataclasses import dataclass

from src.core.db import get_pool
from src.core.logging import logger


@dataclass
class RagChunk:
    id: str
    content: str
    section_title: str | None
    area: str
    tema: str | None
    legislacao: str | None
    artigo: str | None
    score: float
    status: str = "vigente"
    revogado_por: str | None = None
    resumo: str | None = None


async def search_legal_chunks(
    query_embedding: list[float],
    *,
    area: str | None = None,
    top_k: int = 10,
    similarity_threshold: float = 0.3,
) -> list[RagChunk]:
    """Search RAG chunks using dual embedding (content + resumo) with pgvector.

    Searches both the original content embedding and the resumo embedding,
    taking the best score from either. This handles cases where the user's
    query matches the modern-language resumo better than the archaic original text.

    Filters out quality=0 chunks (empty/useless).
    Prioritizes vigente chunks with a score boost.

    Args:
        query_embedding: The embedding vector for the query (768 dims).
        area: Optional area filter (e.g., "trabalhista").
        top_k: Maximum number of results.
        similarity_threshold: Minimum cosine similarity to include.

    Returns:
        List of RagChunk sorted by relevance (highest score first).
    """
    pool = await get_pool()
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    conditions = ["quality > 0"]
    params: list = []

    if area:
        conditions.append("area = %s")
        params.append(area)

    where = " AND ".join(conditions)

    # Dual embedding search: take the BEST score from content or resumo embedding
    # GREATEST picks the higher similarity between the two vectors
    query = f"""
        WITH scored AS (
            SELECT
                id, content, section_title, area, tema, legislacao, artigo,
                status, revogado_por, resumo,
                GREATEST(
                    CASE WHEN embedding IS NOT NULL
                         THEN 1 - (embedding <=> %s::vector)
                         ELSE 0 END,
                    CASE WHEN embedding_resumo IS NOT NULL
                         THEN 1 - (embedding_resumo <=> %s::vector)
                         ELSE 0 END
                ) AS raw_score
            FROM public.rag_chunks
            WHERE {where}
        )
        SELECT *,
            CASE status
                WHEN 'vigente'  THEN raw_score
                WHEN 'alterado' THEN raw_score * 0.9
                ELSE                 raw_score * 0.7
            END AS boosted_score
        FROM scored
        WHERE raw_score >= %s
        ORDER BY boosted_score DESC
        LIMIT %s
    """
    params = [embedding_str, embedding_str] + params + [similarity_threshold, top_k]

    try:
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, params)
                rows = await cur.fetchall()
    except Exception:
        logger.exception("RAG search failed")
        return []

    return [
        RagChunk(
            id=str(r[0]),
            content=r[1],
            section_title=r[2],
            area=r[3],
            tema=r[4],
            legislacao=r[5],
            artigo=r[6],
            score=float(r[10]),  # raw_score
            status=r[7] or "vigente",
            revogado_por=r[8],
            resumo=r[9],
        )
        for r in rows
    ]
