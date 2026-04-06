from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.processes.schemas import (
    ProcessClientInfo,
    ProcessCreate,
    ProcessDeadlineSummary,
    ProcessDetailResponse,
    ProcessDocumentSummary,
    ProcessListParams,
    ProcessResponse,
    ProcessTimelineEvent,
    ProcessUpdate,
)


class ProcessesService:
    """Service for process operations."""

    async def list_processes(
        self,
        user_id: UUID,
        params: ProcessListParams,
    ) -> tuple[list[ProcessResponse], int]:
        """List processes for a user."""
        pool = await get_pool()

        where_conditions = ["p.user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        if params.search:
            where_conditions.append(
                "(p.process_number ILIKE %s OR p.type ILIKE %s OR "
                "p.defendant ILIKE %s OR p.subject ILIKE %s)"
            )
            search_pattern = f"%{params.search}%"
            query_params.extend([search_pattern] * 4)

        if params.status:
            where_conditions.append("p.status = %s")
            query_params.append(params.status)

        if params.client_id:
            where_conditions.append("p.client_id = %s")
            query_params.append(str(params.client_id))

        if params.court:
            where_conditions.append("p.court = %s")
            query_params.append(params.court)

        if params.tribunal:
            where_conditions.append("p.tribunal = %s")
            query_params.append(params.tribunal)

        if params.process_category:
            where_conditions.append("p.process_category = %s")
            query_params.append(params.process_category)

        if params.is_partnership is not None:
            where_conditions.append("p.is_partnership = %s")
            query_params.append(params.is_partnership)

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                count_query = (
                    f"SELECT COUNT(*) as total FROM office_api.processes p WHERE {where_clause}"
                )
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                data_query = f"""
                    SELECT p.*, c.name as client_name
                    FROM office_api.processes p
                    LEFT JOIN office_api.clients c ON p.client_id = c.id
                    WHERE {where_clause}
                    ORDER BY p.created_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                processes = [ProcessResponse(**row) for row in rows]
                return processes, total

    async def export_processes(self, user_id: UUID) -> str:
        """Export all processes as CSV."""
        from src.shared.csv_export import rows_to_csv

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT p.process_number, p.type, p.area, p.subject,
                           p.court, p.tribunal, p.defendant, p.client_role,
                           p.status, p.value, p.start_date, p.end_date,
                           c.name as client_name, p.process_category,
                           p.is_partnership, p.partner_lawyer, p.partner_percentage
                    FROM office_api.processes p
                    LEFT JOIN office_api.clients c ON p.client_id = c.id
                    WHERE p.user_id = %s
                    ORDER BY p.created_at DESC
                    """,
                    (str(user_id),),
                )
                rows = await cur.fetchall()

        headers = [
            "Número", "Tipo", "Área", "Assunto", "Vara/Órgão", "Tribunal",
            "Réu", "Polo do Cliente", "Status", "Valor da Causa",
            "Data Início", "Data Fim", "Cliente", "Categoria",
            "Parceria", "Advogado Parceiro", "% Parceiro",
        ]
        data = [
            [
                r["process_number"], r["type"], r["area"] or "",
                r["subject"] or "", r["court"] or "", r["tribunal"] or "",
                r["defendant"] or "", r["client_role"],
                r["status"], str(r["value"]) if r["value"] else "",
                r["start_date"].strftime("%d/%m/%Y") if r["start_date"] else "",
                r["end_date"].strftime("%d/%m/%Y") if r["end_date"] else "",
                r["client_name"] or "", r["process_category"],
                "Sim" if r["is_partnership"] else "Não",
                r["partner_lawyer"] or "",
                str(r["partner_percentage"]) if r["partner_percentage"] else "",
            ]
            for r in rows
        ]
        return rows_to_csv(headers, data)

    async def count_processes(self, user_id: UUID) -> dict[str, int]:
        """Count active processes for a user."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT COUNT(*) as total
                    FROM office_api.processes
                    WHERE user_id = %s AND status = 'active'
                    """,
                    (str(user_id),),
                )
                row = await cur.fetchone()
                return {"total": row["total"] if row else 0}

    async def get_process(self, user_id: UUID, process_id: UUID) -> ProcessResponse | None:
        """Get a single process by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT * FROM office_api.processes WHERE user_id = %s AND id = %s",
                    (str(user_id), str(process_id)),
                )
                row = await cur.fetchone()
                return ProcessResponse(**row) if row else None

    async def create_process(self, user_id: UUID, data: ProcessCreate) -> ProcessResponse:
        """Create a new process."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.processes (
                        user_id, client_id, process_number, process_category, court, tribunal,
                        defendant, client_role, type, area, subject, value, status, notes, start_date,
                        is_partnership, partner_lawyer, partner_percentage
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        str(data.client_id),
                        data.process_number,
                        data.process_category,
                        data.court,
                        data.tribunal,
                        data.defendant,
                        data.client_role,
                        data.type,
                        data.area,
                        data.subject,
                        data.value,
                        data.notes,
                        data.start_date,
                        data.is_partnership,
                        data.partner_lawyer,
                        data.partner_percentage,
                    ),
                )
                row = await cur.fetchone()
                return ProcessResponse(**row)

    async def update_process(
        self, user_id: UUID, process_id: UUID, data: ProcessUpdate
    ) -> ProcessResponse | None:
        """Update an existing process."""
        pool = await get_pool()

        ALLOWED_FIELDS = {
            "process_number",
            "process_category",
            "court",
            "tribunal",
            "defendant",
            "client_role",
            "type",
            "area",
            "subject",
            "value",
            "status",
            "notes",
            "start_date",
            "end_date",
            "is_partnership",
        }
        update_data = {
            k: v
            for k, v in data.model_dump(exclude_unset=True).items()
            if (v is not None or k == "is_partnership") and k in ALLOWED_FIELDS
        }
        if not update_data:
            return await self.get_process(user_id, process_id)

        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    f"""
                    UPDATE office_api.processes
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                    """,
                    values + [str(user_id), str(process_id)],
                )
                row = await cur.fetchone()
                return ProcessResponse(**row) if row else None

    async def delete_process(self, user_id: UUID, process_id: UUID) -> bool:
        """Delete a process."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM office_api.processes WHERE user_id = %s AND id = %s",
                    (str(user_id), str(process_id)),
                )
                return cur.rowcount > 0

    async def get_process_detail(
        self, user_id: UUID, process_id: UUID
    ) -> ProcessDetailResponse | None:
        """Get aggregated process detail with client, deadlines, timeline, and documents."""
        pool = await get_pool()
        uid = str(user_id)
        pid = str(process_id)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        p.*,
                        -- Client info as JSON
                        (SELECT json_build_object(
                            'id', c.id, 'name', c.name, 'email', c.email,
                            'phone', c.phone, 'cpf_cnpj', c.cpf_cnpj)
                         FROM office_api.clients c
                         WHERE c.id = p.client_id AND c.user_id = %(uid)s
                        ) as _client,
                        -- Deadlines (top 10)
                        (SELECT COALESCE(json_agg(sub), '[]'::json)
                         FROM (
                            SELECT e.id, e.title,
                                   e.start_at::text as due_date,
                                   e.deadline_status as status,
                                   e.priority,
                                   (e.start_at::date - CURRENT_DATE) as days_until
                            FROM office_api.events e
                            WHERE e.user_id = %(uid)s AND e.processo_id = p.id
                              AND e.event_type = 'prazo'
                            ORDER BY e.start_at ASC
                            LIMIT 10
                         ) sub
                        ) as _deadlines,
                        -- Deadline counts
                        (SELECT COUNT(*) FROM office_api.events e
                         WHERE e.user_id = %(uid)s AND e.processo_id = p.id
                           AND e.event_type = 'prazo'
                        ) as _deadlines_count,
                        (SELECT COUNT(*) FROM office_api.events e
                         WHERE e.user_id = %(uid)s AND e.processo_id = p.id
                           AND e.event_type = 'prazo'
                           AND e.start_at < CURRENT_DATE
                           AND e.deadline_status != 'completed'
                        ) as _overdue_deadlines_count,
                        -- Timeline events (top 20) with embedded documents
                        (SELECT COALESCE(json_agg(t_sub), '[]'::json)
                         FROM (
                            SELECT te.id, te.event_type, te.title,
                                   te.description, te.event_date, te.created_at,
                                   COALESCE(
                                       (SELECT json_agg(json_build_object(
                                           'id', d.id, 'name', d.name, 'file_url', d.file_url
                                        ) ORDER BY ted.created_at)
                                        FROM office_api.timeline_event_documents ted
                                        JOIN office_api.documents d ON d.id = ted.document_id
                                        WHERE ted.timeline_event_id = te.id),
                                       '[]'::json
                                   ) as documents
                            FROM office_api.timeline_events te
                            WHERE te.user_id = %(uid)s AND te.process_id = p.id
                            ORDER BY te.event_date DESC, te.created_at DESC
                            LIMIT 20
                         ) t_sub
                        ) as _timeline,
                        -- Timeline count
                        (SELECT COUNT(*) FROM office_api.timeline_events te
                         WHERE te.user_id = %(uid)s AND te.process_id = p.id
                        ) as _timeline_count,
                        -- Documents (top 10)
                        (SELECT COALESCE(json_agg(d_sub), '[]'::json)
                         FROM (
                            SELECT d.id, d.name, d.mime_type, d.file_size,
                                   d.file_url, d.visible_to_client, d.created_at
                            FROM office_api.documents d
                            WHERE d.user_id = %(uid)s AND d.process_id = p.id
                            ORDER BY d.created_at DESC
                            LIMIT 10
                         ) d_sub
                        ) as _documents,
                        -- Documents count
                        (SELECT COUNT(*) FROM office_api.documents d
                         WHERE d.user_id = %(uid)s AND d.process_id = p.id
                        ) as _documents_count
                    FROM office_api.processes p
                    WHERE p.user_id = %(uid)s AND p.id = %(pid)s
                    """,
                    {"uid": uid, "pid": pid},
                )
                row = await cur.fetchone()

                if not row:
                    return None

                # Extract aggregated fields (prefixed with _) from the row
                client_data = row.pop("_client")
                deadlines_data = row.pop("_deadlines") or []
                deadlines_count = row.pop("_deadlines_count")
                overdue_deadlines_count = row.pop("_overdue_deadlines_count")
                timeline_data = row.pop("_timeline") or []
                timeline_count = row.pop("_timeline_count")
                documents_data = row.pop("_documents") or []
                documents_count = row.pop("_documents_count")

                client = (
                    ProcessClientInfo(**client_data)
                    if client_data
                    else ProcessClientInfo(
                        id=row["client_id"],
                        name="Cliente não encontrado",
                        email=None,
                        phone=None,
                        cpf_cnpj=None,
                    )
                )

                return ProcessDetailResponse(
                    **row,
                    client=client,
                    deadlines=[ProcessDeadlineSummary(**d) for d in deadlines_data],
                    deadlines_count=deadlines_count,
                    overdue_deadlines_count=overdue_deadlines_count,
                    timeline=[ProcessTimelineEvent(**t) for t in timeline_data],
                    timeline_count=timeline_count,
                    documents=[ProcessDocumentSummary(**d) for d in documents_data],
                    documents_count=documents_count,
                )

    async def sync_active_processes_with_datajud(self, batch_size: int = 50) -> dict[str, Any]:
        """Sync active processes with external judicial data to find new timeline events."""
        import asyncio
        from src.features.office.processes.datajud_service import datajud_service
        from src.core.logging import logger

        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT id, user_id, process_number
                    FROM office_api.processes
                    WHERE status = 'active'
                    ORDER BY updated_at ASC
                    LIMIT %s
                    """,
                    (batch_size,),
                )
                processes_to_sync = await cur.fetchall()

        if not processes_to_sync:
            return {"processed": 0, "updates_count": 0}

        updates_count = 0

        for proc in processes_to_sync:
            cnj = proc["process_number"]
            if len(datajud_service.strip_cnj_mask(cnj)) != 20:
                continue

            raw_data = await datajud_service.fetch_process_metadata(cnj)
            await asyncio.sleep(0.5)  # Rate limiting entre chamadas

            if not raw_data:
                continue

            movimentos = raw_data.get("movimentos", [])
            if not movimentos:
                continue

            async with pool.connection() as conn:
                async with conn.transaction():
                    async with conn.cursor() as cur:
                        for mov in movimentos:
                            data_hora_str = mov.get("dataHora")
                            if not data_hora_str:
                                continue

                            nome = mov.get("nome", "Movimento")
                            complementos = mov.get("complementosTabelados", [])
                            desc_parts = [nome] + [
                                c.get("descricao", "")
                                for c in complementos
                                if c.get("descricao")
                            ]
                            description = " | ".join(filter(None, desc_parts))[:500]

                            await cur.execute(
                                """
                                INSERT INTO office_api.timeline_events
                                    (process_id, user_id, event_type, title, description, event_date, source)
                                SELECT %s, %s, 'other', %s, %s, %s::timestamp, 'auto'
                                WHERE NOT EXISTS (
                                    SELECT 1 FROM office_api.timeline_events
                                    WHERE process_id = %s AND title = %s AND event_date = %s::timestamp
                                )
                                """,
                                (
                                    str(proc["id"]),
                                    str(proc["user_id"]),
                                    nome,
                                    description,
                                    data_hora_str,
                                    str(proc["id"]),
                                    nome,
                                    data_hora_str,
                                ),
                            )
                            if cur.rowcount and cur.rowcount > 0:
                                updates_count += 1

                        await cur.execute(
                            "UPDATE office_api.processes SET updated_at = NOW() WHERE id = %s",
                            (str(proc["id"]),),
                        )

        logger.info(
            f"Sync de processos concluído. Processados: {len(processes_to_sync)}. Novos movimentos: {updates_count}"
        )
        return {"processed": len(processes_to_sync), "updates_count": updates_count}


processes_service = ProcessesService()
