from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI

from src.api.router import api_router
from src.core.ai_worker_store import ensure_endpoint
from src.core.config import settings
from src.core.db import close_db, init_db
from src.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Processa AI - AI Worker")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    db_ready = False
    if settings.ENVIRONMENT != "test":
        try:
            await init_db()
            db_ready = True
        except Exception:
            logger.exception("Failed to initialize database")

        if db_ready:
            try:
                await ensure_endpoint(
                    key="cnis_analysis",
                    path="/v1/ai/analyses/cnis",
                    description="Análise de CNIS",
                    n8n_workflow_id=(settings.N8N_CNIS_WORKFLOW_ID or None),
                    is_active=True,
                )
            except Exception:
                logger.exception("Failed to seed endpoints")
    yield
    if settings.ENVIRONMENT != "test" and db_ready:
        try:
            await close_db()
        except Exception:
            logger.exception("Failed to close database")
    logger.info("Shutting down Processa AI - AI Worker")


app = FastAPI(
    title="Processa AI - AI Worker",
    description="Serviço interno de processamento assíncrono/IA",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "processa-ai-ai-worker",
        "description": "Serviço interno de processamento/IA",
        "version": app.version,
    }


@app.get("/health")
async def health_check():
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "status": "healthy",
        "service": "processa-ai-ai-worker",
        "version": "1.0.0",
        "timestamp": now,
    }
