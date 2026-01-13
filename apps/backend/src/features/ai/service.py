import base64
import hashlib
import re
import asyncio
import time
from html import escape
from io import BytesIO
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, UploadFile, status
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, Preformatted, SimpleDocTemplate, Spacer

from src.core.config import settings
from src.core.logging import logger
from src.shared.database import get_supabase


class AiService:
    def __init__(self):
        self.supabase = get_supabase()

    def _sha256_bytes(self, val: bytes) -> str:
        return hashlib.sha256(val).hexdigest()

    def _get_pipeline_version(self, pipeline_name: str) -> str:
        try:
            res = (
                self.supabase.table("ai_pipeline_versions")
                .select("version")
                .eq("name", pipeline_name)
                .limit(1)
                .execute()
            )
            if res.data and res.data[0].get("version"):
                return str(res.data[0]["version"])
        except Exception:
            pass
        return "1.0.0"

    def _extract_signed_url(self, signed) -> str | None:
        if isinstance(signed, dict):
            return (
                signed.get("signedURL")
                or signed.get("signedUrl")
                or signed.get("signed_url")
                or signed.get("url")
            )
        for attr in ("signedURL", "signedUrl", "signed_url", "url"):
            val = getattr(signed, attr, None)
            if val:
                return str(val)
        return None

    def _ensure_storage_bucket(self, bucket_name: str) -> None:
        create_bucket = getattr(getattr(self.supabase, "storage", None), "create_bucket", None)
        if not callable(create_bucket):
            return

        try:
            create_bucket(bucket_name, {"public": False})
        except Exception as e:
            msg = str(e).lower()
            status_code = getattr(e, "status_code", None)
            if status_code == 409 or "already exists" in msg or "409" in msg:
                return
            logger.warning("Falha ao criar bucket de Storage", exc_info=e)

    def markdown_to_signed_pdf(
        self,
        markdown: str,
        user_id: str,
        pipeline_name: str,
        title: str | None = None,
    ) -> dict:
        expires_in = 600
        storage_bucket = settings.AI_DOCUMENTS_BUCKET
        content_hash = hashlib.sha256((markdown or "").encode("utf-8")).hexdigest()
        pipeline_version = self._get_pipeline_version(pipeline_name)
        storage_path = f"{pipeline_name}/{content_hash}_{pipeline_version}.pdf"

        doc_id = None
        try:
            existing = (
                self.supabase.table("ai_documents")
                .select("id")
                .eq("content_hash", content_hash)
                .eq("pipeline_name", pipeline_name)
                .eq("pipeline_version", pipeline_version)
                .limit(1)
                .execute()
            )
            if existing.data:
                doc_id = str(existing.data[0]["id"])
        except Exception:
            doc_id = None

        if doc_id:
            try:
                signed = self.supabase.storage.from_(storage_bucket).create_signed_url(
                    storage_path,
                    expires_in,
                )
                download_url = self._extract_signed_url(signed)
                if download_url:
                    return {
                        "download_url": download_url,
                        "expires_in": expires_in,
                        "document_id": doc_id,
                        "storage_path": storage_path,
                        "pipeline_version": pipeline_version,
                    }
            except Exception:
                pass

        pdf_bytes = self.markdown_to_pdf_bytes(markdown, title)

        self._ensure_storage_bucket(storage_bucket)

        try:
            self.supabase.storage.from_(storage_bucket).upload(
                storage_path,
                pdf_bytes,
                {"content-type": "application/pdf", "upsert": "true"},
            )
        except Exception as e:
            logger.error("Falha ao enviar PDF para Storage", exc_info=e)
            detail = "Falha ao enviar PDF para Storage"
            msg = str(e).strip()
            if msg:
                detail = f"{detail}: {msg}"
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

        if not doc_id:
            try:
                inserted = (
                    self.supabase.table("ai_documents")
                    .insert(
                        {
                            "content_hash": content_hash,
                            "pipeline_name": pipeline_name,
                            "pipeline_version": pipeline_version,
                            "storage_bucket": storage_bucket,
                            "storage_path": storage_path,
                            "size_bytes": len(pdf_bytes),
                        }
                    )
                    .execute()
                )
                if inserted.data:
                    doc_id = str(inserted.data[0]["id"])
            except Exception:
                try:
                    existing = (
                        self.supabase.table("ai_documents")
                        .select("id")
                        .eq("content_hash", content_hash)
                        .eq("pipeline_name", pipeline_name)
                        .eq("pipeline_version", pipeline_version)
                        .limit(1)
                        .execute()
                    )
                    if existing.data:
                        doc_id = str(existing.data[0]["id"])
                except Exception:
                    doc_id = None

        if not doc_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao persistir documento",
            )

        try:
            self.supabase.table("ai_document_users").insert(
                {"document_id": doc_id, "user_id": user_id}
            ).execute()
        except Exception:
            pass

        try:
            signed = self.supabase.storage.from_(storage_bucket).create_signed_url(
                storage_path,
                expires_in,
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao gerar URL assinada",
            )

        download_url = self._extract_signed_url(signed)
        if not download_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida ao gerar URL assinada",
            )

        return {
            "download_url": download_url,
            "expires_in": expires_in,
            "document_id": doc_id,
            "storage_path": storage_path,
            "pipeline_version": pipeline_version,
        }

    def _safe_href(self, href: str) -> str | None:
        val = (href or "").strip()
        if not val:
            return None

        parsed = urlparse(val)
        if parsed.scheme and parsed.scheme.lower() in {"http", "https", "mailto", "tel"}:
            return val

        if not parsed.scheme and val.startswith("#"):
            return val

        return None

    def _md_inline_to_reportlab(self, text: str) -> str:
        code_span_re = re.compile(r"`([^`]+)`")
        link_re = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
        bold_re = re.compile(r"\*\*([^\n]+?)\*\*")
        italic_re = re.compile(r"(?<!\*)\*([^\n*]+?)\*(?!\*)")

        def render_emphasis(raw: str) -> str:
            parts: list[str] = []
            last = 0
            for m in bold_re.finditer(raw):
                parts.append(render_italic(raw[last : m.start()]))
                parts.append(f"<b>{escape(m.group(1))}</b>")
                last = m.end()
            parts.append(render_italic(raw[last:]))
            return "".join(parts)

        def render_italic(raw: str) -> str:
            parts: list[str] = []
            last = 0
            for m in italic_re.finditer(raw):
                parts.append(escape(raw[last : m.start()]))
                parts.append(f"<i>{escape(m.group(1))}</i>")
                last = m.end()
            parts.append(escape(raw[last:]))
            return "".join(parts)

        def render_text_with_links(raw: str) -> str:
            out: list[str] = []
            last = 0
            for m in link_re.finditer(raw):
                out.append(render_emphasis(raw[last : m.start()]))
                label = escape(m.group(1))
                href = self._safe_href(m.group(2))
                if href:
                    out.append(f'<a href="{escape(href)}">{label}</a>')
                else:
                    out.append(label)
                last = m.end()
            out.append(render_emphasis(raw[last:]))
            return "".join(out)

        out: list[str] = []
        last = 0
        for m in code_span_re.finditer(text or ""):
            out.append(render_text_with_links((text or "")[last : m.start()]))
            out.append(f'<font face="Courier">{escape(m.group(1))}</font>')
            last = m.end()
        out.append(render_text_with_links((text or "")[last:]))
        return "".join(out)

    def _unwrap_markdown(self, text: str) -> str:
        val = text.strip()
        if not val.startswith("```"):
            return val

        lines = val.splitlines()
        if not lines:
            return val

        if not lines[0].lstrip().startswith("```"):
            return val

        if len(lines) < 2:
            return ""

        if lines[-1].strip() != "```":
            return val

        return "\n".join(lines[1:-1]).strip()

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

    def _extract_openai_message_text(self, content) -> str:
        if isinstance(content, str):
            return content.strip()

        parts: list[str] = []
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    if part.get("type") == "text" and isinstance(part.get("text"), dict):
                        value = part["text"].get("value")
                        if isinstance(value, str) and value.strip():
                            parts.append(value.strip())
                    continue

                part_type = getattr(part, "type", None)
                if part_type == "text":
                    text_obj = getattr(part, "text", None)
                    value = getattr(text_obj, "value", None)
                    if isinstance(value, str) and value.strip():
                        parts.append(value.strip())

        return "\n".join(parts).strip()

    async def chat_openai_assistant(self, *, message: str, user_id: str) -> str:
        text = (message or "").strip()
        if not text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mensagem vazia",
            )

        if not settings.OPENAI_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OPENAI_API_KEY não configurada",
            )

        if not settings.OPENAI_ASSISTANT_ID:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OPENAI_ASSISTANT_ID não configurada",
            )

        kind = "chat:openai-assistant"
        version = "1.0.0"
        input_hash = self._sha256_text(text)

        root_run_id: str | None = None
        try:
            inserted = (
                self.supabase.table("ai_runs")
                .insert(
                    {
                        "user_id": user_id,
                        "kind": kind,
                        "version": version,
                        "status": "processing",
                        "input_hash": input_hash,
                        "input": {
                            "message_chars": len(text),
                        },
                    }
                )
                .execute()
            )
            if inserted.data and inserted.data[0].get("id"):
                root_run_id = str(inserted.data[0]["id"])
        except Exception:
            root_run_id = None

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_TIMEOUT_S)

            thread = await client.beta.threads.create()
            await client.beta.threads.messages.create(
                thread_id=thread.id,
                role="user",
                content=text,
            )

            run = await client.beta.threads.runs.create(
                thread_id=thread.id,
                assistant_id=settings.OPENAI_ASSISTANT_ID,
            )

            deadline = time.monotonic() + float(settings.OPENAI_TIMEOUT_S)
            while run.status in {"queued", "in_progress", "cancelling"}:
                if time.monotonic() > deadline:
                    raise HTTPException(
                        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                        detail="Tempo limite ao aguardar resposta da OpenAI",
                    )
                await asyncio.sleep(0.5)
                run = await client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)

            if run.status == "requires_action":
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Assistente requer ação de ferramenta não suportada",
                )

            if run.status != "completed":
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Execução do assistente falhou: {run.status}",
                )

            messages = await client.beta.threads.messages.list(thread_id=thread.id, order="desc", limit=10)
            assistant_text = ""
            for m in getattr(messages, "data", []) or []:
                if getattr(m, "role", None) != "assistant":
                    continue
                assistant_text = self._extract_openai_message_text(getattr(m, "content", None))
                if assistant_text:
                    break

            assistant_text = assistant_text.strip()
            if not assistant_text:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Resposta vazia da OpenAI",
                )

            try:
                if root_run_id:
                    self.supabase.table("ai_runs").update(
                        {
                            "status": "completed",
                            "output": {
                                "text": assistant_text,
                                "provider": "openai",
                                "assistant_id": settings.OPENAI_ASSISTANT_ID,
                                "thread_id": thread.id,
                                "run_id": run.id,
                            },
                            "error": None,
                        }
                    ).eq("id", root_run_id).execute()
            except Exception:
                pass

            return assistant_text
        except HTTPException as e:
            try:
                if root_run_id:
                    self.supabase.table("ai_runs").update(
                        {
                            "status": "failed",
                            "error": str(getattr(e, "detail", None) or "Erro ao processar")[:1000],
                        }
                    ).eq("id", root_run_id).execute()
            except Exception:
                pass
            raise
        except Exception as e:
            try:
                if root_run_id:
                    self.supabase.table("ai_runs").update(
                        {
                            "status": "failed",
                            "error": str(e)[:1000],
                        }
                    ).eq("id", root_run_id).execute()
            except Exception:
                pass
            logger.exception("Erro no chat OpenAI")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao processar mensagem com OpenAI",
            )

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
        text = self._unwrap_markdown(self._extract_assistant_text(message_content))
        if not text:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta vazia da Mistral",
            )

        return text

    def _get_cached_ai_run_output_text(
        self,
        *,
        user_id: str,
        kind: str,
        input_hash: str,
        version: str,
    ) -> str | None:
        try:
            res = (
                self.supabase.table("ai_runs")
                .select("status,output")
                .eq("user_id", user_id)
                .eq("kind", kind)
                .eq("input_hash", input_hash)
                .eq("version", version)
                .is_("parent_id", "null")
                .limit(1)
                .execute()
            )
            if not res.data:
                return None
            row = res.data[0] or {}
            if row.get("status") != "completed":
                return None
            out = row.get("output")
            if isinstance(out, dict) and out.get("text"):
                return str(out["text"])
            return None
        except Exception:
            return None

    async def analyze_cnis(self, file: UploadFile, user_id: str) -> str:
        content = await file.read()
        pipeline_name = "cnis-analysis"
        kind = pipeline_name
        version = self._get_pipeline_version(pipeline_name)
        input_hash = self._sha256_bytes(content)

        cached = self._get_cached_ai_run_output_text(
            user_id=user_id,
            kind=kind,
            input_hash=input_hash,
            version=version,
        )
        if cached:
            return cached

        root_run_id: str | None = None

        try:
            inserted = (
                self.supabase.table("ai_runs")
                .insert(
                    {
                        "user_id": user_id,
                        "kind": kind,
                        "version": version,
                        "status": "processing",
                        "input_hash": input_hash,
                        "input": {
                            "filename": file.filename,
                            "content_type": file.content_type,
                            "size_bytes": len(content),
                        },
                    }
                )
                .execute()
            )
            if inserted.data:
                inserted_id = inserted.data[0].get("id")
                root_run_id = str(inserted_id) if inserted_id else None
        except Exception:
            try:
                res = (
                    self.supabase.table("ai_runs")
                    .select("id,status,output")
                    .eq("user_id", user_id)
                    .eq("kind", kind)
                    .eq("input_hash", input_hash)
                    .eq("version", version)
                    .is_("parent_id", "null")
                    .limit(1)
                    .execute()
                )
                if res.data:
                    row = res.data[0] or {}
                    if row.get("id"):
                        root_run_id = str(row["id"])
                    if row.get("status") == "completed":
                        out = row.get("output")
                        if isinstance(out, dict) and out.get("text"):
                            return str(out["text"])
                    if row.get("status") == "processing":
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="Processamento em andamento",
                        )
            except HTTPException:
                raise
            except Exception:
                pass

            try:
                self.supabase.table("ai_runs").update(
                    {
                        "status": "processing",
                        "error": None,
                        "output": {},
                    }
                ).eq("user_id", user_id).eq("kind", kind).eq("input_hash", input_hash).eq(
                    "version", version
                ).execute()
            except Exception:
                pass

        if not root_run_id:
            try:
                res = (
                    self.supabase.table("ai_runs")
                    .select("id")
                    .eq("user_id", user_id)
                    .eq("kind", kind)
                    .eq("input_hash", input_hash)
                    .eq("version", version)
                    .is_("parent_id", "null")
                    .limit(1)
                    .execute()
                )
                if res.data and res.data[0].get("id"):
                    root_run_id = str(res.data[0]["id"])
            except Exception:
                root_run_id = None

        step_run_id: str | None = None
        if root_run_id:
            try:
                step_inserted = (
                    self.supabase.table("ai_runs")
                    .insert(
                        {
                            "user_id": user_id,
                            "parent_id": root_run_id,
                            "kind": "provider:mistral",
                            "version": version,
                            "status": "processing",
                            "input": {
                                "pipeline": pipeline_name,
                                "agent_id": settings.MISTRAL_CNIS_AGENT_ID,
                                "model": settings.MISTRAL_CHAT_MODEL,
                            },
                        }
                    )
                    .execute()
                )
                if step_inserted.data and step_inserted.data[0].get("id"):
                    step_run_id = str(step_inserted.data[0]["id"])
            except Exception:
                step_run_id = None

        try:
            text = await self._call_mistral_cnis_agent(content)
        except HTTPException as e:
            try:
                self.supabase.table("ai_runs").update(
                    {
                        "status": "failed",
                        "error": str(getattr(e, "detail", None) or "Erro ao processar"),
                    }
                ).eq("user_id", user_id).eq("kind", kind).eq("input_hash", input_hash).eq(
                    "version", version
                ).execute()
            except Exception:
                pass

            if step_run_id:
                try:
                    self.supabase.table("ai_runs").update(
                        {
                            "status": "failed",
                            "error": str(getattr(e, "detail", None) or "Erro ao processar"),
                        }
                    ).eq("id", step_run_id).execute()
                except Exception:
                    pass
            raise
        except Exception as e:
            try:
                self.supabase.table("ai_runs").update(
                    {
                        "status": "failed",
                        "error": str(e)[:1000],
                    }
                ).eq("user_id", user_id).eq("kind", kind).eq("input_hash", input_hash).eq(
                    "version", version
                ).execute()
            except Exception:
                pass

            if step_run_id:
                try:
                    self.supabase.table("ai_runs").update(
                        {
                            "status": "failed",
                            "error": str(e)[:1000],
                        }
                    ).eq("id", step_run_id).execute()
                except Exception:
                    pass
            raise

        try:
            self.supabase.table("ai_runs").update(
                {
                    "status": "completed",
                    "output": {"text": text},
                    "error": None,
                }
            ).eq("user_id", user_id).eq("kind", kind).eq("input_hash", input_hash).eq(
                "version", version
            ).execute()
        except Exception:
            pass

        if step_run_id:
            try:
                self.supabase.table("ai_runs").update(
                    {
                        "status": "completed",
                        "output": {"ok": True},
                        "error": None,
                    }
                ).eq("id", step_run_id).execute()
            except Exception:
                pass

        return text

    async def list_tools(self):
        response = (
            self.supabase.table("ai_tools")
            .select("slug,name,description,icon,locked,order")
            .order("order")
            .execute()
        )

        tools = response.data or []

        tool_slugs = [str(t.get("slug")) for t in tools if t and t.get("slug")]
        templates_by_tool: dict[str, list[dict[str, str]]] = {}

        if tool_slugs:
            templates_res = (
                self.supabase.table("ai_tool_templates")
                .select("tool_slug,template,prompt,sort_order")
                .in_("tool_slug", tool_slugs)
                .order("tool_slug")
                .order("sort_order")
                .execute()
            )

            for row in templates_res.data or []:
                tool_slug = str(row.get("tool_slug") or "").strip()
                label = str(row.get("template") or "").strip()
                prompt = str(row.get("prompt") or "").strip()
                if not tool_slug or not label or not prompt:
                    continue
                templates_by_tool.setdefault(tool_slug, []).append(
                    {
                        "label": label,
                        "prompt": prompt,
                    }
                )

        out: list[dict] = []
        for tool in tools:
            payload = tool or {}
            slug = str(payload.get("slug") or "")
            templates = templates_by_tool.get(slug, [])
            out.append(
                {
                    **payload,
                    "templates": templates,
                }
            )

        return out

    def markdown_to_pdf_bytes(self, markdown: str, title: str | None = None) -> bytes:
        text = (markdown or "").strip()
        if not text:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Markdown vazio")

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title=title or "Documento",
        )

        styles = getSampleStyleSheet()
        normal = styles["Normal"]
        normal.fontName = "Helvetica"
        normal.fontSize = 10
        normal.leading = 14
        normal.spaceAfter = 6

        h1 = ParagraphStyle("H1", parent=normal, fontSize=16, leading=20, spaceAfter=10)
        h2 = ParagraphStyle("H2", parent=normal, fontSize=13, leading=18, spaceAfter=8)
        h3 = ParagraphStyle("H3", parent=normal, fontSize=11, leading=16, spaceAfter=6)
        bullet = ParagraphStyle("Bullet", parent=normal, leftIndent=14, bulletIndent=2)
        numbered = ParagraphStyle("Numbered", parent=normal, leftIndent=14, bulletIndent=2)
        quote = ParagraphStyle("Quote", parent=normal, leftIndent=12, textColor="#444444")
        code_style = ParagraphStyle(
            "Code",
            parent=normal,
            fontName="Courier",
            fontSize=9,
            leading=12,
            backColor="#f5f5f5",
            borderPadding=6,
            leftIndent=0,
            rightIndent=0,
            spaceAfter=8,
        )

        story = []
        in_code_block = False
        code_lines: list[str] = []
        ordered_re = re.compile(r"^\s*(\d+)[\.)]\s+(.*)$")

        for raw in text.splitlines():
            line = raw.rstrip()

            if line.strip().startswith("```"):
                if in_code_block:
                    story.append(Preformatted("\n".join(code_lines).rstrip(), code_style))
                    code_lines = []
                    in_code_block = False
                else:
                    in_code_block = True
                continue

            if in_code_block:
                code_lines.append(raw.rstrip("\n"))
                continue

            if not line.strip():
                story.append(Spacer(1, 6))
                continue

            if line.startswith("# "):
                story.append(Paragraph(self._md_inline_to_reportlab(line[2:].strip()), h1))
                continue
            if line.startswith("## "):
                story.append(Paragraph(self._md_inline_to_reportlab(line[3:].strip()), h2))
                continue
            if line.startswith("### "):
                story.append(Paragraph(self._md_inline_to_reportlab(line[4:].strip()), h3))
                continue

            stripped = line.strip()
            if stripped in {"---", "***"}:
                story.append(HRFlowable(width="100%", thickness=1, color="#cccccc", spaceAfter=10))
                continue

            if line.startswith("> "):
                story.append(Paragraph(self._md_inline_to_reportlab(line[2:].strip()), quote))
                continue

            if line.startswith("- ") or line.startswith("* ") or line.startswith("+ "):
                story.append(
                    Paragraph(
                        self._md_inline_to_reportlab(line[2:].strip()),
                        bullet,
                        bulletText="•",
                    )
                )
                continue

            m = ordered_re.match(line)
            if m:
                story.append(
                    Paragraph(
                        self._md_inline_to_reportlab(m.group(2).strip()),
                        numbered,
                        bulletText=f"{m.group(1)}.",
                    )
                )
                continue

            story.append(Paragraph(self._md_inline_to_reportlab(line), normal))

        if in_code_block and code_lines:
            story.append(Preformatted("\n".join(code_lines).rstrip(), code_style))

        doc.build(story)
        return buffer.getvalue()
