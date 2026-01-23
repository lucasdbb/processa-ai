from fastapi import APIRouter

from src.features.calculators.router import router as calculators_router

api_router = APIRouter()

api_router.include_router(calculators_router, tags=["Calculators"])
