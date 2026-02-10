"""Job progress reporting to Redis + PostgreSQL."""

from __future__ import annotations

import uuid

from src.core.logging import logger
from src.core.queue import set_job_status


class ProgressReporter:
    """Reports job progress to both Redis (real-time) and PostgreSQL (persistent)."""

    def __init__(self, job_id: str, job_uuid: uuid.UUID | None):
        self.job_id = job_id
        self.job_uuid = job_uuid

    async def report(self, progress: int, message: str = "") -> None:
        """Update progress in Redis and PostgreSQL. Failures are logged, never raised."""
        # Update Redis (real-time status for polling)
        try:
            await set_job_status(
                self.job_id,
                {
                    "job_id": self.job_id,
                    "status": "processing",
                    "progress": progress,
                },
            )
        except Exception:
            logger.exception("Failed to update job progress in Redis")

        if not self.job_uuid:
            return

        # Update PostgreSQL (persistent)
        try:
            from src.core.ai_worker_store import add_job_event, update_job_progress

            await update_job_progress(job_uuid=self.job_uuid, progress=progress)
            await add_job_event(
                job_uuid=self.job_uuid,
                event_type="processing",
                message=message or None,
                payload={"progress": progress},
            )
        except Exception:
            logger.exception("Failed to update job progress in database")
