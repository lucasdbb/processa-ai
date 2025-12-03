"""
Main API router that aggregates all feature routers
"""
from fastapi import APIRouter

from src.features.auth.router import router as auth_router
from src.features.users.router import router as users_router

api_router = APIRouter()

# Include feature routers
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
# api_router.include_router(blog_router, prefix="/blog", tags=["Blog"])
# api_router.include_router(calculators_router, prefix="/calculators", tags=["Calculators"])
# api_router.include_router(ai_chat_router, prefix="/chat", tags=["AI Chat"])


