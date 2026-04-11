import asyncio
import io

import httpx
from markdown_pdf import MarkdownPdf, Section

from src.core.config import get_gemini_model, settings
from src.core.logging import logger
from src.core.progress import ProgressReporter
from src.core.storage import StorageService
from src.handlers.pipeline import (
    run_gemini_audio_analysis,
    run_gemini_multi_pdf_analysis,
    run_gemini_pdf_analysis,
)
from src.handlers.reports.brief_scanner import (
    generate_brief_scanner_docx_from_template,
)
from src.handlers.reports.cnis import (
    docx_bytes_to_pdf_bytes,
    generate_cnis_docx_from_template,
)
from src.handlers.reports.labor_claim import (
    generate_labor_claim_docx_from_template,
)
from src.handlers.reports.process_summary import (
    generate_process_summary_docx_from_template,
)
from src.prompts.audio_transcription import AUDIO_TRANSCRIPTION_GEMINI_PROMPT
from src.prompts.brief_scanner import BRIEF_SCANNER_GEMINI_PROMPT
from src.prompts.cnis import CNIS_GEMINI_PROMPT
from src.prompts.labor_claim import LABOR_CLAIM_GEMINI_PROMPT
from src.prompts.process_summary import PROCESS_SUMMARY_GEMINI_PROMPT


