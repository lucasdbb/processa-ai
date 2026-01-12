from fastapi import APIRouter, status

from src.features.plans.schemas import BillingPlanPublic
from src.features.plans.service import PlansService

router = APIRouter()
service = PlansService()


@router.get("/", response_model=list[BillingPlanPublic], status_code=status.HTTP_200_OK)
async def list_public_plans():
    return await service.list_public_plans()
