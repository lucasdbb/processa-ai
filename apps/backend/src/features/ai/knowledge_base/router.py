"""Knowledge Base API routes — admin-only endpoints for RAG document management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from src.core.auth import get_current_admin, get_user_id, require_internal_auth
from src.core.logging import logger
from src.features.ai.knowledge_base.schemas import (
    CreateAreaRequest,
    CreateTopicRequest,
    KnowledgeBaseStatsResponse,
    LegalAreaResponse,
    LegalTopicResponse,
    RagDocumentDetailResponse,
    RagDocumentListResponse,
    RagDocumentResponse,
    TaxonomyResponse,
    TextDocumentRequest,
    UrlDocumentRequest,
)
from src.features.ai.knowledge_base.service import KnowledgeBaseService
from src.features.core.storage.service import StorageService

router = APIRouter()
kb_service = KnowledgeBaseService()


# ── Taxonomy ──────────────────────────────────────────────


@router.get("/taxonomy", response_model=TaxonomyResponse)
async def get_taxonomy(_internal=Depends(require_internal_auth)):
    """Retorna árvore de taxonomia (áreas + tópicos)."""
    data = await kb_service.get_taxonomy()
    return TaxonomyResponse(**data)


@router.post(
    "/taxonomy/areas",
    response_model=LegalAreaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_area(
    data: CreateAreaRequest,
    _internal=Depends(require_internal_auth),
    _admin=Depends(get_current_admin),
):
    """Criar nova área jurídica (admin-only)."""

    try:
        result = await kb_service.create_area(data.name, data.slug, data.description)
        return LegalAreaResponse(**result)
    except Exception:
        logger.exception("Failed to create area")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Erro ao criar área",
        )


@router.post(
    "/taxonomy/topics",
    response_model=LegalTopicResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_topic(
    data: CreateTopicRequest,
    _internal=Depends(require_internal_auth),
    _admin=Depends(get_current_admin),
):
    """Criar novo tópico jurídico (admin-only)."""
    try:
        result = await kb_service.create_topic(data.area_id, data.name, data.slug, data.keywords)
        return LegalTopicResponse(**result)
    except Exception:
        logger.exception("Failed to create topic")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Erro ao criar tópico",
        )


@router.delete("/taxonomy/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_area(
    area_id: str,
    _internal=Depends(require_internal_auth),
    _admin=Depends(get_current_admin),
):
    """Deletar área jurídica (falha se tiver documentos vinculados)."""
    deleted = await kb_service.delete_area(area_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível deletar: área possui documentos vinculados ou não existe",
        )
    return None


@router.delete("/taxonomy/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    topic_id: str,
    _internal=Depends(require_internal_auth),
    _admin=Depends(get_current_admin),
):
    """Deletar tópico jurídico."""
    deleted = await kb_service.delete_topic(topic_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tópico não encontrado")
    return None


# ── Documents ─────────────────────────────────────────────


@router.get("/documents", response_model=RagDocumentListResponse)
async def list_documents(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    area_id: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    _internal=Depends(require_internal_auth),
):
    """Listar documentos RAG com filtros."""
    documents, total = await kb_service.list_documents(
        limit=limit,
        offset=offset,
        area_id=area_id,
        status=status_filter,
        search=search,
    )
    return RagDocumentListResponse(
        documents=[RagDocumentResponse(**d) for d in documents],
        total=total,
    )


@router.post(
    "/documents/upload",
    response_model=RagDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    area_id: str | None = Form(None),
    topic_id: str | None = Form(None),
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
    _admin=Depends(get_current_admin),
):
    """Upload PDF para a base de conhecimento."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo sem nome")

    content_type = (file.content_type or "").lower()
    if "pdf" not in content_type and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas arquivos PDF são aceitos",
        )

    # Upload to Supabase Storage
    storage = StorageService()
    file_bytes = await file.read()

    upload_result = await storage.upload_file(
        file_bytes=file_bytes,
        filename=file.filename,
        user_id=user_id,
        functionality="rag",
        bucket="documents",
    )

    result = await kb_service.upload_document(
        user_id=user_id,
        filename=file.filename,
        storage_path=upload_result["storage_path"],
        bucket=upload_result["bucket"],
        area_id=area_id,
        topic_id=topic_id,
    )
    return RagDocumentResponse(**result)


@router.post(
    "/documents/text",
    response_model=RagDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_text_document(
    data: TextDocumentRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
    _admin=Depends(get_current_admin),
):
    """Inserir documento de texto puro na base de conhecimento."""
    result = await kb_service.create_text_document(
        user_id=user_id,
        title=data.title,
        content=data.content,
        area_id=data.area_id,
        legislacao=data.legislacao,
        artigo=data.artigo,
    )
    return RagDocumentResponse(**result)


@router.post(
    "/documents/url",
    response_model=RagDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_url_document(
    data: UrlDocumentRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
    _admin=Depends(get_current_admin),
):
    """Importar documento de URL para a base de conhecimento."""
    result = await kb_service.create_url_document(
        user_id=user_id,
        url=data.url,
        area_id=data.area_id,
        title=data.title,
    )
    return RagDocumentResponse(**result)


@router.get("/documents/{document_id}", response_model=RagDocumentDetailResponse)
async def get_document(
    document_id: str,
    _internal=Depends(require_internal_auth),
):
    """Detalhes do documento + preview dos chunks."""
    doc = await kb_service.get_document(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado"
        )

    chunks = await kb_service.get_document_chunks(document_id)
    return RagDocumentDetailResponse(
        document=RagDocumentResponse(**doc),
        chunks=chunks,
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    _internal=Depends(require_internal_auth),
    _admin=Depends(get_current_admin),
):
    """Deletar documento + chunks (CASCADE) + arquivo do Storage."""
    deleted = await kb_service.delete_document(document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado"
        )
    return None


# ── Stats ─────────────────────────────────────────────────


@router.get("/stats", response_model=KnowledgeBaseStatsResponse)
async def get_stats(_internal=Depends(require_internal_auth)):
    """Estatísticas da base de conhecimento."""
    data = await kb_service.get_stats()
    return KnowledgeBaseStatsResponse(**data)
