"""Main API router that aggregates all feature routers"""

from fastapi import APIRouter

from src.features.subscriptions.router import router as subscriptions_router
from src.features.webhooks.router import router as webhooks_router

api_router = APIRouter()

api_router.include_router(subscriptions_router, prefix="/subscriptions", tags=["Subscriptions"])
api_router.include_router(webhooks_router, prefix="/webhooks", tags=["Webhooks"])
