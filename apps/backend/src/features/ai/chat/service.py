"""Chat session management and Gemini streaming service."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone

from google.genai import types

from src.core.db import get_pool
from src.core.embeddings import generate_embedding
from src.core.gemini import stream_chat
from src.core.logging import logger
from src.features.ai.chat.rag import RagChunk, search_legal_chunks

SESSION_INACTIVITY_TIMEOUT = timedelta(minutes=30)
MAX_HISTORY_MESSAGES = 20

LEGAL_SYSTEM_PROMPT_BASE = """Você é um assistente jurídico especializado em direito brasileiro.

REGRAS:
- Responda APENAS sobre direito brasileiro. Recuse perguntas sobre jurisdições estrangeiras.
- Cite artigos de lei, súmulas e jurisprudência quando relevante.
- Seja direto e objetivo. Use linguagem técnica quando apropriado.
- Esclareça que suas respostas são orientações jurídicas, NÃO parecer jurídico.
- Se não tiver certeza sobre um artigo ou número de lei específico, diga claramente.
- Organize respostas longas com tópicos e parágrafos.
- Quando citar legislação, use o formato: (Art. X, Lei Y) ou (Súmula N, Tribunal).
"""

RAG_CONTEXT_TEMPLATE = """

=== BASE DE CONHECIMENTO (FONTES VERIFICADAS) ===
{chunks}
=== INSTRUÇÃO ===
Fundamente sua resposta nos artigos acima quando forem relevantes para a pergunta.
Cite SEMPRE a fonte entre parênteses: (Art. X, Lei Y).
Se a legislação fornecida não cobrir a pergunta, responda com seu conhecimento geral e diga claramente que não há fonte específica na base."""


def _build_system_prompt(chunks: list[RagChunk]) -> str:
    """Build system prompt, injecting RAG chunks when available."""
    if not chunks:
        return LEGAL_SYSTEM_PROMPT_BASE

    formatted = []
    for i, c in enumerate(chunks, 1):
        label_parts = []
        if c.artigo:
            label_parts.append(c.artigo)
        if c.legislacao:
            label_parts.append(c.legislacao)
        if not label_parts and c.section_title:
            label_parts.append(c.section_title)
        label = ", ".join(label_parts) or f"Fonte {i}"
        formatted.append(f"[{i}] {label}: \"{c.content[:800]}\"")

    return LEGAL_SYSTEM_PROMPT_BASE + RAG_CONTEXT_TEMPLATE.format(
        chunks="\n".join(formatted),
    )


def _chunks_to_sources(chunks: list[RagChunk]) -> list[dict]:
    """Convert RagChunks to serializable source dicts for the SSE done event."""
    return [
        {
            "legislacao": c.legislacao or "",
            "artigo": c.artigo or "",
            "area": c.area,
            "score": round(c.score, 3),
            "content": c.content[:200],
        }
        for c in chunks
    ]


class ChatService:
    async def create_session(self, user_id: str, credits_consumed: int) -> dict:
        pool = await get_pool()
        now = datetime.now(timezone.utc)
        expires_at = now + SESSION_INACTIVITY_TIMEOUT

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO public.chat_sessions
                        (user_id, status, credits_consumed, expires_at)
                    VALUES (%s, 'active', %s, %s)
                    RETURNING id, title, status, message_count, max_messages,
                              credits_consumed, created_at, updated_at,
                              last_message_at, expires_at
                    """,
                    (user_id, credits_consumed, expires_at),
                )
                row = await cur.fetchone()

        return self._session_row_to_dict(row)

    async def list_sessions(self, user_id: str, limit: int = 20, offset: int = 0) -> tuple[list[dict], int]:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT count(*) FROM public.chat_sessions WHERE user_id = %s",
                    (user_id,),
                )
                total = (await cur.fetchone())[0]

                await cur.execute(
                    """
                    SELECT id, title, status, message_count, max_messages,
                           credits_consumed, created_at, updated_at,
                           last_message_at, expires_at
                    FROM public.chat_sessions
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (user_id, limit, offset),
                )
                rows = await cur.fetchall()

        return [self._session_row_to_dict(r) for r in rows], total

    async def get_session(self, session_id: str, user_id: str) -> dict | None:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT id, title, status, message_count, max_messages,
                           credits_consumed, created_at, updated_at,
                           last_message_at, expires_at
                    FROM public.chat_sessions
                    WHERE id = %s AND user_id = %s
                    """,
                    (session_id, user_id),
                )
                row = await cur.fetchone()

        return self._session_row_to_dict(row) if row else None

    async def get_session_messages(self, session_id: str) -> list[dict]:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT id, role, content, created_at
                    FROM public.chat_messages
                    WHERE session_id = %s
                    ORDER BY created_at ASC
                    """,
                    (session_id,),
                )
                rows = await cur.fetchall()

        return [
            {
                "id": str(r[0]),
                "role": r[1],
                "content": r[2],
                "created_at": r[3].isoformat() if r[3] else "",
            }
            for r in rows
        ]

    async def delete_session(self, session_id: str, user_id: str) -> bool:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM public.chat_sessions WHERE id = %s AND user_id = %s",
                    (session_id, user_id),
                )
                return cur.rowcount > 0

    async def validate_session_for_message(self, session_id: str, user_id: str) -> dict:
        """Validate that a session is active and can accept messages.

        Returns the session dict if valid.
        Raises ValueError with a user-friendly message if invalid.
        """
        session = await self.get_session(session_id, user_id)
        if not session:
            raise ValueError("Sessão não encontrada")

        if session["status"] != "active":
            raise ValueError("Esta sessão já foi encerrada")

        now = datetime.now(timezone.utc)

        # Check expiration
        if session.get("_expires_at") and session["_expires_at"] < now:
            await self._expire_session(session_id)
            raise ValueError("Sessão expirada por inatividade")

        if session["message_count"] >= session["max_messages"]:
            await self._expire_session(session_id)
            raise ValueError(
                f"Limite de {session['max_messages']} mensagens atingido"
            )

        return session

    async def save_message(self, session_id: str, role: str, content: str, token_count: int | None = None) -> str:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO public.chat_messages (session_id, role, content, token_count)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (session_id, role, content, token_count),
                )
                msg_id = (await cur.fetchone())[0]

                # Update session counters
                if role == "user":
                    expires_at = datetime.now(timezone.utc) + SESSION_INACTIVITY_TIMEOUT
                    await cur.execute(
                        """
                        UPDATE public.chat_sessions
                        SET message_count = message_count + 1,
                            last_message_at = now(),
                            expires_at = %s,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (expires_at, session_id),
                    )

        return str(msg_id)

    async def generate_title(self, session_id: str, first_message: str) -> None:
        """Auto-generate session title from first user message."""
        title = first_message[:50].strip()
        if len(first_message) > 50:
            title += "..."

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE public.chat_sessions SET title = %s, updated_at = now() WHERE id = %s",
                    (title, session_id),
                )

    async def stream_response(
        self,
        session_id: str,
        user_id: str,
        message: str,
    ) -> AsyncGenerator[str, None]:
        """Process a chat message and stream the response as SSE events.

        1. Validate session
        2. Save user message
        3. Load history
        4. Stream from Gemini
        5. Save assistant response
        """
        # 1. Validate
        session = await self.validate_session_for_message(session_id, user_id)

        # 2. Save user message
        await self.save_message(session_id, "user", message)

        # Generate title from first message
        if session["message_count"] == 0:
            await self.generate_title(session_id, message)

        # 3. Load history (last N messages for context)
        all_messages = await self.get_session_messages(session_id)
        history = all_messages[-MAX_HISTORY_MESSAGES:]

        # 4. RAG: embed query and search for relevant legal chunks
        rag_chunks: list[RagChunk] = []
        try:
            query_embedding = await generate_embedding(message)
            pool = await get_pool()
            rag_chunks = await search_legal_chunks(
                pool, query_embedding, top_k=8, similarity_threshold=0.35,
            )
            if rag_chunks:
                logger.info(
                    "RAG returned %d chunks for session %s (top score: %.3f)",
                    len(rag_chunks), session_id, rag_chunks[0].score,
                )
        except Exception:
            logger.exception("RAG search failed for session %s, proceeding without", session_id)

        # 5. Build Gemini contents from history
        contents = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg["content"])],
                )
            )

        # 6. Stream from Gemini with RAG-augmented system prompt
        system_prompt = _build_system_prompt(rag_chunks)
        full_response = ""
        try:
            async for chunk_text in stream_chat(
                system_instruction=system_prompt,
                contents=contents,
            ):
                full_response += chunk_text
                yield f"data: {json.dumps({'text': chunk_text})}\n\n"

        except Exception as e:
            logger.exception("Chat streaming error for session %s", session_id)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        # 7. Save assistant response
        msg_id = await self.save_message(session_id, "assistant", full_response)

        # 8. Send done event with sources
        done_event: dict = {"done": True, "message_id": msg_id}
        if rag_chunks:
            done_event["sources"] = _chunks_to_sources(rag_chunks)
        yield f"data: {json.dumps(done_event)}\n\n"

    async def _expire_session(self, session_id: str) -> None:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE public.chat_sessions SET status = 'expired', updated_at = now() WHERE id = %s",
                    (session_id,),
                )

    @staticmethod
    def _session_row_to_dict(row: tuple) -> dict:
        return {
            "id": str(row[0]),
            "title": row[1],
            "status": row[2],
            "message_count": row[3],
            "max_messages": row[4],
            "credits_consumed": row[5],
            "created_at": row[6].isoformat() if row[6] else "",
            "updated_at": row[7].isoformat() if row[7] else "",
            "last_message_at": row[8].isoformat() if row[8] else None,
            "_expires_at": row[9],  # expires_at for internal validation
        }
