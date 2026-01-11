from fastapi import APIRouter, Depends, status
from starlette.responses import RedirectResponse

from src.core.dependencies import get_current_user
from src.features.materials.schemas import MaterialListItem
from src.features.materials.service import MaterialsService

router = APIRouter()
service = MaterialsService()


@router.get("/list", response_model=list[MaterialListItem], status_code=status.HTTP_200_OK)
async def list_materials(_user=Depends(get_current_user)):
    return await service.list_materials()


@router.get("/{slug}/download", status_code=status.HTTP_302_FOUND)
async def download_material(slug: str, _user=Depends(get_current_user)):
    url = await service.get_download_redirect_url(slug)
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)
