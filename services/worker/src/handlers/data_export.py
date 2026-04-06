from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, date, datetime, time
from decimal import Decimal
from io import BytesIO
from typing import Any

import httpx
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from psycopg.rows import dict_row

from src.core.config import settings
from src.core.db import get_pool
from src.core.job_store import (
    add_job_event,
    create_document,
    mark_job_completed,
    mark_job_failed,
    mark_job_processing,
)
from src.core.logging import logger
from src.core.storage import StorageService

SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"

# Keep sheet names short (Excel limit: 31 chars) and stable.
TABLE_EXPORTS: list[tuple[str, str]] = [
    ("Perfil", "SELECT to_jsonb(p) AS row_data FROM public.profiles p WHERE p.id = %s"),
    (
        "Assinaturas",
        "SELECT to_jsonb(s) AS row_data FROM public.subscriptions s WHERE s.user_id::text = %s",
    ),
    (
        "Clientes",
        "SELECT to_jsonb(c) AS row_data FROM office_api.clients c WHERE c.user_id::text = %s",
    ),
    (
        "Processos",
        "SELECT to_jsonb(p) AS row_data FROM office_api.processes p WHERE p.user_id::text = %s",
    ),
    (
        "Serviços",
        "SELECT to_jsonb(s) AS row_data FROM office_api.services s WHERE s.user_id::text = %s",
    ),
    (
        "Honorários",
        "SELECT to_jsonb(f) AS row_data FROM office_api.fees f WHERE f.user_id::text = %s",
    ),
    (
        "Pagamentos",
        "SELECT to_jsonb(fp) AS row_data FROM office_api.fee_payments fp WHERE fp.user_id::text = %s",
    ),
    ("Notas", "SELECT to_jsonb(n) AS row_data FROM office_api.notes n WHERE n.user_id::text = %s"),
    (
        "Timeline",
        "SELECT to_jsonb(t) AS row_data FROM office_api.timeline_events t WHERE t.user_id::text = %s",
    ),
    (
        "Calendário",
        "SELECT to_jsonb(e) AS row_data FROM office_api.events e WHERE e.user_id::text = %s",
    ),
    (
        "DocsEscritório",
        "SELECT to_jsonb(d) AS row_data FROM office_api.documents d WHERE d.user_id::text = %s",
    ),
    (
        "DocumentosGerados",
        "SELECT to_jsonb(gd) AS row_data FROM public.generated_documents gd WHERE gd.user_id::text = %s",
    ),
    (
        "Notificações",
        "SELECT to_jsonb(n) AS row_data FROM public.notifications n WHERE n.user_id::text = %s",
    ),
    (
        "Cálculos",
        "SELECT to_jsonb(c) AS row_data FROM public.calculations c WHERE c.user_id::text = %s",
    ),
    ("Jobs", "SELECT to_jsonb(j) AS row_data FROM public.jobs j WHERE j.user_id::text = %s"),
]

PROFILE_METADATA_COLUMNS = [
    "whatsapp_opt_in",
    "has_used_ai_tool",
    "checklist_dismissed",
    "has_used_calculator",
    "checklist_bonus_claimed",
    "welcome_credits_claimed",
]

SHEET_COLUMN_ORDER: dict[str, list[str]] = {
    "Perfil": [
        "id",
        "name",
        "email",
        "phone",
        "cpf",
        "role",
        "avatar_url",
        "created_at",
        "updated_at",
    ],
    "PerfilMetadados": [
        "profile_id",
        "whatsapp_opt_in",
        "has_used_ai_tool",
        "has_used_calculator",
        "checklist_dismissed",
        "checklist_bonus_claimed",
        "welcome_credits_claimed",
        "created_at",
        "updated_at",
    ],
    "Clientes": ["id", "name", "email", "phone", "cpf_cnpj", "status", "created_at"],
    "Processos": [
        "id",
        "process_number",
        "subject",
        "status",
        "client_id",
        "created_at",
    ],
    "Serviços": ["id", "title", "status", "client_id", "created_at"],
    "Honorários": ["id", "description", "fee_type", "status", "amount", "due_date", "paid_date"],
    "Pagamentos": ["id", "fee_id", "amount", "payment_date", "method", "created_at"],
    "Notificações": ["id", "type", "title", "description", "is_read", "created_at"],
    "Jobs": ["id", "job_type", "status", "progress", "created_at", "completed_at"],
}

