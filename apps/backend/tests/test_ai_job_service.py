from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from src.features.ai.service import AiJobService


def _credit_result(success: bool, consumed: int = 0, remaining: int = 0):
    return SimpleNamespace(success=success, credits_consumed=consumed, remaining=remaining)


@pytest.mark.asyncio
async def test_submit_job_missing_user_id_returns_400():
    service = AiJobService()

    with pytest.raises(HTTPException) as exc:
        await service.submit_job(
            user_id="",
            feature_key="brief_scanner",
            endpoint_key="brief_scanner",
            initial_payload={},
            files=[],
        )

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_submit_job_insufficient_credits_returns_402():
    with patch("src.features.ai.service.CreditsService") as credits_cls, patch(
        "src.features.ai.service.StorageService"
    ):
        credits = MagicMock()
        credits.consume_credits = AsyncMock(return_value=_credit_result(False))
        credits_cls.return_value = credits
        service = AiJobService()

    with pytest.raises(HTTPException) as exc:
        await service.submit_job(
            user_id="user-1",
            feature_key="brief_scanner",
            endpoint_key="brief_scanner",
            initial_payload={},
            files=[],
        )

    assert exc.value.status_code == 402


@pytest.mark.asyncio
async def test_submit_job_create_job_failure_refunds_credits():
    with patch("src.features.ai.service.CreditsService") as credits_cls, patch(
        "src.features.ai.service.StorageService"
    ):
        credits = MagicMock()
        credits.consume_credits = AsyncMock(return_value=_credit_result(True, consumed=3, remaining=10))
        credits.refund_credits = AsyncMock()
        credits_cls.return_value = credits
        service = AiJobService()

    with patch("src.features.ai.service.create_job", new=AsyncMock(side_effect=Exception("db error"))), patch(
        "src.features.ai.service.add_job_event", new=AsyncMock()
    ):
        with pytest.raises(HTTPException) as exc:
            await service.submit_job(
                user_id="user-1",
                feature_key="brief_scanner",
                endpoint_key="brief_scanner",
                initial_payload={},
                files=[],
            )

    assert exc.value.status_code == 500
    credits.refund_credits.assert_awaited_once()


@pytest.mark.asyncio
async def test_submit_job_signed_url_generation_failure_marks_failed_and_refunds():
    with patch("src.features.ai.service.CreditsService") as credits_cls, patch(
        "src.features.ai.service.StorageService"
    ) as storage_cls:
        credits = MagicMock()
        credits.consume_credits = AsyncMock(return_value=_credit_result(True, consumed=5, remaining=10))
        credits.refund_credits = AsyncMock()
        credits_cls.return_value = credits

        storage = MagicMock()
        storage.generate_signed_url = AsyncMock(side_effect=Exception("signed url failure"))
        storage_cls.return_value = storage

        service = AiJobService()

    with patch("src.features.ai.service.create_job", new=AsyncMock()), patch(
        "src.features.ai.service.add_job_event", new=AsyncMock()
    ), patch("src.features.ai.service.create_document", new=AsyncMock(return_value=uuid4())), patch(
        "src.features.ai.service.update_job_payload", new=AsyncMock()
    ), patch(
        "src.features.ai.service.mark_job_failed", new=AsyncMock()
    ) as mark_failed:
        with pytest.raises(HTTPException) as exc:
            await service.submit_job(
                user_id="user-1",
                feature_key="process_summary",
                endpoint_key="process_summary",
                initial_payload={},
                files=[
                    {
                        "bucket": "documents",
                        "storage_path": "inputs/a.pdf",
                        "filename": "a.pdf",
                    }
                ],
            )

    assert exc.value.status_code == 500
    mark_failed.assert_awaited_once()
    credits.refund_credits.assert_awaited_once()


@pytest.mark.asyncio
async def test_submit_job_success_enqueues_payload():
    with patch("src.features.ai.service.CreditsService") as credits_cls, patch(
        "src.features.ai.service.StorageService"
    ) as storage_cls:
        credits = MagicMock()
        credits.consume_credits = AsyncMock(return_value=_credit_result(True, consumed=5, remaining=10))
        credits.refund_credits = AsyncMock()
        credits_cls.return_value = credits

        storage = MagicMock()
        storage.generate_signed_url = AsyncMock(return_value="https://signed-url")
        storage_cls.return_value = storage

        service = AiJobService()

    input_doc_id = uuid4()
    update_payload_mock = AsyncMock()

    with patch("src.features.ai.service.create_job", new=AsyncMock()), patch(
        "src.features.ai.service.add_job_event", new=AsyncMock()
    ), patch("src.features.ai.service.create_document", new=AsyncMock(return_value=input_doc_id)), patch(
        "src.features.ai.service.update_job_payload", new=update_payload_mock
    ):
        job_id = await service.submit_job(
            user_id="user-1",
            feature_key="process_summary",
            endpoint_key="process_summary",
            initial_payload={"prompt": "resumir"},
            files=[
                {
                    "bucket": "documents",
                    "storage_path": "inputs/a.pdf",
                    "filename": "a.pdf",
                }
            ],
        )

    # job_id is now a plain UUID string (no prefix)
    assert len(job_id) == 36  # UUID format
    assert update_payload_mock.await_count == 1
    updated = update_payload_mock.await_args.kwargs.get("request_payload") or {}
    assert updated.get("files")
    assert updated.get("input_document_id") == str(input_doc_id)


@pytest.mark.asyncio
async def test_submit_job_with_existing_file_url_skips_signed_url():
    with patch("src.features.ai.service.CreditsService") as credits_cls, patch(
        "src.features.ai.service.StorageService"
    ) as storage_cls:
        credits = MagicMock()
        credits.consume_credits = AsyncMock(return_value=_credit_result(True, consumed=3, remaining=10))
        credits.refund_credits = AsyncMock()
        credits_cls.return_value = credits

        storage = MagicMock()
        storage.generate_signed_url = AsyncMock()
        storage_cls.return_value = storage

        service = AiJobService()

    with patch("src.features.ai.service.create_job", new=AsyncMock()), patch(
        "src.features.ai.service.add_job_event", new=AsyncMock()
    ), patch("src.features.ai.service.create_document", new=AsyncMock(return_value=uuid4())), patch(
        "src.features.ai.service.update_job_payload", new=AsyncMock()
    ):
        await service.submit_job(
            user_id="user-1",
            feature_key="brief_scanner",
            endpoint_key="brief_scanner",
            initial_payload={},
            files=[
                {
                    "bucket": "documents",
                    "storage_path": "inputs/a.pdf",
                    "file_url": "https://already-uploaded",
                    "filename": "a.pdf",
                }
            ],
        )

    storage.generate_signed_url.assert_not_called()
