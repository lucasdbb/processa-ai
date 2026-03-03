"""
Scheduler configuration for background jobs
Uses APScheduler with optional Redis for distributed locking
"""

from datetime import datetime

from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.core.email import send_email
from src.core.logging import logger

# Import job functions
from src.features.office.deadlines.notifications import DeadlineNotificationService


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
        timezone="America/Sao_Paulo",  # Brazil timezone
    )

    return scheduler


async def check_deadlines_job():
    """Job to check upcoming deadlines and create notifications"""
    try:
        logger.info("Running scheduled job: check_deadlines")

        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        await send_email(
            to_email="admin@processai.app.br",
            subject="[Processa AI] Job check_deadlines iniciado",
            body=f"O job agendado check_deadlines foi iniciado em {now} (America/Sao_Paulo).",
        )

        service = DeadlineNotificationService()
        await service.check_upcoming_deadlines()
        logger.info("Completed scheduled job: check_deadlines")
    except Exception as e:
        logger.error(f"Error in check_deadlines job: {e}", exc_info=True)


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
        timezone="America/Sao_Paulo",
        id="check_deadlines_daily",
        replace_existing=True,
        name="Check upcoming deadlines (8AM Brazil time)",
    )

    logger.info("Scheduled jobs configured:")
    for job in scheduler.get_jobs():
        next_run = getattr(job, "next_run_time", "Not scheduled yet (scheduler not started)")
        logger.info(f"  - {job.name} (id: {job.id}, next run: {next_run})")


# For future: Add more jobs here
# scheduler.add_job(send_weekly_reports, 'cron', day_of_week='mon', hour=9)
# scheduler.add_job(cleanup_old_data, 'cron', day='1', hour=2)
