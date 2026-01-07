"""
Main API router that aggregates all feature routers
"""

from fastapi import APIRouter

from src.features.auth.router import router as auth_router
from src.features.blog.router import router as blog_router
from src.features.newsletter.router import router as newsletter_router
from src.features.support.router import router as support_router
from src.features.users.router import router as users_router

api_router = APIRouter()

# Include feature routers
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(support_router, prefix="/support", tags=["Support"])
api_router.include_router(newsletter_router, prefix="/newsletter", tags=["Newsletter"])
api_router.include_router(blog_router, prefix="/blog", tags=["Blog"])
# api_router.include_router(calculators_router, prefix="/calculators", tags=["Calculators"])
# api_router.include_router(ai_chat_router, prefix="/chat", tags=["AI Chat"])
