from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from src.core.dependencies import get_current_user
from src.features.ai.schemas import (
    AiToolResponse,
    ChatRequest,
    ChatResponse,
    CnisAnalysisResponse,
    MarkdownToPdfRequest,
    SignedPdfResponse,
)
from src.features.ai.service import AiService

router = APIRouter()
service = AiService()


@router.post("/cnis-analysis", response_model=CnisAnalysisResponse, status_code=status.HTTP_200_OK)
async def cnis_analysis(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    is_pdf = file.content_type == "application/pdf" or (file.filename or "").lower().endswith(
        ".pdf"
    )
    if not is_pdf:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo PDF")

    text = await service.analyze_cnis(file, user_id=str(user.id))
    return CnisAnalysisResponse(text=text)


@router.post("/cnis-analysis/pdf", response_model=SignedPdfResponse, status_code=status.HTTP_200_OK)
async def cnis_analysis_pdf(data: MarkdownToPdfRequest, user=Depends(get_current_user)):
    result = service.markdown_to_signed_pdf(
        markdown=data.markdown,
        user_id=str(user.id),
        pipeline_name="cnis-analysis",
        title=data.filename or "cnis-analise",
    )
    return SignedPdfResponse(**result)


@router.get("/tools", response_model=list[AiToolResponse], status_code=status.HTTP_200_OK)
async def list_ai_tools(
    _user=Depends(get_current_user),
):
    return await service.list_tools()


@router.post("/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat_with_assistant(data: ChatRequest, user=Depends(get_current_user)):
    text = await service.chat_openai_assistant(message=data.message, user_id=str(user.id))
    return ChatResponse(response=text)
