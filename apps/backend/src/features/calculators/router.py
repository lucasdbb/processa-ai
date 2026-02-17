import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.calc_engine_store import (
    create_calculation,
    create_document,
    mark_calculation_completed,
    mark_calculation_failed,
)
from src.core.auth import require_internal_auth
from src.features.calculators.schemas import (
    CalculatorResponse,
    CalculatorsListResponse,
    RescisaoTrabalhistaRequest,
    RescisaoTrabalhistaResponse,
    AposentadoriaRequest,
    AposentadoriaResponse,
)
from src.features.calculators.service import CalculatorsService
from src.features.billing.credits.service import credits_service

router = APIRouter()

service = CalculatorsService()


@router.get("/list", response_model=CalculatorsListResponse)
async def get_calculators(_internal=Depends(require_internal_auth)):
    """Retorna lista de calculadoras disponíveis."""
    from src.core.db import get_pool

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT key, display_name, description, icon, path,
                       display_order, is_locked
                FROM public.calculators
                ORDER BY display_order, display_name
            """
            )
            rows = await cur.fetchall()

    calculators = []
    for row in rows:
        calculators.append(
            CalculatorResponse(
                slug=row[0],
                name=row[1],
                description=row[2] or "",
                icon=row[3] or "Calculator",
                path=row[4],
                locked=bool(row[6]),
                order=int(row[5]) if row[5] is not None else 0,
            )
        )

    return CalculatorsListResponse(calculators=calculators)


@router.post(
    "/trabalhista/rescisao-trabalhista",
    response_model=RescisaoTrabalhistaResponse,
    status_code=status.HTTP_200_OK,
)
async def rescisao_trabalhista(
    data: RescisaoTrabalhistaRequest,
    _internal=Depends(require_internal_auth),
):
    user_id = (data.user_id or "").strip()
    client_id = (data.client_id or "").strip() or None
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório")

    calculation_id = uuid.uuid4()
    calculator_key = "trabalhista.rescisao-trabalhista"

    # Consumir créditos
    credit_result = await credits_service.consume_credits(user_id, 'calculator_rescisao')
    if not credit_result.success:
         raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Créditos insuficientes"
        )

    input_payload = data.model_dump(mode="json")
    try:
        await create_calculation(
            calculation_id=calculation_id,
            calculator_key=calculator_key,
            user_id=user_id,
            client_id=client_id,
            input_payload=input_payload,
        )
    except Exception:
        pass

    try:
        output_payload = service.calculate_rescisao_trabalhista(
            salario_base=data.salario_base,
            adicional_periculosidade=data.adicional_periculosidade,
            adicional_insalubridade_grau=data.adicional_insalubridade_grau,
            base_insalubridade=data.base_insalubridade,
            adicional_noturno_percent=data.adicional_noturno_percent,
            media_horas_noturnas=data.media_horas_noturnas,
            outras_verbas=data.outras_verbas,
            data_admissao=data.data_admissao,
            data_rescisao=data.data_rescisao,
            tipo_rescisao=data.tipo_rescisao,
            aviso_previo=bool(data.aviso_previo),
            ferias_vencidas=int(data.ferias_vencidas or 0),
            ferias_proporcionais=bool(data.ferias_proporcionais),
            decimo_terceiro=bool(data.decimo_terceiro),
        )

        pdf = None
        if bool(data.export_pdf):
            stored = await service.export_rescisao_pdf(
                input_payload=input_payload,
                output_payload=output_payload,
                user_id=user_id,
                client_id=client_id,
                calculation_id=str(calculation_id),
                expires_in=int(data.signed_url_expires_in),
            )

            try:
                doc_id = await create_document(
                    calculation_id=calculation_id,
                    user_id=user_id,
                    client_id=client_id,
                    document_type="rescisao_trabalhista_pdf",
                    bucket=str(stored.get("bucket")),
                    storage_path=str(stored.get("storage_path")),
                    filename=f"rescisao-trabalhista_{calculation_id}.pdf",
                    content_bytes=bytes(stored.get("content") or b""),
                    metadata={"calculator_key": calculator_key},
                )
            except Exception:
                doc_id = None

            pdf = {
                "download_url": stored.get("download_url"),
                "bucket": stored.get("bucket"),
                "storage_path": stored.get("storage_path"),
                "document_id": (str(doc_id) if doc_id else None),
                "expires_in": int(data.signed_url_expires_in),
            }

        try:
            await mark_calculation_completed(
                calculation_id=calculation_id,
                output_payload=output_payload,
            )
        except Exception:
            pass

        return {
            "calculation_id": str(calculation_id),
            "calculator_key": calculator_key,
            "input": input_payload,
            "detalhes": output_payload.get("detalhes") or {},
            "pdf": pdf,
        }
    except HTTPException as e:
        # Reembolsar
        await credits_service.refund_credits(user_id, credit_result.credits_consumed, "refund_calculator_rescisao_error")
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error=str(e.detail))
        except Exception:
            pass
        raise
    except Exception:
        # Reembolsar
        await credits_service.refund_credits(user_id, credit_result.credits_consumed, "refund_calculator_rescisao_error")
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error="Erro ao calcular")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao calcular",
        )


@router.post(
    "/previdencia/aposentadoria",
    response_model=AposentadoriaResponse,
    status_code=status.HTTP_200_OK,
)
async def calcular_aposentadoria(
    data: AposentadoriaRequest,
    _internal=Depends(require_internal_auth),
):
    user_id = (data.user_id or "").strip()
    client_id = (data.client_id or "").strip() or None
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório")

    calculation_id = uuid.uuid4()
    calculator_key = "previdencia.aposentadoria"

    # Consumir créditos
    credit_result = await credits_service.consume_credits(user_id, 'calculator_aposentadoria')
    if not credit_result.success:
         raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Créditos insuficientes"
        )

    input_payload = data.model_dump(mode="json")
    try:
        await create_calculation(
            calculation_id=calculation_id,
            calculator_key=calculator_key,
            user_id=user_id,
            client_id=client_id,
            input_payload=input_payload,
        )
    except Exception:
        pass

    try:
        output_payload = service.calculate_aposentadoria(
            sexo=data.sexo,
            tipo_aposentadoria=data.tipo_aposentadoria,
            idade=data.idade,
            tempo_contribuicao=data.tempo_contribuicao,
            salario_contribuicao=data.salario_contribuicao,
        )

        pdf = None
        # PDF é opcional por enquanto, mas se o usuário pedir (ou se for padrão da feature paga), geramos
        # Vamos assumir que sempre gera se export_pdf=True, assim como na rescisão
        if bool(data.export_pdf):
            stored = await service.export_aposentadoria_pdf(
                input_payload=input_payload,
                output_payload=output_payload,
                user_id=user_id,
                client_id=client_id,
                calculation_id=str(calculation_id),
                expires_in=int(data.signed_url_expires_in),
            )

            try:
                doc_id = await create_document(
                    calculation_id=calculation_id,
                    user_id=user_id,
                    client_id=client_id,
                    document_type="simulacao_aposentadoria_pdf",
                    bucket=str(stored.get("bucket")),
                    storage_path=str(stored.get("storage_path")),
                    filename=f"simulacao-aposentadoria_{calculation_id}.pdf",
                    content_bytes=bytes(stored.get("content") or b""),
                    metadata={"calculator_key": calculator_key},
                )
            except Exception:
                doc_id = None

            pdf = {
                "download_url": stored.get("download_url"),
                "bucket": stored.get("bucket"),
                "storage_path": stored.get("storage_path"),
                "document_id": (str(doc_id) if doc_id else None),
                "expires_in": int(data.signed_url_expires_in),
            }

        try:
            await mark_calculation_completed(
                calculation_id=calculation_id,
                output_payload=output_payload,
            )
        except Exception:
            pass

        return {
            "calculation_id": str(calculation_id),
            "calculator_key": calculator_key,
            "input": input_payload,
            "detalhes": output_payload.get("detalhes") or {},
            "pdf": pdf,
        }
    except HTTPException as e:
        # Reembolsar
        await credits_service.refund_credits(user_id, credit_result.credits_consumed, "refund_calculator_aposentadoria_error")
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error=str(e.detail))
        except Exception:
            pass
        raise
    except Exception:
        # Reembolsar
        await credits_service.refund_credits(user_id, credit_result.credits_consumed, "refund_calculator_aposentadoria_error")
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error="Erro ao calcular")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao calcular",
        )
