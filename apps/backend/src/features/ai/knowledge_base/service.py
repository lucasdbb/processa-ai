"""Knowledge Base service — CRUD for RAG documents, taxonomy, and job enqueuing."""

from __future__ import annotations

import uuid

from src.core.db import get_pool
from src.core.logging import logger
from src.core.queue import enqueue_job
from src.features.core.storage.service import StorageService


class KnowledgeBaseService:
    # ── Taxonomy ──────────────────────────────────────────

    async def get_taxonomy(self) -> dict:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT id, name, slug, description FROM public.legal_areas ORDER BY name"
                )
                area_rows = await cur.fetchall()

                await cur.execute(
                    "SELECT id, area_id, name, slug, keywords FROM public.legal_topics ORDER BY name"
                )
                topic_rows = await cur.fetchall()

        areas = [
            {"id": str(r[0]), "name": r[1], "slug": r[2], "description": r[3]} for r in area_rows
        ]
        topics = [
            {
                "id": str(r[0]),
                "area_id": str(r[1]),
                "name": r[2],
                "slug": r[3],
                "keywords": r[4] or [],
            }
            for r in topic_rows
        ]
        return {"areas": areas, "topics": topics}

    async def create_area(self, name: str, slug: str, description: str | None) -> dict:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO public.legal_areas (name, slug, description)
                    VALUES (%s, %s, %s)
                    RETURNING id, name, slug, description
                    """,
                    (name, slug, description),
                )
                row = await cur.fetchone()
        return {"id": str(row[0]), "name": row[1], "slug": row[2], "description": row[3]}

    async def create_topic(self, area_id: str, name: str, slug: str, keywords: list[str]) -> dict:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO public.legal_topics (area_id, name, slug, keywords)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, area_id, name, slug, keywords
                    """,
                    (area_id, name, slug, keywords),
                )
                row = await cur.fetchone()
        return {
            "id": str(row[0]),
            "area_id": str(row[1]),
            "name": row[2],
            "slug": row[3],
            "keywords": row[4] or [],
        }

    async def delete_area(self, area_id: str) -> bool:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                # Check if area has documents
                await cur.execute(
                    "SELECT count(*) FROM public.rag_documents WHERE area_id = %s",
                    (area_id,),
                )
                count = (await cur.fetchone())[0]
                if count > 0:
                    return False

                await cur.execute("DELETE FROM public.legal_areas WHERE id = %s", (area_id,))
                return cur.rowcount > 0

    async def delete_topic(self, topic_id: str) -> bool:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM public.legal_topics WHERE id = %s", (topic_id,))
                return cur.rowcount > 0

    # ── Documents ─────────────────────────────────────────

    async def list_documents(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        area_id: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> tuple[list[dict], int]:
        pool = await get_pool()
        conditions = []
        params: list = []

        if area_id:
            conditions.append("d.area_id = %s")
            params.append(area_id)
        if status:
            conditions.append("d.status = %s")
            params.append(status)
        if search:
            conditions.append("d.original_filename ILIKE %s")
            params.append(f"%{search}%")

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(f"SELECT count(*) FROM public.rag_documents d {where}", params)
                total = (await cur.fetchone())[0]

                await cur.execute(
                    f"""
                    SELECT d.id, d.filename, d.original_filename, d.document_type,
                           d.status, d.error_message, d.total_chunks, d.is_compound,
                           d.area_id, a.name AS area_name,
                           d.topic_id, t.name AS topic_name,
                           d.created_at, d.updated_at,
                           d.progress, d.progress_message
                    FROM public.rag_documents d
                    LEFT JOIN public.legal_areas a ON a.id = d.area_id
                    LEFT JOIN public.legal_topics t ON t.id = d.topic_id
                    {where}
                    ORDER BY d.created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    params + [limit, offset],
                )
                rows = await cur.fetchall()

        documents = [self._doc_row_to_dict(r) for r in rows]
        return documents, total

    async def get_document(self, document_id: str) -> dict | None:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT d.id, d.filename, d.original_filename, d.document_type,
                           d.status, d.error_message, d.total_chunks, d.is_compound,
                           d.area_id, a.name AS area_name,
                           d.topic_id, t.name AS topic_name,
                           d.created_at, d.updated_at,
                           d.progress, d.progress_message
                    FROM public.rag_documents d
                    LEFT JOIN public.legal_areas a ON a.id = d.area_id
                    LEFT JOIN public.legal_topics t ON t.id = d.topic_id
                    WHERE d.id = %s
                    """,
                    (document_id,),
                )
                row = await cur.fetchone()
        return self._doc_row_to_dict(row) if row else None

    async def get_document_chunks(self, document_id: str) -> list[dict]:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT id, content, section_title, area, legislacao, artigo, chunk_index
                    FROM public.rag_chunks
                    WHERE document_id = %s
                    ORDER BY chunk_index
                    """,
                    (document_id,),
                )
                rows = await cur.fetchall()

        return [
            {
                "id": str(r[0]),
                "content": r[1],
                "section_title": r[2],
                "area": r[3],
                "legislacao": r[4],
                "artigo": r[5],
                "chunk_index": r[6],
            }
            for r in rows
        ]

    async def upload_document(
        self,
        *,
        user_id: str,
        filename: str,
        storage_path: str,
        bucket: str,
        area_id: str | None,
        topic_id: str | None,
    ) -> dict:
        """Create rag_documents record and enqueue ingestion job."""
        doc_id = str(uuid.uuid4())
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO public.rag_documents
                        (id, uploaded_by, filename, original_filename,
                         storage_path, bucket, area_id, topic_id, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                    RETURNING id, filename, original_filename, document_type,
                              status, error_message, total_chunks, is_compound,
                              area_id, NULL, topic_id, NULL,
                              created_at, updated_at,
                              progress, progress_message
                    """,
                    (doc_id, user_id, filename, filename, storage_path, bucket, area_id, topic_id),
                )
                row = await cur.fetchone()

        # Get area slug for classifier hint
        area_slug = None
        if area_id:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT slug FROM public.legal_areas WHERE id = %s", (area_id,)
                    )
                    area_row = await cur.fetchone()
                    if area_row:
                        area_slug = area_row[0]

        # Enqueue ingestion job
        job_id = f"rag:{doc_id}"
        await enqueue_job(
            {
                "job_id": job_id,
                "type": "rag_ingest",
                "payload": {
                    "document_id": doc_id,
                    "storage_path": storage_path,
                    "bucket": bucket,
                    "source_type": "pdf",
                    "original_filename": filename,
                    "area_slug": area_slug,
                },
            }
        )

        logger.info("RAG document created and queued: %s (job: %s)", doc_id, job_id)
        return self._doc_row_to_dict(row)

    async def create_text_document(
        self,
        *,
        user_id: str,
        title: str,
        content: str,
        area_id: str,
        legislacao: str | None = None,
        artigo: str | None = None,
    ) -> dict:
        """Create a text-based RAG document and enqueue ingestion."""
        doc_id = str(uuid.uuid4())
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO public.rag_documents
                        (id, uploaded_by, filename, original_filename,
                         storage_path, bucket, document_type, area_id, status)
                    VALUES (%s, %s, %s, %s, 'text-input', 'none', 'texto', %s, 'pending')
                    RETURNING id, filename, original_filename, document_type,
                              status, error_message, total_chunks, is_compound,
                              area_id, NULL, topic_id, NULL,
                              created_at, updated_at,
                              progress, progress_message
                    """,
                    (doc_id, user_id, title, title, area_id),
                )
                row = await cur.fetchone()

        # Get area slug
        area_slug = None
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT slug FROM public.legal_areas WHERE id = %s", (area_id,))
                area_row = await cur.fetchone()
                if area_row:
                    area_slug = area_row[0]

        # Enqueue
        job_id = f"rag:{doc_id}"
        await enqueue_job(
            {
                "job_id": job_id,
                "type": "rag_ingest",
                "payload": {
                    "document_id": doc_id,
                    "source_type": "text",
                    "content": content,
                    "area_slug": area_slug,
                    "legislacao": legislacao,
                    "original_filename": title,
                },
            }
        )

        logger.info("RAG text document created and queued: %s", doc_id)
        return self._doc_row_to_dict(row)

    async def create_url_document(
        self,
        *,
        user_id: str,
        url: str,
        area_id: str,
        title: str | None = None,
    ) -> dict:
        """Create a URL-based RAG document and enqueue ingestion."""
        doc_id = str(uuid.uuid4())
        display_title = title or url[:100]
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO public.rag_documents
                        (id, uploaded_by, filename, original_filename,
                         storage_path, bucket, document_type, area_id, status)
                    VALUES (%s, %s, %s, %s, %s, 'none', 'url', %s, 'pending')
                    RETURNING id, filename, original_filename, document_type,
                              status, error_message, total_chunks, is_compound,
                              area_id, NULL, topic_id, NULL,
                              created_at, updated_at,
                              progress, progress_message
                    """,
                    (doc_id, user_id, display_title, display_title, url, area_id),
                )
                row = await cur.fetchone()

        # Get area slug
        area_slug = None
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT slug FROM public.legal_areas WHERE id = %s", (area_id,))
                area_row = await cur.fetchone()
                if area_row:
                    area_slug = area_row[0]

        # Enqueue
        job_id = f"rag:{doc_id}"
        await enqueue_job(
            {
                "job_id": job_id,
                "type": "rag_ingest",
                "payload": {
                    "document_id": doc_id,
                    "source_type": "url",
                    "url": url,
                    "area_slug": area_slug,
                    "original_filename": display_title,
                },
            }
        )

        logger.info("RAG URL document created and queued: %s", doc_id)
        return self._doc_row_to_dict(row)

    async def delete_document(self, document_id: str) -> bool:
        """Delete a RAG document, its chunks (CASCADE), and storage file."""
        pool = await get_pool()

        # Get storage info before deleting
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT bucket, storage_path FROM public.rag_documents WHERE id = %s",
                    (document_id,),
                )
                row = await cur.fetchone()

        if not row:
            return False

        bucket, storage_path = row[0], row[1]

        # Delete from storage (if it's an actual file, not text-input)
        if bucket and bucket != "none" and storage_path and storage_path != "text-input":
            try:
                storage = StorageService()
                await storage.delete_file(bucket=bucket, storage_path=storage_path)
            except Exception:
                logger.warning("Failed to delete storage file %s/%s", bucket, storage_path)

        # Delete from database (CASCADE deletes chunks)
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM public.rag_documents WHERE id = %s", (document_id,))
                return cur.rowcount > 0

    # ── Stats ─────────────────────────────────────────────

    async def get_stats(self) -> dict:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT count(*) FROM public.rag_documents")
                total_documents = (await cur.fetchone())[0]

                await cur.execute("SELECT count(*) FROM public.rag_chunks")
                total_chunks = (await cur.fetchone())[0]

                await cur.execute(
                    "SELECT status, count(*) FROM public.rag_documents GROUP BY status"
                )
                status_rows = await cur.fetchall()
                documents_by_status = {r[0]: r[1] for r in status_rows}

                await cur.execute(
                    "SELECT area, count(*) FROM public.rag_chunks GROUP BY area ORDER BY count(*) DESC"
                )
                area_rows = await cur.fetchall()
                chunks_by_area = {r[0]: r[1] for r in area_rows}

        return {
            "total_documents": total_documents,
            "total_chunks": total_chunks,
            "documents_by_status": documents_by_status,
            "chunks_by_area": chunks_by_area,
        }

    # ── Helpers ───────────────────────────────────────────

    @staticmethod
    def _doc_row_to_dict(row: tuple) -> dict:
        return {
            "id": str(row[0]),
            "filename": row[1],
            "original_filename": row[2],
            "document_type": row[3],
            "status": row[4],
            "error_message": row[5],
            "total_chunks": row[6] or 0,
            "is_compound": bool(row[7]),
            "area_id": str(row[8]) if row[8] else None,
            "area_name": row[9],
            "topic_id": str(row[10]) if row[10] else None,
            "topic_name": row[11],
            "created_at": row[12].isoformat() if row[12] else "",
            "updated_at": row[13].isoformat() if row[13] else "",
            "progress": row[14] if len(row) > 14 else 0,
            "progress_message": row[15] if len(row) > 15 else None,
        }
