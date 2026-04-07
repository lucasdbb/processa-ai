"""RAG search for the chat — dual embedding pgvector cosine + text filtering."""

from __future__ import annotations

from dataclasses import dataclass

from psycopg_pool import AsyncConnectionPool

from src.core.logging import logger


@dataclass
class RagChunk:
    id: str
    document_id: str
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
    pool: AsyncConnectionPool,
    query_embedding: list[float],
    *,
    area: str | None = None,
    top_k: int = 10,
    similarity_threshold: float = 0.5,
) -> list[RagChunk]:
    """Search RAG chunks using dual embedding (content + resumo) with pgvector.

    Searches both the original content embedding and the resumo embedding,
    taking the best score from either. This handles cases where the user's
    query matches the modern-language resumo better than the archaic original text.

    Filters out quality=0 chunks (empty/useless).
    Prioritizes vigente chunks with a score boost.

    Args:
        pool: Database connection pool.
        query_embedding: The embedding vector for the user's query (768 dims).
        area: Optional area filter (e.g., "trabalhista").
        top_k: Maximum number of results.
        similarity_threshold: Minimum cosine similarity to include.

    Returns:
        List of RagChunk sorted by relevance (highest score first).
    """
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    conditions = ["quality > 0"]
    params: list = []

    if area:
        conditions.append("area = %s")
        params.append(area)

    where = " AND ".join(conditions)

    # Dual embedding search: take the BEST score from content or resumo embedding
    query = f"""
        WITH scored AS (
            SELECT
                id, document_id, content, section_title, area, tema, legislacao, artigo,
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

    # Columns: id(0), document_id(1), content(2), section_title(3), area(4),
    #          tema(5), legislacao(6), artigo(7), status(8), revogado_por(9),
    #          resumo(10), raw_score(11), boosted_score(12)
    return [
        RagChunk(
            id=str(r[0]),
            document_id=str(r[1]),
            content=r[2],
            section_title=r[3],
            area=r[4],
            tema=r[5],
            legislacao=r[6],
            artigo=r[7],
            score=float(r[11]),
            status=r[8] or "vigente",
            revogado_por=r[9],
            resumo=r[10],
        )
        for r in rows
    ]
