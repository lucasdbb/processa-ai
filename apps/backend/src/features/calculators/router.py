import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.worker_store import add_worker_job_event, create_worker_job
from src.core.auth import require_internal_auth
from src.core.calc_engine_store import (
    create_calculation,
    delete_calculation,
    list_calculations,
    mark_calculation_completed,
    mark_calculation_failed,
)
from src.core.logging import logger
from src.core.queue import enqueue_job, set_job_status
from src.features.billing.credits.service import credits_service
from src.features.calculators.schemas import (
    AposentadoriaRequest,
    AposentadoriaResponse,
    CalculationHistoryResponse,
    CalculatorResponse,
    CalculatorsListResponse,
    RescisaoTrabalhistaRequest,
    RescisaoTrabalhistaResponse,
)
from src.features.calculators.service import CalculatorsService

router = APIRouter()

service = CalculatorsService()


async def _enqueue_calculator_pdf(
    *,
    job_type: str,
    user_id: str,
    client_id: str | None,
    calculation_id: uuid.UUID,
    calculator_key: str,
    input_payload: dict,
    output_payload: dict,
) -> str:
    """Create an ai_jobs record and enqueue a calculator PDF job to Redis.

    Returns the job_id string (e.g. "calc:<uuid>").
    """
    job_uuid = uuid.uuid4()
    job_id = f"calc:{job_uuid}"

    # Set initial status in Redis
    try:
        await set_job_status(job_id, {"job_id": job_id, "status": "queued", "progress": 0})
    except Exception:
        logger.exception("Failed to persist queued status in Redis for calculator job")

    # Create job record in DB (reuse ai_jobs table)
    try:
        await create_worker_job(
            job_uuid=job_uuid,
            job_type=job_type,
            user_id=user_id,
            client_id=client_id,
            request_payload={
                "job_type": job_type,
                "calculator_key": calculator_key,
                "calculation_id": str(calculation_id),
            },
        )
        await add_worker_job_event(job_uuid=job_uuid, event_type="queued", payload={"progress": 0})
    except Exception:
        logger.exception("Failed to create calculator job in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar job de geração de PDF",
        )

    # Enqueue to Redis for worker consumption
    await enqueue_job(
        {
            "job_id": job_id,
            "job_uuid": str(job_uuid),
            "type": job_type,
            "payload": {
                "user_id": user_id,
                "client_id": client_id,
                "calculation_id": str(calculation_id),
                "calculator_key": calculator_key,
                "input_payload": input_payload,
                "output_payload": output_payload,
            },
        }
    )

    return job_id


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
    credit_result = await credits_service.consume_credits(user_id, "calculator_rescisao")
    if not credit_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Créditos insuficientes"
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
            job_id = await _enqueue_calculator_pdf(
                job_type="calculator_rescisao",
                user_id=user_id,
                client_id=client_id,
                calculation_id=calculation_id,
                calculator_key=calculator_key,
                input_payload=input_payload,
                output_payload=output_payload,
            )
            pdf = {"job_id": job_id, "status": "queued"}

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
        await credits_service.refund_credits(
            user_id, credit_result.credits_consumed, "refund_calculator_rescisao_error"
        )
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error=str(e.detail))
        except Exception:
            pass
        raise
    except Exception:
        # Reembolsar
        await credits_service.refund_credits(
            user_id, credit_result.credits_consumed, "refund_calculator_rescisao_error"
        )
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
    credit_result = await credits_service.consume_credits(user_id, "calculator_aposentadoria")
    if not credit_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Créditos insuficientes"
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
        if bool(data.export_pdf):
            job_id = await _enqueue_calculator_pdf(
                job_type="calculator_aposentadoria",
                user_id=user_id,
                client_id=client_id,
                calculation_id=calculation_id,
                calculator_key=calculator_key,
                input_payload=input_payload,
                output_payload=output_payload,
            )
            pdf = {"job_id": job_id, "status": "queued"}

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
        await credits_service.refund_credits(
            user_id, credit_result.credits_consumed, "refund_calculator_aposentadoria_error"
        )
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error=str(e.detail))
        except Exception:
            pass
        raise
    except Exception:
        # Reembolsar
        await credits_service.refund_credits(
            user_id, credit_result.credits_consumed, "refund_calculator_aposentadoria_error"
        )
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error="Erro ao calcular")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao calcular",
        )


@router.get(
    "/history",
    response_model=CalculationHistoryResponse,
    status_code=status.HTTP_200_OK,
)
async def get_calculation_history(
    user_id: str = Query(..., min_length=1, description="ID do usuário"),
    calculator_key: str | None = Query(None, description="Filtro por calculadora"),
    client_id: str | None = Query(None, description="Filtro por cliente"),
    limit: int = Query(50, ge=1, le=100),
    _internal=Depends(require_internal_auth),
):
    """Retorna histórico de cálculos do usuário."""
    calculations = await list_calculations(
        user_id=user_id,
        calculator_key=calculator_key,
        client_id=client_id,
        limit=limit,
    )
    return CalculationHistoryResponse(calculations=calculations)


@router.delete(
    "/{calculation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_calculation_endpoint(
    calculation_id: str,
    user_id: str = Query(..., min_length=1, description="ID do usuário"),
    _internal=Depends(require_internal_auth),
):
    """Deleta um cálculo e seus documentos associados."""
    try:
        calc_uuid = uuid.UUID(calculation_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="ID de cálculo inválido"
        )

    try:
        deleted = await delete_calculation(calculation_id=calc_uuid, user_id=user_id)
    except Exception:
        logger.exception("Erro ao deletar cálculo %s", calculation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao deletar cálculo",
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cálculo não encontrado",
        )
