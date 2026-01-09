import base64

import httpx
from fastapi import HTTPException, UploadFile, status

from src.core.config import settings
from src.shared.database import get_supabase


class AiService:
    def __init__(self):
        self.supabase = get_supabase()

    def _extract_assistant_text(self, message_content) -> str:
        if isinstance(message_content, str):
            return message_content
        if isinstance(message_content, list):
            parts: list[str] = []
            for part in message_content:
                if isinstance(part, dict) and part.get("type") == "text" and part.get("text"):
                    parts.append(str(part["text"]))
            return "\n".join(parts).strip()
        return ""

    async def _call_mistral_cnis_agent(self, pdf_bytes: bytes) -> str:
        if not settings.MISTRAL_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MISTRAL_API_KEY não configurada",
            )

        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        pdf_data_uri = f"data:application/pdf;base64,{pdf_b64}"

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": ("Analise o documento PDF enviado com base nas suas instruções."),
                    },
                    {"type": "document_url", "document_url": pdf_data_uri},
                ],
            }
        ]

        if settings.MISTRAL_CNIS_AGENT_ID:
            url = "https://api.mistral.ai/v1/agents/completions"
            body = {"agent_id": settings.MISTRAL_CNIS_AGENT_ID, "messages": messages}
        else:
            url = "https://api.mistral.ai/v1/chat/completions"
            body = {"model": settings.MISTRAL_CHAT_MODEL, "messages": messages}

        headers = {
            "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=settings.MISTRAL_TIMEOUT_S) as client:
            resp = await client.post(url, json=body, headers=headers)

        data = None
        try:
            data = resp.json()
        except Exception:
            data = None

        if resp.status_code >= 400:
            detail = "Erro ao processar CNIS com Mistral"
            if isinstance(data, dict):
                detail = data.get("message") or data.get("error") or detail
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

        if not isinstance(data, dict) or "choices" not in data or not data["choices"]:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida da Mistral",
            )

        message_content = data["choices"][0].get("message", {}).get("content")
        text = self._extract_assistant_text(message_content)
        if not text:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta vazia da Mistral",
            )

        return text

    async def analyze_cnis(self, file: UploadFile) -> str:
        content = await file.read()
        return await self._call_mistral_cnis_agent(content)

    async def list_tools(self):
        response = (
            self.supabase.table("ai_tools")
            .select("slug,name,description,icon,locked,order")
            .order("order")
            .execute()
        )

        return response.data or []
