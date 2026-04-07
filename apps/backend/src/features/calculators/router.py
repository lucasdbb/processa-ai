import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.auth import get_user_id, require_internal_auth
from src.core.calc_engine_store import (
    create_calculation,
    delete_calculation,
    get_calculation_by_id,
    get_calculation_document,
    list_calculations,
    mark_calculation_completed,
    mark_calculation_failed,
)
from src.core.job_store import add_job_event, create_document, create_job, get_active_calculator_job
from src.core.logging import logger
from src.features.billing.credits.service import credits_service
from src.features.calculators.schemas import (
    AposentadoriaRequest,
    AposentadoriaResponse,
    CalculationHistoryResponse,
    FatorPrevidenciarioRequest,
    FatorPrevidenciarioResponse,
    MediaSalarialRequest,
    MediaSalarialResponse,
    ParseCnisRequest,
    ParseCnisResponse,
    PdfExport,
    RescisaoTrabalhistaRequest,
    RescisaoTrabalhistaResponse,
    TempoContribuicaoRequest,
    TempoContribuicaoResponse,
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
    target_bucket: str | None = None,
    target_storage_path: str | None = None,
) -> str:
    """Create a job in the unified jobs table for calculator PDF generation.

    Returns the job_id string (plain UUID).
    """
    job_uuid = uuid.uuid4()
    job_id = str(job_uuid)

    # Create job record in unified jobs table (this IS the enqueue)
    try:
        request_payload = {
            "job_type": job_type,
            "calculator_key": calculator_key,
            "calculation_id": str(calculation_id),
            "user_id": user_id,
            "client_id": client_id,
            "input_payload": input_payload,
            "output_payload": output_payload,
        }

        if target_bucket and target_storage_path:
            request_payload["target_bucket"] = target_bucket
            request_payload["target_storage_path"] = target_storage_path

        await create_job(
            job_uuid=job_uuid,
            job_type=job_type,
            user_id=user_id,
            client_id=client_id,
            request_payload=request_payload,
            priority=8,
        )
        await add_job_event(job_uuid=job_uuid, event_type="queued", payload={"progress": 0})
    except Exception:
        logger.exception("Failed to create calculator job in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar job de geração de PDF",
        )

    return job_id


@router.post(
    "/trabalhista/rescisao-trabalhista",
    response_model=RescisaoTrabalhistaResponse,
    status_code=status.HTTP_200_OK,
)
async def rescisao_trabalhista(
    data: RescisaoTrabalhistaRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    client_id = (data.client_id or "").strip() or None

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
            tipo_aviso_previo=str(data.tipo_aviso_previo),
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
    "/trabalhista/rescisao-trabalhista/{calculation_id}/pdf",
    response_model=PdfExport,
    status_code=status.HTTP_200_OK,
)
async def generate_rescisao_pdf(
    calculation_id: str,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    try:
        calc_uuid = uuid.UUID(calculation_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de cálculo inválido",
        )

    calc = await get_calculation_by_id(calculation_id=calc_uuid, user_id=user_id)
    if not calc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cálculo não encontrado",
        )

    if calc.get("calculator_key") != "trabalhista.rescisao-trabalhista":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cálculo incompatível para geração de PDF de rescisão",
        )

    input_payload = calc.get("input_payload") or {}
    output_payload = calc.get("output_payload") or {}
    if not isinstance(output_payload, dict) or not output_payload.get("detalhes"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cálculo ainda não concluído para geração de PDF",
        )

    active_job = await get_active_calculator_job(
        user_id=user_id,
        job_type="calculator_rescisao",
        calculation_id=calc_uuid,
    )
    if active_job:
        return {
            "job_id": active_job["job_id"],
            "status": active_job["status"],
        }

    existing_document = await get_calculation_document(calculation_id=calc_uuid, user_id=user_id)

    client_id = calc.get("client_id")
    job_id = await _enqueue_calculator_pdf(
        job_type="calculator_rescisao",
        user_id=user_id,
        client_id=str(client_id).strip() if client_id else None,
        calculation_id=calc_uuid,
        calculator_key="trabalhista.rescisao-trabalhista",
        input_payload=input_payload if isinstance(input_payload, dict) else {},
        output_payload=output_payload,
        target_bucket=(
            str(existing_document.get("bucket")).strip()
            if isinstance(existing_document, dict) and existing_document.get("bucket")
            else None
        ),
        target_storage_path=(
            str(existing_document.get("storage_path")).strip()
            if isinstance(existing_document, dict) and existing_document.get("storage_path")
            else None
        ),
    )

    return {"job_id": job_id, "status": "queued"}


