"""Core API - Main application entry point"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI

from src.api.router import api_router
from src.core.config import settings
from src.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Core API started on {settings.HOST}:{settings.PORT}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    yield
    logger.info("Core API shutting down")


app = FastAPI(
    title="Processa AI - Core API",
    description="Core API for profiles, billing, and content management",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)


@app.get("/")
async def root():
    return {
        "service": "processa-ai-core-api",
        "description": "Core API for profiles, billing, and content management",
        "version": app.version,
    }


@app.get("/health")
async def health():
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "status": "healthy",
        "service": "processa-ai-core-api",
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
