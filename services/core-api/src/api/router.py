"""Main API router that aggregates all feature routers"""

from fastapi import APIRouter

from src.features.blog.router import router as blog_router
from src.features.materials.router import router as materials_router
from src.features.newsletter.router import router as newsletter_router
from src.features.plans.router import router as plans_router
from src.features.profiles.router import router as profiles_router
from src.features.support.router import router as support_router

api_router = APIRouter()

api_router.include_router(profiles_router, prefix="/profiles", tags=["Profiles"])
api_router.include_router(blog_router, prefix="/blog", tags=["Blog"])
api_router.include_router(newsletter_router, prefix="/newsletter", tags=["Newsletter"])
api_router.include_router(support_router, prefix="/support", tags=["Support"])
api_router.include_router(materials_router, prefix="/materials", tags=["Materials"])
api_router.include_router(plans_router, prefix="/plans", tags=["Plans"])