# ---------------------------------------------------------------------------
# Calculadoras Previdenciárias
# ---------------------------------------------------------------------------


async def _enqueue_previdencia_job(
    *,
    job_type: str,
    user_id: str,
    client_id: str | None,
    calculation_id: uuid.UUID,
    calculator_key: str,
    request_payload: dict,
) -> str:
    """Enfileira um job previdenciário no worker (cálculo + PDF).

    Returns the job_id string (plain UUID).
    """
    job_uuid = uuid.uuid4()
    job_id = str(job_uuid)

    try:
        await create_job(
            job_uuid=job_uuid,
            job_type=job_type,
            user_id=user_id,
            client_id=client_id,
            request_payload={
                "job_type": job_type,
                "calculator_key": calculator_key,
                "calculation_id": str(calculation_id),
                "user_id": user_id,
                "client_id": client_id,
                **request_payload,
            },
            priority=8,
        )
        await add_job_event(job_uuid=job_uuid, event_type="queued", payload={"progress": 0})
    except Exception:
        logger.exception("Failed to create previdencia job in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar job de cálculo",
        )

    return job_id


@router.post(
    "/previdencia/parse-cnis",
    response_model=ParseCnisResponse,
    status_code=status.HTTP_200_OK,
)
async def parse_cnis(
    data: ParseCnisRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Envia CNIS PDF para extração estruturada via Gemini no worker."""
    credit_result = await credits_service.consume_credits(user_id, "parse_cnis")
    if not credit_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Créditos insuficientes",
        )

    job_uuid = uuid.uuid4()
    job_id = str(job_uuid)

    try:
        await create_job(
            job_uuid=job_uuid,
            job_type="parse_cnis",
            user_id=user_id,
            client_id=None,
            request_payload={
                "file_url": data.file_url,
                "bucket": data.bucket,
                "storage_path": data.storage_path,
                "user_id": user_id,
            },
            priority=8,
        )
        await add_job_event(job_uuid=job_uuid, event_type="queued", payload={"progress": 0})
    except Exception:
        logger.exception("Failed to create parse_cnis job")
        await credits_service.refund_credits(
            user_id, credit_result.credits_consumed, "refund_parse_cnis_error"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar job de parsing do CNIS",
        )

    # Registrar o arquivo de input em generated_documents para lifecycle tracking
    if data.bucket and data.storage_path:
        filename = (
            data.storage_path.rsplit("/", 1)[-1] if "/" in data.storage_path else data.storage_path
        )
        try:
            await create_document(
                job_uuid=job_uuid,
                user_id=user_id,
                client_id=None,
                document_type="input",
                bucket=data.bucket,
                storage_path=data.storage_path,
                filename=filename,
                checksum_sha256=None,
                size_bytes=None,
                metadata={"endpoint": "parse_cnis"},
                source="calculator",
            )
        except Exception:
            logger.warning(
                "Failed to register CNIS input in generated_documents — lifecycle tracking skipped"
            )

    return {"job_id": job_id, "status": "queued"}


@router.post(
    "/previdencia/tempo-contribuicao",
    response_model=TempoContribuicaoResponse,
    status_code=status.HTTP_200_OK,
)
async def calcular_tempo_contribuicao(
    data: TempoContribuicaoRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Calculadora de Tempo de Contribuição."""
    client_id = (data.client_id or "").strip() or None
    calculation_id = uuid.uuid4()
    calculator_key = "previdencia.tempo-contribuicao"

    credit_result = await credits_service.consume_credits(user_id, "calculator_tempo_contribuicao")
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
        job_id = await _enqueue_previdencia_job(
            job_type="calculator_tempo_contribuicao",
            user_id=user_id,
            client_id=client_id,
            calculation_id=calculation_id,
            calculator_key=calculator_key,
            request_payload=input_payload,
        )

        return {
            "calculation_id": str(calculation_id),
            "calculator_key": calculator_key,
            "input": input_payload,
            "detalhes": {
                "anos": 0,
                "meses": 0,
                "dias": 0,
                "total_dias": 0,
                "vinculos_processados": 0,
                "alertas": [],
            },
            "pdf": {"job_id": job_id, "status": "queued"} if data.export_pdf else None,
        }
    except Exception:
        await credits_service.refund_credits(
            user_id, credit_result.credits_consumed, "refund_calculator_tempo_error"
        )
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error="Erro ao calcular")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro ao calcular"
        )