SHEET_COLUMN_LABELS: dict[str, dict[str, str]] = {
    "PerfilMetadados": {
        "profile_id": "ID do perfil",
        "whatsapp_opt_in": "Consentimento WhatsApp",
        "has_used_ai_tool": "Já usou IA",
        "has_used_calculator": "Já usou calculadora",
        "checklist_dismissed": "Checklist dispensado",
        "checklist_bonus_claimed": "Bônus checklist resgatado",
        "welcome_credits_claimed": "Créditos boas-vindas resgatados",
        "created_at": "Criado em",
        "updated_at": "Atualizado em",
    }
}

GLOBAL_COLUMN_LABELS: dict[str, str] = {
    "id": "ID",
    "user_id": "ID do usuário",
    "client_id": "ID do cliente",
    "process_id": "ID do processo",
    "job_id": "ID do job",
    "name": "Nome",
    "title": "Título",
    "description": "Descrição",
    "email": "E-mail",
    "phone": "Telefone",
    "cpf": "CPF",
    "cpf_cnpj": "CPF/CNPJ",
    "role": "Perfil",
    "status": "Status",
    "amount": "Valor",
    "type": "Tipo",
    "subject": "Assunto",
    "process_number": "Número do processo",
    "fee_type": "Tipo de honorário",
    "progress": "Progresso",
    "message": "Mensagem",
    "metadata": "Metadados",
    "request_payload": "Payload da solicitação",
    "result_payload": "Payload de resultado",
    "created_at": "Criado em",
    "updated_at": "Atualizado em",
    "started_at": "Iniciado em",
    "completed_at": "Concluído em",
    "is_read": "Lida",
}

SHEET_DESCRIPTIONS: dict[str, str] = {
    "Perfil": "Dados principais da conta",
    "PerfilMetadados": "Sinais de uso/onboarding do produto",
    "Assinaturas": "Plano e status de assinatura",
    "Clientes": "Clientes cadastrados",
    "Processos": "Processos cadastrados",
    "Serviços": "Serviços cadastrados",
    "Honorários": "Honorários e cobranças",
    "Pagamentos": "Pagamentos de honorários",
    "Notas": "Notas internas",
    "Timeline": "Eventos de timeline dos processos",
    "Calendário": "Eventos de calendário",
    "DocsEscritório": "Documentos do escritório",
    "DocumentosGerados": "Documentos gerados pela plataforma",
    "Notificações": "Notificações no aplicativo",
    "Cálculos": "Histórico de calculadoras",
    "Jobs": "Histórico de jobs assíncronos",
}


def _to_jsonb(value: Any) -> Any:
    try:
        from psycopg.types.json import Jsonb
    except ModuleNotFoundError:
        return value
    return Jsonb(value)


def _safe_cell_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Sim" if value else "Não"
    if isinstance(value, (str, int, float)):
        text = value if isinstance(value, str) else value
        if isinstance(text, str) and len(text) > 32000:
            return text[:32000] + "...[truncated]"
        return text
    if isinstance(value, (datetime, date, time, uuid.UUID, Decimal)):
        return str(value)
    if isinstance(value, (dict, list, tuple)):
        text = json.dumps(value, ensure_ascii=False, default=str)
        if len(text) > 32000:
            return text[:32000] + "...[truncated]"
        return text
    text = str(value)
    if len(text) > 32000:
        return text[:32000] + "...[truncated]"
    return text


def _humanize_column_name(column_name: str) -> str:
    if column_name in GLOBAL_COLUMN_LABELS:
        return GLOBAL_COLUMN_LABELS[column_name]
    normalized = column_name.replace("_", " ").strip()
    if not normalized:
        return column_name
    return normalized[:1].upper() + normalized[1:]


