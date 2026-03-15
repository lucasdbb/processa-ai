"""
Cleanup service for periodic data maintenance.
Removes old AI jobs, orphan uploads, and expired portal invites.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.logging import logger
from src.core.supabase import get_supabase

# Retention periods (days)
COMPLETED_JOBS_RETENTION_DAYS = 90
FAILED_JOBS_RETENTION_DAYS = 30
ORPHAN_UPLOADS_RETENTION_DAYS = 7
EXPIRED_INVITE_DAYS = 30

STORAGE_BUCKET = "documents"


class CleanupService:
    """Service for cleaning up old data across the application."""

    async def run_all(self):
        """Run all cleanup tasks."""
        await self.cleanup_old_ai_jobs()
        await self.cleanup_orphan_uploads()
        await self.cleanup_expired_portal_invites()

    async def cleanup_old_ai_jobs(self):
        """
        Delete old AI jobs and their associated storage files.

        - Completed jobs older than 90 days
        - Failed/cancelled jobs older than 30 days
        - Associated ai_job_events are deleted via FK CASCADE
        - Associated generated_documents have job_id set to NULL (FK ON DELETE SET NULL),
          so we explicitly delete them and their storage files first
        """
        brazil_tz = ZoneInfo("America/Sao_Paulo")
        now = datetime.now(brazil_tz)
        completed_cutoff = now - timedelta(days=COMPLETED_JOBS_RETENTION_DAYS)
        failed_cutoff = now - timedelta(days=FAILED_JOBS_RETENTION_DAYS)

        logger.info(
            f"Cleaning up AI jobs: completed before {completed_cutoff.date()}, "
            f"failed/cancelled before {failed_cutoff.date()}"
        )

        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Find jobs to delete
                    await cur.execute(
                        """
                        SELECT id FROM public.ai_jobs
                        WHERE (status = 'completed' AND finished_at < %s)
                           OR (status IN ('failed', 'cancelled') AND finished_at < %s)
                        """,
                        (completed_cutoff, failed_cutoff),
                    )
                    jobs = await cur.fetchall()

                    if not jobs:
                        logger.info("No old AI jobs to clean up")
                        return

                    job_ids = [job["id"] for job in jobs]
                    logger.info(f"Found {len(job_ids)} old AI jobs to clean up")

                    # Get storage files to delete
                    await cur.execute(
                        """
                        SELECT bucket, storage_path FROM public.generated_documents
                        WHERE job_id = ANY(%s) AND storage_path IS NOT NULL
                        """,
                        (job_ids,),
                    )
                    files = await cur.fetchall()

                    # Delete storage files from Supabase
                    files_deleted = await self._delete_storage_files(files)

                    # Delete generated_documents records
                    await cur.execute(
                        "DELETE FROM public.generated_documents WHERE job_id = ANY(%s)",
                        (job_ids,),
                    )
                    docs_deleted = cur.rowcount

                    # Delete AI jobs (ai_job_events cascade automatically)
                    await cur.execute(
                        "DELETE FROM public.ai_jobs WHERE id = ANY(%s)",
                        (job_ids,),
                    )
                    jobs_deleted = cur.rowcount

            logger.info(
                f"AI jobs cleanup: {jobs_deleted} jobs, {docs_deleted} documents, "
                f"{files_deleted} storage files deleted"
            )

        except Exception as e:
            logger.error(f"Error cleaning up AI jobs: {e}", exc_info=True)

    async def cleanup_orphan_uploads(self):
        """
        Delete orphan uploads — generated_documents with no associated job
        that are older than 7 days (likely failed/abandoned uploads).
        """
        brazil_tz = ZoneInfo("America/Sao_Paulo")
        cutoff = datetime.now(brazil_tz) - timedelta(days=ORPHAN_UPLOADS_RETENTION_DAYS)

        logger.info(f"Cleaning up orphan uploads created before {cutoff.date()}")

        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Find orphan documents
                    await cur.execute(
                        """
                        SELECT id, bucket, storage_path FROM public.generated_documents
                        WHERE job_id IS NULL
                          AND created_at < %s
                          AND storage_path IS NOT NULL
                        """,
                        (cutoff,),
                    )
                    orphans = await cur.fetchall()

                    if not orphans:
                        logger.info("No orphan uploads to clean up")
                        return

                    logger.info(f"Found {len(orphans)} orphan uploads to clean up")

                    # Delete storage files
                    files_deleted = await self._delete_storage_files(orphans)

                    # Delete DB records
                    orphan_ids = [o["id"] for o in orphans]
                    await cur.execute(
                        "DELETE FROM public.generated_documents WHERE id = ANY(%s)",
                        (orphan_ids,),
                    )
                    docs_deleted = cur.rowcount

            logger.info(
                f"Orphan uploads cleanup: {docs_deleted} documents, "
                f"{files_deleted} storage files deleted"
            )

        except Exception as e:
            logger.error(f"Error cleaning up orphan uploads: {e}", exc_info=True)

    async def cleanup_expired_portal_invites(self):
        """
        Reset expired portal invites back to 'not_invited'.
        Invites pending for more than 30 days are considered expired.
        """
        brazil_tz = ZoneInfo("America/Sao_Paulo")
        cutoff = datetime.now(brazil_tz) - timedelta(days=EXPIRED_INVITE_DAYS)

        logger.info(f"Cleaning up portal invites sent before {cutoff.date()}")

        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(
                        """
                        UPDATE office_api.clients
                        SET portal_status = 'not_invited',
                            portal_invited_at = NULL
                        WHERE portal_status = 'invited'
                          AND portal_invited_at < %s
                          AND portal_user_id IS NULL
                        RETURNING id
                        """,
                        (cutoff,),
                    )
                    expired = await cur.fetchall()

            count = len(expired)
            if count:
                logger.info(f"Expired portal invites cleanup: {count} invites reset")
            else:
                logger.info("No expired portal invites to clean up")

        except Exception as e:
            logger.error(f"Error cleaning up expired portal invites: {e}", exc_info=True)

    async def _delete_storage_files(self, files: list[dict]) -> int:
        """Delete files from Supabase Storage. Returns count of successfully deleted files."""
        if not files:
            return 0

        deleted = 0
        # Group by bucket for batch deletion
        by_bucket: dict[str, list[str]] = {}
        for f in files:
            bucket = f.get("bucket") or STORAGE_BUCKET
            path = f.get("storage_path")
            if path:
                by_bucket.setdefault(bucket, []).append(path)

        supabase = get_supabase()
        for bucket, paths in by_bucket.items():
            try:
                supabase.storage.from_(bucket).remove(paths)
                deleted += len(paths)
            except Exception as e:
                logger.warning(f"Failed to delete {len(paths)} files from bucket '{bucket}': {e}")

        return deleted
