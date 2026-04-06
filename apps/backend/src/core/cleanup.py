"""
Cleanup service for periodic data maintenance.
Removes old AI jobs, orphan uploads, expired portal invites, and stale subscriptions.
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
INCOMPLETE_SUBSCRIPTION_DAYS = 7

STORAGE_BUCKET = "documents"


class CleanupService:
    """Service for cleaning up old data across the application."""

    async def run_all(self):
        """Run all cleanup tasks."""
        await self.cleanup_old_ai_jobs()
        await self.cleanup_orphan_uploads()
        await self.cleanup_expired_portal_invites()
        await self.cleanup_expired_documents()
        await self.cleanup_incomplete_subscriptions()

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

    async def cleanup_expired_documents(self):
        """
        Delete expired documents from both generated_documents and office_api.documents.
        Documents have expires_at set based on user's plan at creation time.
        NULL expires_at = permanent (no deletion).
        """
        logger.info("Cleaning up expired documents")

        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # 1. Delete expired generated_documents (AI + calculator outputs)
                    await cur.execute(
                        """
                        SELECT id, bucket, storage_path
                        FROM public.generated_documents
                        WHERE expires_at IS NOT NULL AND expires_at < NOW()
                        """
                    )
                    expired_generated = await cur.fetchall()

                    gen_files_deleted = 0
                    gen_docs_deleted = 0
                    if expired_generated:
                        gen_files_deleted = await self._delete_storage_files(expired_generated)
                        expired_ids = [d["id"] for d in expired_generated]
                        await cur.execute(
                            "DELETE FROM public.generated_documents WHERE id = ANY(%s)",
                            (expired_ids,),
                        )
                        gen_docs_deleted = cur.rowcount

                    # 2. Delete expired office documents
                    await cur.execute(
                        """
                        SELECT id, file_url
                        FROM office_api.documents
                        WHERE expires_at IS NOT NULL AND expires_at < NOW()
                        """
                    )
                    expired_office = await cur.fetchall()

                    office_files_deleted = 0
                    office_docs_deleted = 0
                    if expired_office:
                        # Convert to the format _delete_storage_files expects
                        office_files = [
                            {"bucket": STORAGE_BUCKET, "storage_path": d["file_url"]}
                            for d in expired_office
                            if d.get("file_url")
                        ]
                        office_files_deleted = await self._delete_storage_files(office_files)

                        expired_ids = [d["id"] for d in expired_office]
                        await cur.execute(
                            "DELETE FROM office_api.documents WHERE id = ANY(%s)",
                            (expired_ids,),
                        )
                        office_docs_deleted = cur.rowcount

            total_docs = gen_docs_deleted + office_docs_deleted
            total_files = gen_files_deleted + office_files_deleted
            if total_docs:
                logger.info(
                    f"Expired documents cleanup: {gen_docs_deleted} generated + "
                    f"{office_docs_deleted} office documents, {total_files} storage files deleted"
                )
            else:
                logger.info("No expired documents to clean up")

        except Exception as e:
            logger.error(f"Error cleaning up expired documents: {e}", exc_info=True)

    async def cleanup_incomplete_subscriptions(self):
        """
        Clean up subscriptions stuck in 'incomplete' status for more than 7 days.
        Safety net for missed Stripe webhooks (incomplete_expired).
        Resets the subscription to free plan and removes Stripe references.
        """
        brazil_tz = ZoneInfo("America/Sao_Paulo")
        cutoff = datetime.now(brazil_tz) - timedelta(days=INCOMPLETE_SUBSCRIPTION_DAYS)

        logger.info(f"Cleaning up incomplete subscriptions older than {cutoff.date()}")

        try:
            supabase = get_supabase()

            # Find subscriptions stuck in incomplete for >7 days
            result = (
                supabase.table("subscriptions")
                .select("id, user_id, stripe_subscription_id, updated_at")
                .in_("status", ["incomplete", "incomplete_expired"])
                .lt("updated_at", cutoff.isoformat())
                .execute()
            )

            if not result.data:
                logger.info("No stale incomplete subscriptions to clean up")
                return

            count = 0
            for sub in result.data:
                try:
                    supabase.table("subscriptions").update(
                        {
                            "status": "canceled",
                            "plan_id": "free",
                            "stripe_subscription_id": None,
                        }
                    ).eq("id", sub["id"]).execute()

                    # Reset credits to free tier
                    free_plan_res = (
                        supabase.table("billing_plans")
                        .select("monthly_credits")
                        .eq("slug", "free")
                        .single()
                        .execute()
                    )
                    free_credits = (
                        free_plan_res.data.get("monthly_credits", 0) if free_plan_res.data else 0
                    )
                    supabase.rpc(
                        "reset_monthly_credits",
                        {"p_user_id": sub["user_id"], "p_new_amount": free_credits},
                    ).execute()

                    count += 1
                    logger.info(
                        f"Cleaned up incomplete subscription for user {sub['user_id']} "
                        f"(stripe_sub: {sub.get('stripe_subscription_id')})"
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to clean up subscription {sub['id']}: {e}", exc_info=True
                    )

            logger.info(f"Incomplete subscriptions cleanup: {count} subscriptions reset")

        except Exception as e:
            logger.error(f"Error cleaning up incomplete subscriptions: {e}", exc_info=True)

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
