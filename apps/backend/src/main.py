"""Processa AI - Unified Backend API"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from src.api.router import api_router
from src.core.config import settings
from src.core.db import close_db, init_db
from src.core.logging import logger
from src.core.middleware import SupabaseAuthMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting Processa AI Backend on {settings.HOST}:{settings.PORT}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    db_ready = False
    scheduler = None

    if settings.ENVIRONMENT != "test":
        try:
            await init_db()
            db_ready = True
            logger.info("Database initialized successfully")
        except Exception:
            logger.exception("Failed to initialize database")

        # Start scheduler for background jobs
        try:
            from src.core.scheduler import create_scheduler, setup_jobs

            scheduler = create_scheduler()
            setup_jobs(scheduler)
            scheduler.start()
            logger.info("Scheduler started successfully")
        except Exception:
            logger.exception("Failed to start scheduler")

    yield

    # Shutdown
    if scheduler:
        try:
            scheduler.shutdown()
            logger.info("Scheduler stopped")
        except Exception:
            logger.exception("Failed to stop scheduler")

    if settings.ENVIRONMENT != "test" and db_ready:
        try:
            await close_db()
        except Exception:
            logger.exception("Failed to close database")

    logger.info("Shutting down Processa AI Backend")


app = FastAPI(
    title="Processa AI - Backend",
    description="Unified backend API for Processa AI platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Proxy Headers (Railway/load balancer support for HTTPS redirects)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# CORS
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Internal-Token"],
)

# Supabase JWT Auth Middleware
app.add_middleware(SupabaseAuthMiddleware)


@app.get("/")
async def root():
    return {
        "service": "processa-ai-backend",
        "description": "Unified backend API for Processa AI platform",
        "version": app.version,
    }


@app.get("/health")
async def health():
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "status": "healthy",
        "service": "processa-ai-backend",
        "version": app.version,
        "timestamp": now,
    }


app.include_router(api_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development"),
    )
