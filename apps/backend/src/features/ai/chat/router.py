from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from src.core.auth import get_user_id, require_internal_auth
from src.core.db import get_pool
from src.core.logging import logger
from src.core.rate_limit import limiter
from src.features.ai.chat.schemas import (
    ChatMessageRequest,
    ChatMessageResponse,
    CreateSessionRequest,
    SessionListResponse,
    SessionResponse,
    SessionWithMessagesResponse,
)
from src.features.ai.chat.service import ChatService
from src.features.billing.credits.service import CreditsService
from src.features.core.storage.service import StorageService

router = APIRouter()
chat_service = ChatService()
credits_service = CreditsService()
storage_service = StorageService()


@router.post(
    "/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def create_session(
    request: Request,
    _data: CreateSessionRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Cria nova sessão de chat (consome créditos)."""
    # Consume credits
    result = await credits_service.consume_credits(user_id, "ai_chat_session")
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Créditos insuficientes para iniciar uma sessão de chat",
        )

    credits_consumed = result.credits_consumed

    try:
        session = await chat_service.create_session(user_id, credits_consumed)
    except Exception:
        # Refund on failure
        logger.exception("Failed to create chat session, refunding credits")
        await credits_service.refund_credits(
            user_id, credits_consumed, "Falha ao criar sessão de chat"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar sessão de chat",
        )

    return SessionResponse(**{k: v for k, v in session.items() if not k.startswith("_")})


@router.get(
    "/sessions",
    response_model=SessionListResponse,
)
async def list_sessions(
    user_id: str = Depends(get_user_id),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    _internal=Depends(require_internal_auth),
):
    """Lista sessões de chat do usuário."""
    sessions, total = await chat_service.list_sessions(user_id, limit, offset)
    return SessionListResponse(
        sessions=[
            SessionResponse(**{k: v for k, v in s.items() if not k.startswith("_")})
            for s in sessions
        ],
        total=total,
    )


@router.get(
    "/sessions/{session_id}",
    response_model=SessionWithMessagesResponse,
)
async def get_session(
    session_id: str,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Retorna sessão com todas as mensagens."""
    session = await chat_service.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada")

    messages = await chat_service.get_session_messages(session_id)

    return SessionWithMessagesResponse(
        session=SessionResponse(**{k: v for k, v in session.items() if not k.startswith("_")}),
        messages=[ChatMessageResponse(**m) for m in messages],
    )


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Deleta sessão e todas as mensagens."""
    deleted = await chat_service.delete_session(session_id, user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada")
    return None


@router.post(
    "/sessions/{session_id}/messages",
    status_code=status.HTTP_200_OK,
)
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    session_id: str,
    data: ChatMessageRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Envia mensagem e retorna resposta via SSE streaming."""
    try:
        # Validate session before streaming
        await chat_service.validate_session_for_message(session_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return StreamingResponse(
        chat_service.stream_response(session_id, user_id, data.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/documents/{document_id}/url")
async def get_document_url(
    document_id: str,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Returns a signed download URL or the original URL for a RAG document."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT document_type, storage_path, bucket, original_filename
                FROM public.rag_documents
                WHERE id = %s
                """,
                (document_id,),
            )
            row = await cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado"
        )

    doc_type, storage_path, bucket, original_filename = row

    # URL-sourced documents: return the original URL directly
    if doc_type == "url":
        return {"url": storage_path, "filename": original_filename, "type": "url"}

    # Text-only documents have no downloadable file
    if bucket == "none" or storage_path == "text-input":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este documento não possui arquivo para download",
        )

    # PDF/file documents: generate signed URL from Supabase Storage
    signed_url = await storage_service.generate_signed_url(
        bucket=bucket,
        storage_path=storage_path,
        expires_in=3600,
    )
    return {"url": signed_url, "filename": original_filename, "type": "download"}