class WorkerException(Exception):
    """Exception for worker errors."""

    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class AiService:
    def __init__(self):
        self.storage = StorageService()

    # ------------------------------------------------------------------ #
    #  Supabase Storage helpers (DELEGATED TO StorageService)
    # ------------------------------------------------------------------ #

    # ------------------------------------------------------------------ #
    #  PDF generation
    # ------------------------------------------------------------------ #

    async def _markdown_to_pdf_and_store(
        self,
        *,
        markdown: str,
        filename: str,
        user_id: str,
        client_id: str | None,
        functionality: str = "ai",
        job_uuid: str,
        expires_in: int,
    ) -> dict:
        title = str(filename)
        if title.lower().endswith(".pdf"):
            title = title[:-4]

        pdf_bytes = self._markdown_to_pdf_bytes(markdown, title=title)
        uploaded = await self.storage.upload_pdf_to_supabase(
            pdf_bytes=pdf_bytes,
            user_id=user_id,
            client_id=client_id,
            functionality=functionality,
            job_uuid=job_uuid,
            filename=filename,
            expires_in=expires_in,
            output=True,
        )

        if "signed_url" in uploaded:
            uploaded["download_url"] = uploaded["signed_url"]

        return {
            "content": pdf_bytes,
            **uploaded,
        }

    def _markdown_to_pdf_bytes(self, markdown: str, *, title: str | None = None) -> bytes:
        text = (markdown or "").strip()
        if not text:
            raise WorkerException(status_code=502, detail="Resposta vazia da análise")

        try:
            pdf = MarkdownPdf(toc_level=0, optimize=True)
            if title:
                pdf.meta["title"] = title
            pdf.add_section(Section(text, toc=False))

            out = io.BytesIO()
            pdf.save_bytes(out)
            pdf_bytes = out.getvalue()
        except WorkerException:
            raise
        except Exception as e:
            logger.error("Falha ao gerar PDF do markdown", exc_info=e)
            raise WorkerException(status_code=502, detail="Falha ao gerar PDF")

        if not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise WorkerException(status_code=502, detail="Falha ao gerar PDF")

        return pdf_bytes

    DOCX_MIME_TYPE = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    async def _store_report_outputs(
        self,
        *,
        docx_bytes: bytes,
        filename: str,
        user_id: str,
        client_id: str | None,
        functionality: str,
        job_uuid: str,
        expires_in: int,
        pdf_error_detail: str,
    ) -> dict:
        """Convert a DOCX report to PDF and upload both to Supabase Storage.

        Returns a dict with PDF fields at the top level (bucket, storage_path,
        signed_url, filename, content) and DOCX fields prefixed with `docx_`.
        """
        pdf_bytes = docx_bytes_to_pdf_bytes(docx_bytes)

        if not pdf_bytes or not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise WorkerException(status_code=502, detail=pdf_error_detail)

        pdf_filename = filename if filename.lower().endswith(".pdf") else f"{filename}.pdf"
        docx_filename_base = (
            filename[:-4] if filename.lower().endswith(".pdf") else filename
        )
        docx_filename = f"{docx_filename_base}.docx"

        pdf_uploaded = await self.storage.upload_pdf_to_supabase(
            pdf_bytes=pdf_bytes,
            user_id=user_id,
            client_id=client_id,
            functionality=functionality,
            job_uuid=job_uuid,
            filename=pdf_filename,
            expires_in=expires_in,
            output=True,
        )
        if "signed_url" in pdf_uploaded:
            pdf_uploaded["download_url"] = pdf_uploaded["signed_url"]

        # Derive the DOCX path from the PDF path (swap extension) so the two
        # files always live side-by-side in storage.
        pdf_storage_path = pdf_uploaded.get("storage_path") or ""
        pdf_bucket = pdf_uploaded.get("bucket")
        docx_storage_path_override = None
        if pdf_storage_path:
            if pdf_storage_path.lower().endswith(".pdf"):
                docx_storage_path_override = pdf_storage_path[:-4] + ".docx"
            else:
                docx_storage_path_override = pdf_storage_path + ".docx"

        docx_uploaded = await self.storage.upload_bytes_to_supabase(
            file_bytes=docx_bytes,
            user_id=user_id,
            client_id=client_id,
            functionality=functionality,
            job_uuid=job_uuid,
            filename=docx_filename,
            content_type=self.DOCX_MIME_TYPE,
            expires_in=expires_in,
            output=True,
            bucket_override=pdf_bucket,
            storage_path_override=docx_storage_path_override,
        )

        return {
            "content": pdf_bytes,
            **pdf_uploaded,
            "docx_content": docx_bytes,
            "docx_bucket": docx_uploaded.get("bucket"),
            "docx_storage_path": docx_uploaded.get("storage_path"),
            "docx_signed_url": docx_uploaded.get("signed_url"),
            "docx_download_url": docx_uploaded.get("signed_url"),
            "docx_filename": docx_uploaded.get("filename") or docx_filename,
        }

    async def _download_pdf_bytes(self, file_url: str) -> bytes:
        url = (file_url or "").strip()
        if not url:
            raise WorkerException(status_code=400, detail="file_url inválido")

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.get(url)
        except httpx.TimeoutException:
            raise WorkerException(status_code=504, detail="Tempo limite ao baixar o arquivo")
        except httpx.RequestError:
            raise WorkerException(status_code=502, detail="Erro ao baixar o arquivo")

        if resp.status_code >= 400:
            raise WorkerException(status_code=502, detail="Falha ao baixar o arquivo")

        pdf_bytes = resp.content
        content_type = (resp.headers.get("content-type") or "").lower()
        looks_like_pdf = pdf_bytes.lstrip().startswith(b"%PDF")
        if "application/pdf" not in content_type and not looks_like_pdf:
            raise WorkerException(status_code=400, detail="Envie um arquivo PDF")

        return pdf_bytes

    # ------------------------------------------------------------------ #
    #  Analysis methods (pipeline replaces n8n)
    # ------------------------------------------------------------------ #

    async def analyze_cnis(
        self,
        *,
        file_url: str,
        user_id: str,
        client_id: str | None,
        store_pdf: bool = False,
        store_input_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Analyze CNIS document using Gemini (PDF bytes sent inline, no OCR).

        Pipeline:
            1. Download PDF
            2. Store input PDF if requested
            3. Send PDF bytes directly to Gemini for analysis (returns JSON)
            4. Generate DOCX from JSON, convert to PDF via LibreOffice
            5. Store output PDF if requested
        """
        pdf_bytes = await self.storage.download_pdf_bytes(file_url)
        inferred_filename = self.storage.infer_pdf_filename_from_url(file_url)

        # Store input PDF for history
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )
            if "signed_url" in input_storage:
                input_storage["download_url"] = input_storage["signed_url"]

        # Run Gemini pipeline (PDF bytes -> Gemini -> JSON)
        pipeline_result = await run_gemini_pdf_analysis(
            pdf_bytes=pdf_bytes,
            prompt=CNIS_GEMINI_PROMPT,
            progress=progress,
            model=get_gemini_model("cnis_analysis"),
        )

        raw_text = pipeline_result.markdown
        structured_data = pipeline_result.structured_data
        token_usage = pipeline_result.token_usage

        if not raw_text:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        if not structured_data:
            raise WorkerException(
                status_code=502,
                detail="Gemini não retornou JSON válido para o relatório CNIS",
            )

        response: dict = {
            "markdown": raw_text,
            "structured_data": structured_data,
        }

        if token_usage:
            response["token_usage"] = token_usage.to_dict()

        if input_storage:
            response["input_storage"] = input_storage

        # Generate DOCX from structured JSON
        docx_bytes = generate_cnis_docx_from_template(structured_data)

        # Upload both DOCX and PDF (converted from DOCX) if requested
        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            outputs = await self._store_report_outputs(
                docx_bytes=docx_bytes,
                filename=inferred_filename,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                expires_in=signed_url_expires_in,
                pdf_error_detail="Falha ao gerar PDF do relatório CNIS",
            )
            response.update(outputs)
        else:
            # No storage: still produce PDF bytes for callers that want inline content
            pdf_bytes_local = docx_bytes_to_pdf_bytes(docx_bytes)
            if not pdf_bytes_local or not pdf_bytes_local.lstrip().startswith(b"%PDF"):
                raise WorkerException(
                    status_code=502, detail="Falha ao gerar PDF do relatório CNIS"
                )
            response["content"] = pdf_bytes_local

        return response

    async def analyze_process_summary(
        self,
        *,
        file_urls: list[str],
        user_id: str,
        client_id: str | None,
        store_pdf: bool = False,
        store_input_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Analyze process documents using Gemini (PDF bytes sent inline, no OCR).

        Accepts multiple PDF files — all are sent to Gemini in a single request.

        Pipeline:
            1. Download all PDFs
            2. Store input PDFs if requested
            3. Send PDF bytes directly to Gemini for analysis (returns JSON)
            4. Generate DOCX from JSON, convert to PDF via LibreOffice
            5. Store output PDF if requested
        """
        if not file_urls:
            raise WorkerException(status_code=400, detail="Nenhum arquivo enviado")

        # Download all PDFs in parallel
        pdf_bytes_list: list[bytes] = await asyncio.gather(
            *[self.storage.download_pdf_bytes(url) for url in file_urls]
        )

        inferred_filename = self.storage.infer_pdf_filename_from_url(file_urls[0])

        # Store input PDFs for history (first file only, as representative)
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes_list[0],
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )
            if "signed_url" in input_storage:
                input_storage["download_url"] = input_storage["signed_url"]

        # Run Gemini pipeline (PDF bytes -> Gemini -> JSON)
        pipeline_result = await run_gemini_multi_pdf_analysis(
            pdf_bytes_list=pdf_bytes_list,
            prompt=PROCESS_SUMMARY_GEMINI_PROMPT,
            progress=progress,
            model=get_gemini_model("process_summary"),
        )

        raw_text = pipeline_result.markdown
        structured_data = pipeline_result.structured_data
        token_usage = pipeline_result.token_usage

        if not raw_text:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        if not structured_data:
            raise WorkerException(
                status_code=502,
                detail="Gemini não retornou JSON válido para o relatório de processo",
            )

        response: dict = {
            "markdown": raw_text,
            "structured_data": structured_data,
        }

        if token_usage:
            response["token_usage"] = token_usage.to_dict()

        if input_storage:
            response["input_storage"] = input_storage

        # Generate DOCX from structured JSON
        docx_bytes = generate_process_summary_docx_from_template(structured_data)

        # Upload both DOCX and PDF (converted from DOCX) if requested
        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            outputs = await self._store_report_outputs(
                docx_bytes=docx_bytes,
                filename=inferred_filename,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                expires_in=signed_url_expires_in,
                pdf_error_detail="Falha ao gerar PDF do relatório de processo",
            )
            response.update(outputs)
        else:
            pdf_bytes_local = docx_bytes_to_pdf_bytes(docx_bytes)
            if not pdf_bytes_local or not pdf_bytes_local.lstrip().startswith(b"%PDF"):
                raise WorkerException(
                    status_code=502, detail="Falha ao gerar PDF do relatório de processo"
                )
            response["content"] = pdf_bytes_local

        return response

    async def _fetch_rag_context(self, query: str, area: str | None = None, top_k: int = 8) -> str:
        """Search RAG chunks and return formatted context string for prompt injection."""
        try:
            from src.core.embeddings import generate_embedding
            from src.core.rag import search_legal_chunks

            query_embedding = await generate_embedding(query[:2000])
            chunks = await search_legal_chunks(
                query_embedding,
                area=area,
                top_k=top_k,
                similarity_threshold=0.35,
            )
            if not chunks:
                return ""

            logger.info("RAG returned %d chunks (top score: %.3f)", len(chunks), chunks[0].score)
            lines = []
            for i, c in enumerate(chunks, 1):
                label_parts = []
                if c.artigo:
                    label_parts.append(c.artigo)
                if c.legislacao:
                    label_parts.append(c.legislacao)
                label = ", ".join(label_parts) or f"Fonte {i}"
                lines.append(f'[{i}] {label}: "{c.content[:800]}"')

            return "\n--- LEGISLAÇÃO RELEVANTE (BASE DE CONHECIMENTO) ---\n" + "\n".join(lines)
        except Exception:
            logger.exception("RAG search failed in worker, proceeding without")
            return ""

    async def analyze_labor_claim(
        self,
        *,
        file_urls: list[str],
        user_id: str,
        client_id: str | None,
        store_pdf: bool = False,
        store_input_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Analyze labor claim documents using Gemini (PDF bytes sent inline, no OCR).

        Accepts multiple PDF files — all are sent to Gemini in a single request.

        Pipeline:
            1. Download all PDFs
            2. Store input PDFs if requested
            3. Send PDF bytes directly to Gemini for analysis (returns JSON)
            4. Generate DOCX from JSON, convert to PDF via LibreOffice
            5. Store output PDF if requested
        """
        if not file_urls:
            raise WorkerException(status_code=400, detail="Nenhum arquivo enviado")

        # Download all PDFs in parallel
        pdf_bytes_list: list[bytes] = await asyncio.gather(
            *[self.storage.download_pdf_bytes(url) for url in file_urls]
        )

        inferred_filename = self.storage.infer_pdf_filename_from_url(file_urls[0])

        # Store input PDFs for history (first file only, as representative)
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes_list[0],
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )
            if "signed_url" in input_storage:
                input_storage["download_url"] = input_storage["signed_url"]

        # Run Gemini pipeline (PDF bytes -> Gemini -> JSON)
        pipeline_result = await run_gemini_multi_pdf_analysis(
            pdf_bytes_list=pdf_bytes_list,
            prompt=LABOR_CLAIM_GEMINI_PROMPT,
            progress=progress,
            model=get_gemini_model("labor_claim"),
        )

        raw_text = pipeline_result.markdown
        structured_data = pipeline_result.structured_data
        token_usage = pipeline_result.token_usage

        if not raw_text:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        if not structured_data:
            raise WorkerException(
                status_code=502,
                detail="Gemini não retornou JSON válido para o relatório de reclamação trabalhista",
            )

        response: dict = {
            "markdown": raw_text,
            "structured_data": structured_data,
        }

        if token_usage:
            response["token_usage"] = token_usage.to_dict()

        if input_storage:
            response["input_storage"] = input_storage

        # Generate DOCX from structured JSON
        docx_bytes = generate_labor_claim_docx_from_template(structured_data)

        # Upload both DOCX and PDF (converted from DOCX) if requested
        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            outputs = await self._store_report_outputs(
                docx_bytes=docx_bytes,
                filename=inferred_filename,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                expires_in=signed_url_expires_in,
                pdf_error_detail="Falha ao gerar PDF do relatório de reclamação trabalhista",
            )
            response.update(outputs)
        else:
            pdf_bytes_local = docx_bytes_to_pdf_bytes(docx_bytes)
            if not pdf_bytes_local or not pdf_bytes_local.lstrip().startswith(b"%PDF"):
                raise WorkerException(
                    status_code=502,
                    detail="Falha ao gerar PDF do relatório de reclamação trabalhista",
                )
            response["content"] = pdf_bytes_local

        return response

    async def analyze_brief_scanner(
        self,
        *,
        file_url: str,
        user_id: str,
        client_id: str | None,
        store_pdf: bool = True,
        store_input_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Analyze a legal brief using Gemini (PDF bytes sent inline, no OCR).

        Pipeline:
            1. Download PDF
            2. Store input PDF if requested
            3. Send PDF bytes directly to Gemini for analysis (returns JSON)
            4. Generate DOCX from JSON, convert to PDF via LibreOffice
            5. Store output PDF if requested
        """
        pdf_bytes = await self.storage.download_pdf_bytes(file_url)
        inferred_filename = self.storage.infer_pdf_filename_from_url(file_url)

        # Store input PDF for history
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )
            if "signed_url" in input_storage:
                input_storage["download_url"] = input_storage["signed_url"]

        # Run Gemini pipeline (PDF bytes -> Gemini -> JSON)
        pipeline_result = await run_gemini_pdf_analysis(
            pdf_bytes=pdf_bytes,
            prompt=BRIEF_SCANNER_GEMINI_PROMPT,
            progress=progress,
            model=get_gemini_model("brief_scanner"),
        )

        raw_text = pipeline_result.markdown
        structured_data = pipeline_result.structured_data
        token_usage = pipeline_result.token_usage

        if not raw_text:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        if not structured_data:
            raise WorkerException(
                status_code=502,
                detail="Gemini não retornou JSON válido para o relatório do Scanner de Peça",
            )

        response: dict = {
            "markdown": raw_text,
            "structured_data": structured_data,
        }

        if token_usage:
            response["token_usage"] = token_usage.to_dict()

        if input_storage:
            response["input_storage"] = input_storage

        # Generate DOCX from structured JSON
        docx_bytes = generate_brief_scanner_docx_from_template(structured_data)

        # Upload both DOCX and PDF (converted from DOCX) if requested
        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            outputs = await self._store_report_outputs(
                docx_bytes=docx_bytes,
                filename=inferred_filename,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                expires_in=signed_url_expires_in,
                pdf_error_detail="Falha ao gerar PDF do relatório do Scanner de Peça",
            )
            response.update(outputs)
        else:
            pdf_bytes_local = docx_bytes_to_pdf_bytes(docx_bytes)
            if not pdf_bytes_local or not pdf_bytes_local.lstrip().startswith(b"%PDF"):
                raise WorkerException(
                    status_code=502,
                    detail="Falha ao gerar PDF do relatório do Scanner de Peça",
                )
            response["content"] = pdf_bytes_local

        return response

    async def _download_file_bytes(self, file_url: str) -> tuple[bytes, str]:
        """Download any file (not just PDF) from a URL.

        Returns:
            Tuple of (file_bytes, content_type).
        """
        url = (file_url or "").strip()
        if not url:
            raise WorkerException(status_code=400, detail="file_url inválido")

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.get(url)
        except httpx.TimeoutException:
            raise WorkerException(status_code=504, detail="Tempo limite ao baixar o arquivo")
        except httpx.RequestError:
            raise WorkerException(status_code=502, detail="Erro ao baixar o arquivo")

        if resp.status_code >= 400:
            raise WorkerException(status_code=502, detail="Falha ao baixar o arquivo")

        content_type = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        return resp.content, content_type

    @staticmethod
    def _infer_audio_mime_type(file_url: str, content_type: str) -> str:
        """Infer the audio MIME type from URL extension or HTTP content-type."""
        # Trust content-type if it's audio/*
        if content_type.startswith("audio/"):
            return content_type

        # Fallback: infer from file extension
        ext_map = {
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".webm": "audio/webm",
            ".flac": "audio/flac",
            ".aac": "audio/aac",
        }
        url_lower = file_url.lower().split("?")[0]
        for ext, mime in ext_map.items():
            if url_lower.endswith(ext):
                return mime

        # Default fallback
        return "audio/mpeg"

    async def analyze_audio_transcription(
        self,
        *,
        file_url: str,
        user_id: str,
        client_id: str | None,
        store_pdf: bool = False,
        store_input_pdf: bool = False,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Transcribe audio using Gemini (audio bytes sent inline).

        Pipeline:
            1. Download audio file
            2. Infer MIME type
            3. Send audio bytes directly to Gemini for transcription
            4. Return transcription text (no PDF generation)
        """
        audio_bytes, content_type = await self._download_file_bytes(file_url)
        mime_type = self._infer_audio_mime_type(file_url, content_type)

        logger.info(
            "Audio transcription: %d bytes, mime=%s, content-type=%s",
            len(audio_bytes),
            mime_type,
            content_type,
        )

        # Run Gemini pipeline (audio bytes -> Gemini -> text)
        pipeline_result = await run_gemini_audio_analysis(
            audio_bytes=audio_bytes,
            mime_type=mime_type,
            prompt=AUDIO_TRANSCRIPTION_GEMINI_PROMPT,
            progress=progress,
            model=get_gemini_model("audio_transcription"),
        )

        raw_text = pipeline_result.markdown
        token_usage = pipeline_result.token_usage

        if not raw_text:
            raise WorkerException(status_code=502, detail="Pipeline retornou transcrição vazia")

        response: dict = {
            "markdown": raw_text,
        }

        if token_usage:
            response["token_usage"] = token_usage.to_dict()

        return response

    async def refund_credits(self, user_id: str, amount: int, reason: str = "job_failed") -> bool:
        """Calls backend to refund credits."""

        # Internal secret or admin key for backend communication
        # Assuming worker has permissions or uses a service role key if needed
        # For now, let's assume we can call an internal endpoint
        # or use DB directly if in same network

        # BETTER APPROACH: Since worker shares DB with backend,
        # use DB directly to avoid auth overhead/circular deps
        # But `CreditsService` logic is in backend.
        # Option A: Re-implement refund logic here (call RPC `grant_credits_to_user`)
        # Option B: Call backend API endpoint (requires auth)

        # Let's go with Option A (DB Direct) for robustness in worker
        try:
            from src.core.db import get_pool

            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT grant_credits_to_user(%s, %s, %s, 'purchased')",
                        (user_id, amount, reason),
                    )
            return True
        except Exception as e:
            logger.error(f"Failed to refund credits to user {user_id}: {e}")
            return False
