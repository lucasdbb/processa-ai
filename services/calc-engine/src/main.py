from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI

from src.api.router import api_router
from src.core.config import settings
from src.core.db import close_db, init_db
from src.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Processa AI - Calc Engine")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    db_ready = False
    if settings.ENVIRONMENT != "test":
        try:
            await init_db()
            db_ready = True
        except Exception:
            logger.exception("Failed to initialize database")

    yield

    if settings.ENVIRONMENT != "test" and db_ready:
        try:
            await close_db()
        except Exception:
            logger.exception("Failed to close database")
    logger.info("Shutting down Processa AI - Calc Engine")


app = FastAPI(
    title="Processa AI - Calc Engine",
    description="Serviço interno de cálculos síncronos/auditáveis",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "processa-ai-calc-engine",
        "description": "Serviço interno de cálculos síncronos",
        "version": app.version,
    }


@app.get("/health")
async def health_check():
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "status": "healthy",
        "service": "processa-ai-calc-engine",
        "version": "1.0.0",
        "timestamp": now,
    }
