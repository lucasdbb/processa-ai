"""Main FastAPI application"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.core.logging import logger
from src.features.ai.router import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"API Gateway started on {settings.HOST}:{settings.PORT}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"AI Worker: {settings.AI_WORKER_BASE_URL}")
    yield
    # Shutdown
    logger.info("API Gateway shutting down")


app = FastAPI(
    title="Processa AI - API Gateway",
    description="API Gateway for Processa AI microservices",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "service": "api-gateway"}


# Include routers
app.include_router(ai_router, prefix="/api/ai", tags=["AI"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development"),
    )
