"""Main FastAPI application"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.core.logging import logger
from src.features.ai.router import router as ai_router
from src.features.billing.router import router as billing_router
from src.features.calculators.router import router as calculators_router
from src.features.core.router import router as core_router
from src.features.office.router import router as office_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"API Gateway started on {settings.HOST}:{settings.PORT}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Core API: {settings.CORE_API_BASE_URL}")
    logger.info(f"AI Worker: {settings.AI_WORKER_BASE_URL}")
    logger.info(f"Calc Engine: {settings.CALC_ENGINE_BASE_URL}")
    logger.info(f"Office API: {settings.OFFICE_API_BASE_URL}")
    logger.info(f"Billing API: {settings.BILLING_API_BASE_URL}")
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
app.include_router(core_router, prefix="/api", tags=["Core"])
app.include_router(ai_router, prefix="/api/ai", tags=["AI"])
app.include_router(calculators_router, prefix="/api/calculators", tags=["Calculators"])
app.include_router(office_router, prefix="/api/office", tags=["Office"])
app.include_router(billing_router, prefix="/api/billing", tags=["Billing"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development"),
    )