def _ordered_headers(sheet_name: str, rows: list[dict[str, Any]]) -> list[str]:
    discovered: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                discovered.append(key)

    preferred = SHEET_COLUMN_ORDER.get(sheet_name, [])
    ordered = [column for column in preferred if column in seen]
    ordered.extend([column for column in discovered if column not in ordered])
    return ordered


def _column_labels(sheet_name: str, headers: list[str]) -> list[str]:
    sheet_labels = SHEET_COLUMN_LABELS.get(sheet_name, {})
    return [sheet_labels.get(header) or _humanize_column_name(header) for header in headers]


def _style_header_row(ws: Any, total_columns: int) -> None:
    header_fill = PatternFill(fill_type="solid", fgColor="1E293B")
    header_font = Font(color="FFFFFF", bold=True)
    for idx in range(1, total_columns + 1):
        cell = ws.cell(row=1, column=idx)
        cell.fill = header_fill
        cell.font = header_font


def _append_dataset_sheet(wb: Workbook, sheet_name: str, rows: list[dict[str, Any]]) -> None:
    ws = wb.create_sheet(title=sheet_name[:31])
    if not rows:
        ws.append(["Info"])
        ws.append(["Sem registros"])
        ws.column_dimensions["A"].width = 28
        return

    headers = _ordered_headers(sheet_name, rows)
    labels = _column_labels(sheet_name, headers)

    ws.append(labels)
    _style_header_row(ws, len(labels))

    max_lens = [len(label) for label in labels]
    for row in rows:
        values = [_safe_cell_value(row.get(header)) for header in headers]
        ws.append(values)
        for idx, value in enumerate(values):
            value_len = len(str(value)) if value is not None else 0
            if value_len > max_lens[idx]:
                max_lens[idx] = value_len

    for idx, max_len in enumerate(max_lens, start=1):
        width = min(max(max_len + 2, 12), 48)
        ws.column_dimensions[get_column_letter(idx)].width = width

    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{ws.max_row}"

    ws.freeze_panes = "A2"


