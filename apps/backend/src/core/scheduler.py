"""
Scheduler configuration for background jobs
Uses APScheduler with optional Redis for distributed locking
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Import job dependencies
from src.core.cleanup import CleanupService
from src.core.email import send_email
from src.core.logging import logger
from src.features.office.deadlines.notifications import DeadlineNotificationService
from src.features.office.processes.service import processes_service


def create_scheduler() -> AsyncIOScheduler:
    """
    Create and configure the scheduler

    For development: Uses MemoryJobStore (simple, single instance)
    For production: Should use RedisJobStore (distributed lock)
    """
    jobstores = {
        "default": MemoryJobStore()
        # For production with multiple instances, use Redis:
        # 'default': RedisJobStore(
        #     host=settings.REDIS_HOST,
        #     port=settings.REDIS_PORT,
        #     password=settings.REDIS_PASSWORD
        # )
    }

    executors = {"default": AsyncIOExecutor()}

    job_defaults = {
        "coalesce": True,  # If missed, run only once (not multiple times)
        "max_instances": 1,  # Only one instance of each job at a time
        "misfire_grace_time": 3600,  # Job can be late up to 1 hour
    }

    scheduler = AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone=ZoneInfo("America/Sao_Paulo"),
    )

    return scheduler


ADMIN_EMAIL = "admin@processai.app.br"


async def _notify_admin(job_name: str, event: str, error: str | None = None):
    """Send admin notification about a scheduled job event (started, completed, error)."""
    now = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%d/%m/%Y %H:%M:%S")
    if event == "started":
        subject = f"[Processa AI] Job {job_name} iniciado"
        body = f"O job agendado {job_name} foi iniciado em {now} (America/Sao_Paulo)."
    elif event == "completed":
        subject = f"[Processa AI] Job {job_name} concluído"
        body = f"O job agendado {job_name} foi concluído com sucesso em {now} (America/Sao_Paulo)."
    else:
        subject = f"[Processa AI] Job {job_name} falhou"
        body = f"O job agendado {job_name} falhou em {now} (America/Sao_Paulo).\n\nErro: {error}"
    await send_email(to_email=ADMIN_EMAIL, subject=subject, body=body)


async def check_deadlines_job():
    """Job to check upcoming deadlines and create notifications + send emails"""
    try:
        logger.info("Running scheduled job: check_deadlines")
        await _notify_admin("check_deadlines", "started")

        service = DeadlineNotificationService()
        await service.check_upcoming_deadlines()

        logger.info("Completed scheduled job: check_deadlines")
        await _notify_admin("check_deadlines", "completed")
    except Exception as e:
        logger.error(f"Error in check_deadlines job: {e}", exc_info=True)
        await _notify_admin("check_deadlines", "error", error=str(e))


async def weekly_deadline_summary_job():
    """Job to send weekly summary of upcoming deadlines via email"""
    try:
        logger.info("Running scheduled job: weekly_deadline_summary")
        await _notify_admin("weekly_deadline_summary", "started")

        service = DeadlineNotificationService()
        await service.send_weekly_summary()

        logger.info("Completed scheduled job: weekly_deadline_summary")
        await _notify_admin("weekly_deadline_summary", "completed")
    except Exception as e:
        logger.error(f"Error in weekly_deadline_summary job: {e}", exc_info=True)
        await _notify_admin("weekly_deadline_summary", "error", error=str(e))


async def cleanup_old_data_job():
    """Job to clean up old AI jobs, orphan uploads, and expired portal invites"""
    try:
        logger.info("Running scheduled job: cleanup_old_data")
        await _notify_admin("cleanup_old_data", "started")

        service = CleanupService()
        await service.run_all()

        logger.info("Completed scheduled job: cleanup_old_data")
        await _notify_admin("cleanup_old_data", "completed")
    except Exception as e:
        logger.error(f"Error in cleanup_old_data job: {e}", exc_info=True)
        await _notify_admin("cleanup_old_data", "error", error=str(e))


async def datajud_sync_job():
    """Job to sync active processes with DataJUD API to fetch new timeline events."""
    try:
        logger.info("Running scheduled job: datajud_sync")
        await _notify_admin("datajud_sync", "started")

        result = await processes_service.sync_active_processes_with_datajud(batch_size=100)

        logger.info(f"Completed scheduled job: datajud_sync. Result: {result}")
        await _notify_admin("datajud_sync", "completed")
    except Exception as e:
        logger.error(f"Error in datajud_sync job: {e}", exc_info=True)
        await _notify_admin("datajud_sync", "error", error=str(e))


def setup_jobs(scheduler: AsyncIOScheduler):
    """
    Configure all scheduled jobs

    Runs daily at 8:00 AM Brazil time (America/Sao_Paulo)
    """
    # Check deadlines daily at 8:00 AM Brazil time
    scheduler.add_job(
        check_deadlines_job,
        "cron",
        hour=8,
        minute=0,
        timezone=ZoneInfo("America/Sao_Paulo"),
        id="check_deadlines_daily",
        replace_existing=True,
        name="Check upcoming deadlines (8AM Brazil time)",
    )

    # Weekly deadline summary every Monday at 8:00 AM Brazil time
    scheduler.add_job(
        weekly_deadline_summary_job,
        "cron",
        day_of_week="mon",
        hour=8,
        minute=0,
        timezone=ZoneInfo("America/Sao_Paulo"),
        id="weekly_deadline_summary",
        replace_existing=True,
        name="Weekly deadline summary (Monday 8AM Brazil time)",
    )

    # Cleanup old data on the 1st of every month at 3:00 AM Brazil time
    scheduler.add_job(
        cleanup_old_data_job,
        "cron",
        day=1,
        hour=3,
        minute=0,
        timezone=ZoneInfo("America/Sao_Paulo"),
        id="cleanup_old_data_monthly",
        replace_existing=True,
        name="Cleanup old data (1st of month, 3AM Brazil time)",
    )

    # Sync with DataJUD API every 12 hours (1AM and 1PM)
    scheduler.add_job(
        datajud_sync_job,
        "cron",
        hour="1,13",
        minute=0,
        timezone=ZoneInfo("America/Sao_Paulo"),
        id="datajud_sync_twice_daily",
        replace_existing=True,
        name="Sync with DataJUD (1AM and 1PM Brazil time)",
    )

    logger.info("Scheduled jobs configured:")
    for job in scheduler.get_jobs():
        next_run = getattr(job, "next_run_time", "Not scheduled yet (scheduler not started)")
        logger.info(f"  - {job.name} (id: {job.id}, next run: {next_run})")
