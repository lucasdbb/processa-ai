from uuid import uuid4

from fastapi import APIRouter, Depends, status

from src.core.auth import get_user_id, require_internal_auth
from src.features.core.storage.schemas import UploadUrlRequest, UploadUrlResponse
from src.features.core.storage.service import StorageService

router = APIRouter()


@router.post(
    "/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_upload_signed_url(
    data: UploadUrlRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """
    Gera URL assinada para upload direto.
    Retorna upload_url (PUT) e storage_path.
    """
    service = StorageService()
    job_uuid = str(uuid4())

    result = await service.create_upload_signed_url(
        filename=data.filename,
        user_id=user_id,
        functionality=data.functionality,
        client_id=data.client_id,
        job_uuid=job_uuid,
        expires_in=data.expires_in,
    )

    return UploadUrlResponse(**result)
