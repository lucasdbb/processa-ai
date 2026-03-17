import uuid
from uuid import uuid4

from fastapi import HTTPException, status

from src.core.ai_worker_store import (
    add_job_event,
    create_document,
    create_job,
    mark_job_failed,
    update_job_payload,
)
from src.core.logging import logger
from src.core.queue import enqueue_job
from src.features.billing.credits.service import CreditsService
from src.features.core.storage.service import StorageService


class AiJobService:
    def __init__(self):
        self.credits_service = CreditsService()
        self.storage_service = StorageService()

    async def submit_job(
        self,
        *,
        user_id: str,
        feature_key: str,
        endpoint_key: str,
        initial_payload: dict,
        files: list[dict],  # [{bucket, storage_path, file_url, filename}]
        client_id: str | None = None,
        job_uuid: uuid.UUID | None = None,
        signed_url_expires_in: int = 600,
        store_pdf: bool = True,
    ) -> str:
        """
        Submete um job de IA: consome créditos, cria job, processa arquivos, enfileira.
        """
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório"
            )

        # 1. Consumir créditos
        credit_result = await self.credits_service.consume_credits(user_id, feature_key)
        if not credit_result.success:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Créditos insuficientes para {feature_key}.",
            )

        # 2. Preparar Job UUID
        if not job_uuid:
            job_uuid = uuid4()
        job_id = f"ai:{job_uuid}"

        # 3. Payload base
        base_payload = {
            "job_id": job_id,
            "user_id": user_id,
            "client_id": client_id,
            "store_pdf": store_pdf,
            "signed_url_expires_in": signed_url_expires_in,
            "files": [],  # Será preenchido depois
            "input_document_id": None,  # Será preenchido depois
            **initial_payload,  # Merge com payload específico (ex: prompt)
        }

        # Garantir que chaves críticas não foram sobrescritas incorretamente
        base_payload["job_id"] = job_id
        base_payload["user_id"] = user_id

        # 5. Criar Job no Banco
        try:
            await create_job(
                status="queued",
                job_uuid=job_uuid,
                endpoint_key=endpoint_key,
                user_id=user_id,
                client_id=client_id,
                request_payload=base_payload,
            )
            await add_job_event(
                job_uuid=job_uuid,
                event_type="queued",
                payload={"progress": 0},
            )
        except Exception:
            # Se falhar ao criar no banco, devolvemos os créditos
            await self.credits_service.refund_credits(
                user_id, credit_result.credits_consumed, "refund_create_job_error"
            )
            logger.exception("Failed to persist job in database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao criar job no banco de dados",
            )

        # 6. Processar Arquivos (Input Documents)
        processed_files = []
        input_document_id = None

        try:
            for f in files:
                bucket = f.get("bucket")
                spath = f.get("storage_path")
                furl = f.get("file_url")
                fname = f.get("filename")

                # Inferir nome do arquivo
                if not fname and spath:
                    fname = spath.rsplit("/", 1)[-1]
                if not fname:
                    fname = "documento.pdf"

                # Criar registro de documento de input
                if bucket and spath:
                    try:
                        doc_id = await create_document(
                            job_uuid=job_uuid,
                            user_id=user_id,
                            client_id=client_id,
                            document_type="input",
                            bucket=bucket,
                            storage_path=spath,
                            filename=fname,
                            checksum_sha256=None,
                            size_bytes=None,
                            metadata={"endpoint": endpoint_key},
                        )
                        if doc_id and input_document_id is None:
                            input_document_id = str(doc_id)
                    except Exception:
                        logger.exception("Failed to create input document record")

                # Gerar URL assinada para o worker
                if bucket and spath and not furl:
                    try:
                        signed_url = await self.storage_service.generate_signed_url(
                            bucket=bucket, storage_path=spath, expires_in=signed_url_expires_in
                        )
                        processed_files.append(
                            {
                                "file_url": signed_url,
                                "bucket": bucket,
                                "storage_path": spath,
                                "filename": fname,
                            }
                        )
                    except Exception:
                        logger.exception("Failed to generate signed URL for worker")
                        raise HTTPException(
                            status_code=500, detail="Erro ao preparar arquivos para processamento"
                        )
                elif furl:
                    processed_files.append(
                        {
                            "file_url": furl,
                            "bucket": bucket,
                            "storage_path": spath,
                            "filename": fname,
                        }
                    )

            # 7. Atualizar Payload com Arquivos Processados
            final_payload = {
                **base_payload,
                "files": processed_files,
                "input_document_id": input_document_id,
            }

            await update_job_payload(job_uuid=job_uuid, request_payload=final_payload)

            # 8. Enfileirar Job (Worker)
            await enqueue_job(
                {
                    "job_id": job_id,
                    "job_uuid": str(job_uuid),
                    "type": endpoint_key,
                    "payload": final_payload,
                }
            )

        except Exception as e:
            logger.exception("Error during job processing setup")
            # Tentar falhar o job no banco
            try:
                await mark_job_failed(job_uuid=job_uuid, error=str(e))
            except Exception:
                pass

            # Reembolsar créditos se falhou antes de enfileirar com sucesso
            await self.credits_service.refund_credits(
                user_id, credit_result.credits_consumed, "refund_job_setup_error"
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao processar arquivos e enfileirar job",
            )

        return job_id