def _split_profile_rows(
    rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    profile_rows: list[dict[str, Any]] = []
    metadata_rows: list[dict[str, Any]] = []

    for row in rows:
        core = dict(row)
        metadata: dict[str, Any] = {
            "profile_id": row.get("id"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }

        has_any_metadata = False
        for key in PROFILE_METADATA_COLUMNS:
            if key in core:
                metadata[key] = core.pop(key)
                has_any_metadata = True

        profile_rows.append(core)
        if has_any_metadata:
            metadata_rows.append(metadata)

    return profile_rows, metadata_rows


def _build_workbook(
    user_id: str,
    datasets: list[tuple[str, list[dict[str, Any]]]],
    errors: list[str],
) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)

    meta_sheet = wb.create_sheet(title="Meta")
    meta_sheet.append(["Campo", "Valor"])
    meta_sheet.append(["ID do usuário", user_id])
    meta_sheet.append(["Gerado em", datetime.now(UTC).isoformat()])
    meta_sheet.append(["Formato", "xlsx"])
    _style_header_row(meta_sheet, 2)
    meta_sheet.freeze_panes = "A2"
    meta_sheet.column_dimensions["A"].width = 18
    meta_sheet.column_dimensions["B"].width = 46

    summary_sheet = wb.create_sheet(title="Resumo")
    summary_sheet.append(["Aba", "Registros", "Descrição"])
    for sheet_name, rows in datasets:
        summary_sheet.append(
            [
                sheet_name,
                len(rows),
                SHEET_DESCRIPTIONS.get(sheet_name, "Dados exportados"),
            ]
        )
    _style_header_row(summary_sheet, 3)
    summary_sheet.freeze_panes = "A2"
    summary_sheet.column_dimensions["A"].width = 26
    summary_sheet.column_dimensions["B"].width = 12
    summary_sheet.column_dimensions["C"].width = 46

    if errors:
        errors_sheet = wb.create_sheet(title="Erros")
        errors_sheet.append(["Erro"])
        for err in errors:
            errors_sheet.append([err])
        _style_header_row(errors_sheet, 1)
        errors_sheet.freeze_panes = "A2"
        errors_sheet.column_dimensions["A"].width = 80

    for sheet_name, rows in datasets:
        _append_dataset_sheet(wb, sheet_name, rows)

    output = BytesIO()
    wb.save(output)
    return output.getvalue()


async def _fetch_profile_data(user_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT id, email, name FROM public.profiles WHERE id = %s LIMIT 1",
                (user_id,),
            )
            return await cur.fetchone()


async def _collect_datasets(
    user_id: str,
) -> tuple[list[tuple[str, list[dict[str, Any]]]], list[str]]:
    datasets: list[tuple[str, list[dict[str, Any]]]] = []
    errors: list[str] = []

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            for sheet_name, query in TABLE_EXPORTS:
                try:
                    await cur.execute(query, (user_id,))
                    rows = await cur.fetchall()
                    normalized_rows: list[dict[str, Any]] = []
                    for row in rows:
                        data = row.get("row_data") if isinstance(row, dict) else None
                        if isinstance(data, dict):
                            normalized_rows.append(data)

                    if sheet_name == "Perfil":
                        profile_rows, metadata_rows = _split_profile_rows(normalized_rows)
                        datasets.append((sheet_name, profile_rows))
                        if metadata_rows:
                            datasets.append(("PerfilMetadados", metadata_rows))
                    else:
                        datasets.append((sheet_name, normalized_rows))
                except Exception as exc:
                    logger.exception(
                        "Failed collecting dataset %s for user %s", sheet_name, user_id
                    )
                    datasets.append((sheet_name, []))
                    errors.append(f"{sheet_name}: {exc}")

    return datasets, errors


async def _create_export_notification(
    user_id: str,
    *,
    document_id: str | None,
    job_id: str,
    filename: str,
) -> None:
    pool = await get_pool()
    metadata: dict[str, Any] = {
        "job_id": job_id,
        "filename": filename,
    }
    if document_id:
        metadata["document_id"] = document_id

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO public.notifications (user_id, type, title, description, metadata)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    "system",
                    "Exportação de dados pronta",
                    "Seu arquivo Excel esta pronto para download.",
                    _to_jsonb(metadata),
                ),
            )


