from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from starlette.responses import RedirectResponse

from src.core.dependencies import get_current_admin, get_current_user
from src.features.materials.schemas import MaterialAdminListItem, MaterialListItem
from src.features.materials.service import MaterialsService

router = APIRouter()
service = MaterialsService()


@router.get("/list", response_model=list[MaterialListItem], status_code=status.HTTP_200_OK)
async def list_materials(_user=Depends(get_current_user)):
    return await service.list_materials()


@router.get(
    "/admin/list",
    response_model=list[MaterialAdminListItem],
    status_code=status.HTTP_200_OK,
)
async def list_admin_materials(_admin=Depends(get_current_admin)):
    return await service.list_admin_materials()


@router.post(
    "/admin",
    response_model=MaterialAdminListItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_material(
    title: str = Form(...),
    group: str = Form(...),
    file: UploadFile = File(...),
    slug: str | None = Form(None),
    description: str | None = Form(None),
    is_published: bool = Form(True),
    mime_type: str | None = Form(None),
    _admin=Depends(get_current_admin),
):
    file_bytes = await file.read()
    return await service.create_material(
        title=title,
        group=group,
        file_bytes=file_bytes,
        original_filename=file.filename or "",
        slug=slug,
        description=description,
        is_published=is_published,
        mime_type=mime_type,
    )


@router.patch(
    "/admin/{material_id}",
    response_model=MaterialAdminListItem,
    status_code=status.HTTP_200_OK,
)
async def update_material(
    material_id: str,
    title: str | None = Form(None),
    group: str | None = Form(None),
    slug: str | None = Form(None),
    description: str | None = Form(None),
    is_published: bool | None = Form(None),
    mime_type: str | None = Form(None),
    file: UploadFile | None = File(None),
    _admin=Depends(get_current_admin),
):
    file_bytes: bytes | None = None
    original_filename: str | None = None
    if file is not None:
        file_bytes = await file.read()
        original_filename = file.filename or ""
    return await service.update_material(
        material_id,
        title=title,
        slug=slug,
        description=description,
        group=group,
        is_published=is_published,
        mime_type=mime_type,
        file_bytes=file_bytes,
        original_filename=original_filename,
    )


@router.delete("/admin/{material_id}", status_code=status.HTTP_200_OK)
async def delete_material(material_id: str, _admin=Depends(get_current_admin)):
    return await service.delete_material(material_id)


@router.get("/{slug}/download", status_code=status.HTTP_302_FOUND)
async def download_material(slug: str, _user=Depends(get_current_user)):
    url = await service.get_download_redirect_url(slug)
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)
