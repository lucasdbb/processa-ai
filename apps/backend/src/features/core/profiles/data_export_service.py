import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.job_store import add_job_event, create_job


class DataExportService:
    """Handles async export requests for all user data."""

    async def request_user_data_export(self, user_id: str) -> str:
        """Enqueue a user_data_export job with 1 request/day limit."""
        pool = await get_pool()
        now = datetime.now(UTC)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT created_at
                    FROM public.jobs
                    WHERE user_id = %s
                      AND job_type = 'user_data_export'
                      AND created_at >= NOW() - INTERVAL '1 day'
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (user_id,),
                )
                recent_export = await cur.fetchone()

                if recent_export and recent_export.get("created_at"):
                    next_allowed = recent_export["created_at"] + timedelta(days=1)
                    retry_in_hours = max(int((next_allowed - now).total_seconds() // 3600), 1)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=(
                            "Você já solicitou uma exportação nas últimas 24 horas. "
                            f"Tente novamente em aproximadamente {retry_in_hours}h."
                        ),
                    )

                await cur.execute(
                    """
                    SELECT email, name
                    FROM public.profiles
                    WHERE id = %s
                    LIMIT 1
                    """,
                    (user_id,),
                )
                profile = await cur.fetchone()

        job_uuid = uuid.uuid4()
        request_payload = {
            "user_id": user_id,
            "user_email": profile.get("email") if profile else None,
            "user_name": profile.get("name") if profile else None,
            "requested_at": now.isoformat(),
            "format": "xlsx",
            "job_name": "Exportar meus dados",
        }

        await create_job(
            job_uuid=job_uuid,
            job_type="user_data_export",
            user_id=user_id,
            client_id=None,
            request_payload=request_payload,
            queue="jobs",
            status="queued",
            priority=1,
        )
        await add_job_event(
            job_uuid=job_uuid,
            event_type="queued",
            message="Solicitação de exportação de dados recebida",
        )

        return str(job_uuid)


data_export_service = DataExportService()
