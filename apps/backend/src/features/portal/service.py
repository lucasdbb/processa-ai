"""Business logic for the client portal (read-only views for office clients)."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.logging import logger
from src.core.supabase import get_supabase
from src.features.portal.schemas import (
    InviteClientResponse,
    PortalDocument,
    PortalDocumentDownloadResponse,
    PortalDocumentsResponse,
    PortalEvent,
    PortalEventDocument,
    PortalEventsResponse,
    PortalFee,
    PortalFinancesResponse,
    PortalFinancesSummary,
    PortalMeResponse,
    PortalProcessListResponse,
    PortalProcessStatus,
    PortalProcessSummary,
    PortalTimelineEvent,
    PortalTimelineTranslation,
    RevokePortalResponse,
)
from src.features.portal.translation.service import translation_service

# Map raw process status -> (label, tailwind color token)
_PROCESS_STATUS_MAP: dict[str, tuple[str, str]] = {
    "active": ("Em andamento", "blue"),
    "pending": ("Aguardando", "yellow"),
    "suspended": ("Suspenso", "orange"),
    "archived": ("Arquivado", "gray"),
    "concluded": ("Concluído", "green"),
    "cancelled": ("Cancelado", "red"),
}


def _process_status(raw: str) -> PortalProcessStatus:
    label, color = _PROCESS_STATUS_MAP.get(raw, (raw.capitalize(), "gray"))
    return PortalProcessStatus(raw=raw, label=label, color=color)


class PortalService:
    """Service that resolves portal-user → client → lawyer and exposes read-only views."""

    # ------------------------------------------------------------------
    # Identity resolution
    # ------------------------------------------------------------------

    async def resolve_portal_client(self, portal_user_id: str) -> dict:
        """
        Given the auth user ID of a portal client, return their client record
        plus the lawyer's user_id.  Raises 403 if not found.
        """
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT id, user_id, name, email, portal_status, portal_invited_at
                    FROM office_api.clients
                    WHERE portal_user_id = %s
                    """,
                    (portal_user_id,),
                )
                row = await cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Portal client record not found",
            )
        if row["portal_status"] == "revoked":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Portal access has been revoked",
            )
        return row  # keys: id, user_id, name, email, portal_status, portal_invited_at

    async def resolve_lawyer_preview_client(
        self, lawyer_user_id: str, preview_client_id: str
    ) -> dict:
        """
        Resolve a client by id owned by the current lawyer for preview mode.
        """
        try:
            preview_uuid = str(UUID(preview_client_id))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid preview client id",
            )

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT id, user_id, name, email, portal_status, portal_invited_at
                    FROM office_api.clients
                    WHERE user_id = %s AND id = %s
                    """,
                    (lawyer_user_id, preview_uuid),
                )
                row = await cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )

        return row

    async def resolve_portal_context(
        self,
        user_id: str,
        user_role: str,
        preview_client_id: str | None = None,
    ) -> tuple[dict, bool]:
        """
        Returns (client_row, is_preview_mode).
        """
        if preview_client_id:
            if user_role == "office_client":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Preview mode is not available for portal clients",
                )
            client = await self.resolve_lawyer_preview_client(user_id, preview_client_id)
            return client, True

        client = await self.resolve_portal_client(user_id)
        return client, False

    # ------------------------------------------------------------------
    # /portal/me
    # ------------------------------------------------------------------

    async def get_me(
        self,
        user_id: str,
        user_role: str,
        preview_client_id: str | None = None,
    ) -> PortalMeResponse:
        client, is_preview = await self.resolve_portal_context(
            user_id, user_role, preview_client_id
        )

        # If first access, promote status to 'active'
        if not is_preview and client["portal_status"] == "invited":
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        UPDATE office_api.clients
                        SET portal_status = 'active', updated_at = NOW()
                        WHERE id = %s
                        """,
                        (str(client["id"]),),
                    )

        # Fetch lawyer name from profiles
        supabase = get_supabase()
        lawyer_name = "Seu Advogado"
        try:
            res = (
                supabase.table("profiles")
                .select("name")
                .eq("id", str(client["user_id"]))
                .single()
                .execute()
            )
            if res.data:
                lawyer_name = res.data.get("name", lawyer_name)
        except Exception:
            pass

        return PortalMeResponse(
            client_id=client["id"],
            client_name=client["name"],
            client_email=client["email"],
            lawyer_name=lawyer_name,
            portal_status=client["portal_status"],
            portal_invited_at=client["portal_invited_at"],
        )

    # ------------------------------------------------------------------
    # /portal/processes
    # ------------------------------------------------------------------

    async def get_processes(
        self,
        user_id: str,
        user_role: str,
        preview_client_id: str | None = None,
    ) -> PortalProcessListResponse:
        client, _ = await self.resolve_portal_context(user_id, user_role, preview_client_id)
        lawyer_id = str(client["user_id"])
        client_id = str(client["id"])

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Processes
                await cur.execute(
                    """
                    SELECT
                        p.id,
                        p.process_number,
                        p.type,
                        p.court,
                        p.status,
                        p.value,
                        (
                            SELECT MIN(e.start_at)::text
                            FROM office_api.events e
                            WHERE e.processo_id::uuid = p.id
                              AND e.event_type = 'prazo'
                              AND e.start_at >= CURRENT_DATE
                              AND (e.deadline_status IS NULL OR e.deadline_status != 'completed')
                        ) AS next_deadline
                    FROM office_api.processes p
                    WHERE p.user_id = %s AND p.client_id = %s
                    ORDER BY p.created_at DESC
                    """,
                    (lawyer_id, client_id),
                )
                process_rows = await cur.fetchall()

                process_ids = [str(row["id"]) for row in process_rows]

                # Batch-fetch recent timeline events for ALL processes at once
                # Uses LATERAL join to get the last 3 events per process
                await cur.execute(
                    """
                    SELECT te.id, te.process_id, te.title, te.description,
                           te.event_date, te.event_type
                    FROM unnest(%s::uuid[]) AS pid(id)
                    CROSS JOIN LATERAL (
                        SELECT *
                        FROM office_api.timeline_events t
                        WHERE t.process_id = pid.id
                        ORDER BY t.event_date DESC
                        LIMIT 3
                    ) te
                    """,
                    (process_ids,),
                )
                all_event_rows = await cur.fetchall()

                # Group events by process
                events_by_process: dict[str, list[dict]] = {}
                all_event_ids: list[str] = []
                for e in all_event_rows:
                    pid = str(e["process_id"])
                    events_by_process.setdefault(pid, []).append(e)
                    all_event_ids.append(str(e["id"]))

                # Batch-fetch translations for ALL events across all processes
                translations = (
                    await translation_service.get_translations_for_events(conn, all_event_ids)
                    if all_event_ids
                    else {}
                )

                # Batch-fetch documents for ALL events at once
                docs_by_event: dict[str, list[PortalEventDocument]] = {}
                if all_event_ids:
                    await cur.execute(
                        """
                        SELECT ted.timeline_event_id, d.id, d.name, d.file_size, d.mime_type
                        FROM office_api.documents d
                        INNER JOIN office_api.timeline_event_documents ted
                            ON d.id = ted.document_id
                        WHERE ted.timeline_event_id = ANY(%s)
                          AND d.visible_to_client = true
                          AND d.status != 'archived'
                        ORDER BY ted.created_at ASC
                        """,
                        (all_event_ids,),
                    )
                    for d in await cur.fetchall():
                        eid = str(d["timeline_event_id"])
                        docs_by_event.setdefault(eid, []).append(
                            PortalEventDocument(
                                id=d["id"],
                                name=d["name"],
                                file_size=d["file_size"],
                                mime_type=d["mime_type"],
                            )
                        )

                # Assemble response
                processes: list[PortalProcessSummary] = []
                for row in process_rows:
                    process_id = str(row["id"])
                    event_rows = events_by_process.get(process_id, [])

                    recent_events: list[PortalTimelineEvent] = []
                    for e in event_rows:
                        eid = str(e["id"])
                        t = translations.get(eid)
                        recent_events.append(
                            PortalTimelineEvent(
                                id=e["id"],
                                title=e["title"],
                                description=e["description"],
                                event_date=e["event_date"],
                                event_type=e["event_type"],
                                documents=docs_by_event.get(eid, []),
                                translation=PortalTimelineTranslation(
                                    summary=t.summary,
                                    explanation=t.explanation,
                                    action_required=t.action_required,
                                    next_step=t.next_step,
                                    sentiment=t.sentiment,
                                    process_phase=t.process_phase,
                                    process_phase_progress=t.process_phase_progress,
                                )
                                if t
                                else None,
                            )
                        )

                    processes.append(
                        PortalProcessSummary(
                            id=row["id"],
                            process_number=row["process_number"],
                            type=row["type"],
                            court=row["court"],
                            status=_process_status(row["status"]),
                            value=float(row["value"]) if row["value"] else None,
                            next_deadline=row["next_deadline"],
                            recent_events=recent_events,
                        )
                    )

        return PortalProcessListResponse(processes=processes, total=len(processes))

    # ------------------------------------------------------------------
    # /portal/events
    # ------------------------------------------------------------------

    async def get_events(
        self,
        user_id: str,
        user_role: str,
        preview_client_id: str | None = None,
    ) -> PortalEventsResponse:
        client, _ = await self.resolve_portal_context(user_id, user_role, preview_client_id)
        lawyer_id = str(client["user_id"])
        client_id = str(client["id"])
        now = datetime.now(timezone.utc)
        urgent_threshold = now + timedelta(days=7)

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        e.id,
                        e.title,
                        e.description,
                        e.start_at,
                        e.event_type,
                        e.processo_id,
                        p.process_number
                    FROM office_api.events e
                    LEFT JOIN office_api.processes p
                        ON p.id = e.processo_id::uuid
                       AND p.user_id = %s
                    WHERE e.user_id = %s
                      AND e.cliente_id = %s
                      AND e.event_type IN ('audiencia', 'prazo', 'reuniao')
                      AND (e.deadline_status IS NULL OR e.deadline_status != 'completed')
                      AND e.status != 'cancelled'
                    ORDER BY e.start_at ASC
                    LIMIT 100
                    """,
                    (lawyer_id, lawyer_id, client_id),
                )
                rows = await cur.fetchall()

        upcoming: list[PortalEvent] = []
        past: list[PortalEvent] = []

        for row in rows:
            start_at: datetime = row["start_at"]
            if start_at.tzinfo is None:
                start_at = start_at.replace(tzinfo=timezone.utc)

            evt = PortalEvent(
                id=row["id"],
                title=row["title"],
                description=row["description"],
                start_at=start_at,
                event_type=row["event_type"],
                process_number=row["process_number"],
                process_id=row["processo_id"],
                is_urgent=now <= start_at <= urgent_threshold,
            )
            if start_at >= now:
                upcoming.append(evt)
            else:
                past.append(evt)

        # Past events: most recent first
        past.sort(key=lambda e: e.start_at, reverse=True)

        return PortalEventsResponse(upcoming=upcoming, past=past[:20])

    # ------------------------------------------------------------------
    # /portal/documents
    # ------------------------------------------------------------------

    async def get_documents(
        self,
        user_id: str,
        user_role: str,
        preview_client_id: str | None = None,
    ) -> PortalDocumentsResponse:
        client, _ = await self.resolve_portal_context(user_id, user_role, preview_client_id)
        lawyer_id = str(client["user_id"])
        client_id = str(client["id"])

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        d.id,
                        d.name,
                        d.type,
                        d.file_size,
                        d.mime_type,
                        d.created_at,
                        p.process_number
                    FROM office_api.documents d
                    LEFT JOIN office_api.processes p
                        ON p.id = d.process_id AND p.user_id = %s
                    WHERE d.user_id = %s
                      AND (d.client_id = %s OR (d.process_id IS NOT NULL AND p.client_id = %s))
                      AND d.visible_to_client = true
                      AND d.status != 'archived'
                    ORDER BY d.created_at DESC
                    """,
                    (lawyer_id, lawyer_id, client_id, client_id),
                )
                rows = await cur.fetchall()

        docs = [
            PortalDocument(
                id=row["id"],
                name=row["name"],
                type=row["type"],
                file_size=row["file_size"],
                mime_type=row["mime_type"],
                process_number=row["process_number"],
                created_at=row["created_at"],
            )
            for row in rows
        ]
        return PortalDocumentsResponse(documents=docs, total=len(docs))

    async def get_document_download_url(
        self,
        user_id: str,
        user_role: str,
        document_id: str,
        preview_client_id: str | None = None,
    ) -> PortalDocumentDownloadResponse:
        client, _ = await self.resolve_portal_context(user_id, user_role, preview_client_id)
        lawyer_id = str(client["user_id"])
        client_id = str(client["id"])

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT d.file_url
                    FROM office_api.documents d
                    LEFT JOIN office_api.processes p
                        ON p.id = d.process_id AND p.user_id = %s
                    WHERE d.id = %s
                      AND d.user_id = %s
                      AND (d.client_id = %s OR (d.process_id IS NOT NULL AND p.client_id = %s))
                      AND d.visible_to_client = true
                    """,
                    (lawyer_id, document_id, lawyer_id, client_id, client_id),
                )
                row = await cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found",
            )

        file_url: str = row["file_url"]
        expires_in = 3600

        # If it's already a full URL, return it directly
        if file_url.startswith("http"):
            return PortalDocumentDownloadResponse(url=file_url, expires_in=expires_in)

        # Generate signed URL via Supabase Storage
        supabase = get_supabase()
        try:
            signed = supabase.storage.from_("documents").create_signed_url(file_url, expires_in)
            return PortalDocumentDownloadResponse(url=signed["signedURL"], expires_in=expires_in)
        except Exception as e:
            logger.error(f"Error generating signed URL: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not generate download URL",
            )

    # ------------------------------------------------------------------
    # /portal/finances
    # ------------------------------------------------------------------

    async def get_finances(
        self,
        user_id: str,
        user_role: str,
        preview_client_id: str | None = None,
    ) -> PortalFinancesResponse:
        client, _ = await self.resolve_portal_context(user_id, user_role, preview_client_id)
        lawyer_id = str(client["user_id"])
        client_id = str(client["id"])

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Summary
                await cur.execute(
                    """
                    SELECT
                        COALESCE(SUM(amount), 0) AS total_amount,
                        COALESCE(SUM(paid_amount), 0) AS total_paid,
                        COALESCE(SUM(
                            CASE WHEN status = 'pending' THEN amount - COALESCE(paid_amount,0)
                            ELSE 0 END
                        ), 0) AS total_pending,
                        COALESCE(SUM(
                            CASE WHEN status = 'overdue' THEN amount - COALESCE(paid_amount,0)
                            ELSE 0 END
                        ), 0) AS total_overdue
                    FROM office_api.fees
                    WHERE user_id = %s AND client_id = %s
                    """,
                    (lawyer_id, client_id),
                )
                summary_row = await cur.fetchone()

                # Fee list
                await cur.execute(
                    """
                    SELECT
                        f.id,
                        f.description,
                        f.fee_type,
                        f.amount,
                        COALESCE(f.paid_amount, 0) AS paid_amount,
                        f.status,
                        f.due_date,
                        f.paid_date AS paid_at,
                        p.process_number
                    FROM office_api.fees f
                    LEFT JOIN office_api.processes p
                        ON p.id = f.process_id AND p.user_id = %s
                    WHERE f.user_id = %s AND f.client_id = %s
                      AND f.status != 'cancelled'
                    ORDER BY
                        CASE f.status
                            WHEN 'overdue'  THEN 1
                            WHEN 'pending'  THEN 2
                            WHEN 'paid'     THEN 3
                            ELSE 4
                        END,
                        f.due_date ASC NULLS LAST
                    """,
                    (lawyer_id, lawyer_id, client_id),
                )
                fee_rows = await cur.fetchall()

        fees = [
            PortalFee(
                id=row["id"],
                description=row["description"],
                fee_type=row["fee_type"],
                amount=float(row["amount"]),
                paid_amount=float(row["paid_amount"]),
                status=row["status"],
                due_date=row["due_date"],
                paid_at=row["paid_at"],
                process_number=row["process_number"],
            )
            for row in fee_rows
        ]

        summary = PortalFinancesSummary(
            total_amount=float(summary_row["total_amount"]) if summary_row else 0,
            total_paid=float(summary_row["total_paid"]) if summary_row else 0,
            total_pending=float(summary_row["total_pending"]) if summary_row else 0,
            total_overdue=float(summary_row["total_overdue"]) if summary_row else 0,
        )

        return PortalFinancesResponse(summary=summary, fees=fees)

    # ------------------------------------------------------------------
    # Invite (called from clients router)
    # ------------------------------------------------------------------

    async def invite_client(self, lawyer_user_id: str, client_id: str) -> InviteClientResponse:
        """Send a Supabase invite email and link the resulting user to the client record."""
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT id, email, name, portal_status, portal_user_id
                    FROM office_api.clients
                    WHERE user_id = %s AND id = %s
                    """,
                    (lawyer_user_id, client_id),
                )
                client = await cur.fetchone()

        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

        if not client["email"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client has no email address",
            )

        if client["portal_status"] == "active":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Client already has active portal access",
            )

        supabase = get_supabase()
        now = datetime.now(timezone.utc)

        from src.core.config import settings

        try:
            # Invite via Supabase Auth (sends magic-link email)
            # redirect_to must point to the portal activation page so the
            # user lands on the password-setup screen, not the lawyer's app.
            portal_activate_url = f"{settings.FRONTEND_URL}/portal/ativar"
            invite_response = supabase.auth.admin.invite_user_by_email(
                client["email"],
                options={
                    "data": {"role": "office_client", "client_name": client["name"]},
                    "redirect_to": portal_activate_url,
                },
            )
            invited_user_id = invite_response.user.id
        except Exception as e:
            logger.error(f"Supabase invite error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send invite: {str(e)}",
            )

        # Create/update the profile with office_client role
        try:
            existing = supabase.table("profiles").select("id").eq("id", invited_user_id).execute()
            if existing.data:
                supabase.table("profiles").update(
                    {
                        "role": "office_client",
                        "name": client["name"],
                    }
                ).eq("id", invited_user_id).execute()
            else:
                supabase.table("profiles").insert(
                    {
                        "id": invited_user_id,
                        "email": client["email"],
                        "name": client["name"],
                        "role": "office_client",
                        "status": "active",
                    }
                ).execute()
        except Exception as e:
            logger.error(f"Profile creation error after invite: {e}")

        # Link portal_user_id on the client record
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    UPDATE office_api.clients
                    SET portal_user_id    = %s,
                        portal_invited_at = %s,
                        portal_status     = 'invited',
                        updated_at        = NOW()
                    WHERE id = %s
                    RETURNING portal_status, portal_invited_at
                    """,
                    (invited_user_id, now, client_id),
                )
                updated = await cur.fetchone()

        return InviteClientResponse(
            message=f"Convite enviado para {client['email']}",
            portal_status=updated["portal_status"],
            portal_invited_at=updated["portal_invited_at"],
        )

    async def revoke_portal_access(
        self, lawyer_user_id: str, client_id: str
    ) -> RevokePortalResponse:
        """Revoke portal access for a client."""
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT portal_user_id FROM office_api.clients
                    WHERE user_id = %s AND id = %s
                    """,
                    (lawyer_user_id, client_id),
                )
                client = await cur.fetchone()

        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

        portal_user_id = client["portal_user_id"]

        # Ban the Supabase auth user so they cannot log in
        if portal_user_id:
            supabase = get_supabase()
            try:
                supabase.auth.admin.update_user_by_id(
                    str(portal_user_id), {"ban_duration": "876000h"}
                )
            except Exception as e:
                logger.warning(f"Could not ban portal user {portal_user_id}: {e}")

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    UPDATE office_api.clients
                    SET portal_status = 'revoked', updated_at = NOW()
                    WHERE id = %s
                    RETURNING portal_status
                    """,
                    (client_id,),
                )
                updated = await cur.fetchone()

        return RevokePortalResponse(
            message="Acesso ao portal revogado",
            portal_status=updated["portal_status"],
        )


portal_service = PortalService()