@router.post(
    "/previdencia/media-salarial",
    response_model=MediaSalarialResponse,
    status_code=status.HTTP_200_OK,
)
async def calcular_media_salarial(
    data: MediaSalarialRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Calculadora de Média Salarial."""
    client_id = (data.client_id or "").strip() or None
    calculation_id = uuid.uuid4()
    calculator_key = "previdencia.media-salarial"

    credit_result = await credits_service.consume_credits(user_id, "calculator_media_salarial")
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
        await _enqueue_previdencia_job(
            job_type="calculator_media_salarial",
            user_id=user_id,
            client_id=client_id,
            calculation_id=calculation_id,
            calculator_key=calculator_key,
            request_payload=input_payload,
        )

        return {
            "calculation_id": str(calculation_id),
            "calculator_key": calculator_key,
            "input": input_payload,
            "detalhes": {
                "media_100": 0,
                "media_80": 0,
                "qtd_contribuicoes": 0,
                "maior_contribuicao": 0,
                "menor_contribuicao": 0,
            },
            "pdf": None,
        }
    except Exception:
        await credits_service.refund_credits(
            user_id, credit_result.credits_consumed, "refund_calculator_media_error"
        )
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error="Erro ao calcular")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro ao calcular"
        )


@router.post(
    "/previdencia/fator-previdenciario",
    response_model=FatorPrevidenciarioResponse,
    status_code=status.HTTP_200_OK,
)
async def calcular_fator_previdenciario_endpoint(
    data: FatorPrevidenciarioRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Calculadora de Fator Previdenciário (gratuita, síncrona)."""
    from src.core.db import get_pool

    # Buscar expectativa de sobrevida da tábua IBGE
    pool = await get_pool()
    async with pool.connection() as conn:
        row = await conn.execute(
            """
            SELECT expectativa_sobrevida FROM calc_engine.tabua_mortalidade
            WHERE idade = %s
            ORDER BY ano_referencia DESC LIMIT 1
            """,
            (int(data.idade),),
        )
        result = await row.fetchone()

    es = float(result[0]) if result else 20.0  # fallback

    # Calcular fator (fórmula simples, sem créditos)
    a = 0.31
    tc = data.tempo_contribuicao_anos
    if data.sexo == "F":
        tc += 5

    if es > 0:
        fator = (tc * a / es) * (1 + (data.idade + tc * a) / 100)
    else:
        fator = 1.0

    fator = round(fator, 4)
    formula = (
        f"({tc:.1f} × {a} / {es:.1f}) × "
        f"[1 + ({data.idade:.1f} + {tc:.1f} × {a}) / 100] = {fator:.4f}"
    )

    return {"fator": fator, "formula_detalhada": formula}


@router.post(
    "/previdencia/aposentadoria-simulacao",
    response_model=AposentadoriaResponse,
    status_code=status.HTTP_200_OK,
)
async def simular_aposentadoria(
    data: AposentadoriaRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Simulação completa de aposentadoria (6 cenários EC 103/2019)."""
    client_id = (data.client_id or "").strip() or None
    calculation_id = uuid.uuid4()
    calculator_key = "previdencia.aposentadoria-simulacao"

    # Custo único para a simulação completa
    feature_key = "calculator_aposentadoria_simulacao"

    credit_result = await credits_service.consume_credits(user_id, feature_key)
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
        job_id = await _enqueue_previdencia_job(
            job_type="calculator_aposentadoria_simulacao",
            user_id=user_id,
            client_id=client_id,
            calculation_id=calculation_id,
            calculator_key=calculator_key,
            request_payload=input_payload,
        )

        return {
            "calculation_id": str(calculation_id),
            "calculator_key": calculator_key,
            "input": input_payload,
            "detalhes": {
                "tempo_contribuicao": {
                    "anos": 0,
                    "meses": 0,
                    "dias": 0,
                    "total_dias": 0,
                    "vinculos_processados": 0,
                    "alertas": [],
                },
                "media_salarial": None,
                "cenarios": [],
                "melhor_cenario": None,
                "alertas": [],
            },
            "pdf": {"job_id": job_id, "status": "queued"} if data.export_pdf else None,
        }
    except Exception:
        await credits_service.refund_credits(
            user_id,
            credit_result.credits_consumed,
            "refund_calculator_aposentadoria_simulacao_error",
        )
        try:
            await mark_calculation_failed(calculation_id=calculation_id, error="Erro ao calcular")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro ao calcular"
        )


@router.get(
    "/history",
    response_model=CalculationHistoryResponse,
    status_code=status.HTTP_200_OK,
)
async def get_calculation_history(
    user_id: str = Depends(get_user_id),
    calculator_key: str | None = None,
    client_id: str | None = None,
    limit: int = 50,
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
    user_id: str = Depends(get_user_id),
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