async def _send_export_ready_email(
    *,
    to_email: str,
    user_name: str | None,
    filename: str,
    download_url: str | None,
) -> bool:
    api_key = (settings.SENDGRID_API_KEY or "").strip()
    sender = (settings.SENDGRID_FROM or "").strip()
    frontend_url = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")

    if not api_key or not sender or not to_email:
        return False

    greeting_name = user_name.strip() if isinstance(user_name, str) and user_name.strip() else ""
    greeting = f"Olá, {greeting_name}!" if greeting_name else "Olá!"
    app_link = f"{frontend_url}/app/documentos"

    plain_body = (
        f"{greeting}\n\n"
        "Sua exportação de dados foi concluída com sucesso.\n"
        f"Arquivo: {filename}\n"
        + (f"Download direto: {download_url}\n" if download_url else "")
        + f"Acesse também em: {app_link}\n\n"
        "Equipe Processa AI"
    )

    html_body = (
        f"<p>{greeting}</p>"
        "<p>Sua exportação de dados foi concluída com sucesso.</p>"
        f"<p><strong>Arquivo:</strong> {filename}</p>"
        + (
            f'<p><a href="{download_url}">Clique aqui para baixar agora</a></p>'
            if download_url
            else ""
        )
        + f'<p>Você também pode acessar em <a href="{app_link}">Documentos</a>.</p>'
        "<p>Equipe Processa AI</p>"
    )

    payload = {
        "personalizations": [
            {"to": [{"email": to_email}], "subject": "Seu arquivo de exportação está pronto"}
        ],
        "from": {"email": sender},
        "content": [
            {"type": "text/plain", "value": plain_body},
            {"type": "text/html", "value": html_body},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                SENDGRID_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            return resp.status_code in (200, 201, 202)
    except Exception:
        logger.exception("Failed sending export-ready email")
        return False


async def handle_user_data_export_job(job_row: dict) -> None:
    """Generate an XLSX export with all user data and notify by email when ready."""
    raw_job_id = job_row.get("id")
    payload = (
        job_row.get("request_payload") if isinstance(job_row.get("request_payload"), dict) else {}
    )

    try:
        job_uuid = raw_job_id if isinstance(raw_job_id, uuid.UUID) else uuid.UUID(str(raw_job_id))
    except Exception:
        logger.error("Invalid job id for user_data_export: %s", raw_job_id)
        return

    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        await mark_job_failed(job_uuid=job_uuid, error="user_id obrigatório")
        await add_job_event(job_uuid=job_uuid, event_type="failed", message="user_id obrigatório")
        return

    try:
        await mark_job_processing(job_uuid=job_uuid, progress=10)
        await add_job_event(
            job_uuid=job_uuid,
            event_type="processing",
            message="Iniciando exportação de dados",
            payload={"progress": 10},
        )

        profile = await _fetch_profile_data(user_id)
        user_email = str(
            payload.get("user_email") or (profile.get("email") if profile else "") or ""
        ).strip()
        user_name = str(
            payload.get("user_name") or (profile.get("name") if profile else "") or ""
        ).strip()

        datasets, errors = await _collect_datasets(user_id)

        await add_job_event(
            job_uuid=job_uuid,
            event_type="processing",
            message="Gerando arquivo Excel",
            payload={"progress": 55},
        )

        xlsx_bytes = _build_workbook(user_id, datasets, errors)
        filename = f"meus_dados_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.xlsx"

        storage = StorageService()
        uploaded = await storage.upload_bytes_to_supabase(
            file_bytes=xlsx_bytes,
            user_id=user_id,
            client_id=None,
            functionality="data_exports",
            job_uuid=str(job_uuid),
            filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            expires_in=86400,
            output=True,
        )

        bucket = uploaded.get("bucket")
        storage_path = uploaded.get("storage_path")
        signed_url = uploaded.get("signed_url")

        document_id = None
        if isinstance(bucket, str) and isinstance(storage_path, str):
            checksum = hashlib.sha256(xlsx_bytes).hexdigest()

            document_id = await create_document(
                job_uuid=job_uuid,
                user_id=user_id,
                client_id=None,
                document_type="user_data_export_xlsx",
                bucket=bucket,
                storage_path=storage_path,
                filename=filename,
                checksum_sha256=checksum,
                size_bytes=len(xlsx_bytes),
                mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                metadata={"job_type": "user_data_export", "errors": errors},
                source="system",
            )

        result_payload: dict[str, Any] = {
            "filename": filename,
            "download_url": signed_url,
            "errors_count": len(errors),
        }
        if document_id:
            result_payload["document_id"] = str(document_id)

        await mark_job_completed(job_uuid=job_uuid, result_payload=result_payload)
        await add_job_event(
            job_uuid=job_uuid,
            event_type="completed",
            message="Exportação concluída",
            payload={"progress": 100},
        )

        await _create_export_notification(
            user_id,
            document_id=str(document_id) if document_id else None,
            job_id=str(job_uuid),
            filename=filename,
        )

        if user_email:
            email_sent = await _send_export_ready_email(
                to_email=user_email,
                user_name=user_name or None,
                filename=filename,
                download_url=signed_url if isinstance(signed_url, str) else None,
            )
            if not email_sent:
                logger.warning("Could not send export-ready email to user %s", user_id)

    except Exception as exc:
        logger.exception("user_data_export failed for user %s", user_id)
        try:
            await mark_job_failed(job_uuid=job_uuid, error=str(exc))
            await add_job_event(
                job_uuid=job_uuid,
                event_type="failed",
                message=str(exc),
            )
        except Exception:
            logger.exception("Failed to persist user_data_export failure state")
