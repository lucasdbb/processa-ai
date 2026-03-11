"""Unified document download endpoint.

Serves signed URLs for any document in ``public.generated_documents``
regardless of whether it was created by an AI job or a calculator.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import require_internal_auth
from src.core.logging import logger
from src.features.core.documents.schemas import DocumentDownloadResponse
from src.features.core.storage.service import StorageService

router = APIRouter()


async def _get_document(document_id: uuid.UUID) -> dict:
    """Fetch a document row from generated_documents by primary key."""
    from src.core.db import get_pool

    try:
        from psycopg.rows import dict_row
    except ModuleNotFoundError:
        dict_row = None

    pool = await get_pool()
    async with pool.connection() as conn:
        kw = {"row_factory": dict_row} if dict_row else {}
        async with conn.cursor(**kw) as cur:
            await cur.execute(
                "SELECT id, user_id, bucket, storage_path, filename "
                "FROM public.generated_documents WHERE id = %s",
                (document_id,),
            )
            row = await cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado"
        )
    return dict(row) if hasattr(row, "keys") else row


@router.get(
    "/{document_id}/download",
    response_model=DocumentDownloadResponse,
    status_code=status.HTTP_200_OK,
)
async def download_document(
    document_id: str,
    expires_in: int = Query(3600, ge=60, le=86400, description="Expiração em segundos"),
    _internal=Depends(require_internal_auth),
):
    """Gera signed URL para download de qualquer documento gerado."""
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="document_id inválido"
        )

    doc = await _get_document(doc_uuid)

    try:
        storage = StorageService()
        signed_url = await storage.generate_signed_url(
            bucket=doc["bucket"],
            storage_path=doc["storage_path"],
            expires_in=expires_in,
        )
    except Exception:
        logger.exception("Erro ao gerar URL de download para documento %s", document_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao gerar URL de download",
        )

    return DocumentDownloadResponse(
        document_id=document_id,
        download_url=signed_url,
        expires_in=expires_in,
        filename=doc.get("filename") or "documento.pdf",
    )
