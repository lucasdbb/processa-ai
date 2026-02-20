from uuid import uuid4

from fastapi import APIRouter, Depends, status

from src.core.auth import require_internal_auth
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
    _internal=Depends(require_internal_auth),
):
    """
    Gera URL assinada para upload direto.
    Retorna upload_url (PUT) e storage_path.
    """
    service = StorageService()
    # Gerar UUID aqui se não vier no request (embora o service também gere)
    # Mas para consistência, vamos passar.
    job_uuid = str(uuid4())
    
    result = await service.create_upload_signed_url(
        filename=data.filename,
        user_id=data.user_id,
        functionality=data.functionality,
        client_id=data.client_id,
        job_uuid=job_uuid,
        expires_in=data.expires_in,
    )
    
    return UploadUrlResponse(**result)
