from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from src.core.dependencies import get_current_user
from src.features.ai.schemas import AiToolResponse, CnisAnalysisResponse
from src.features.ai.service import AiService

router = APIRouter()
service = AiService()


@router.post("/cnis-analysis", response_model=CnisAnalysisResponse, status_code=status.HTTP_200_OK)
async def cnis_analysis(
    file: UploadFile = File(...),
    _user=Depends(get_current_user),
):
    is_pdf = file.content_type == "application/pdf" or (file.filename or "").lower().endswith(
        ".pdf"
    )
    if not is_pdf:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo PDF")

    text = await service.analyze_cnis(file)
    return CnisAnalysisResponse(text=text)


@router.get("/tools", response_model=list[AiToolResponse], status_code=status.HTTP_200_OK)
async def list_ai_tools(
    _user=Depends(get_current_user),
):
    return await service.list_tools()
