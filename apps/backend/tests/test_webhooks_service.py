from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import stripe
from fastapi import HTTPException

from src.features.billing.webhooks.service import PermanentError, TransientError, WebhooksService


@pytest.mark.asyncio
async def test_handle_webhook_invalid_signature_returns_400():
    with patch("src.features.billing.webhooks.service.get_supabase", return_value=MagicMock()):
        service = WebhooksService()

    with patch(
        "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
        side_effect=stripe.SignatureVerificationError("bad", "sig"),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.handle_webhook(b"{}", "invalid")

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_handle_webhook_invalid_payload_returns_400():
    with patch("src.features.billing.webhooks.service.get_supabase", return_value=MagicMock()):
        service = WebhooksService()

    with patch(
        "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
        side_effect=Exception("invalid payload"),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.handle_webhook(b"{}", "sig")

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_handle_webhook_skips_already_processed_event():
    event = {"id": "evt_1", "type": "invoice.paid", "data": {"object": {"id": "in_1"}}}

    with patch("src.features.billing.webhooks.service.get_supabase", return_value=MagicMock()):
        service = WebhooksService()

    with patch("src.features.billing.webhooks.service.stripe.Webhook.construct_event", return_value=event), patch.object(
        service, "_is_event_processed", return_value=True
    ), patch.object(service, "_handle_invoice_paid", new=AsyncMock()) as handle_paid:
        result = await service.handle_webhook(b"{}", "sig")

    assert result["status"] == "already_processed"
    handle_paid.assert_not_awaited()


@pytest.mark.asyncio
async def test_handle_webhook_records_processed_event_on_success():
    event = {"id": "evt_2", "type": "invoice.paid", "data": {"object": {"id": "in_2"}}}

    with patch("src.features.billing.webhooks.service.get_supabase", return_value=MagicMock()):
        service = WebhooksService()

    with patch("src.features.billing.webhooks.service.stripe.Webhook.construct_event", return_value=event), patch.object(
        service, "_is_event_processed", return_value=False
    ), patch.object(service, "_handle_invoice_paid", new=AsyncMock()), patch.object(
        service, "_record_event"
    ) as record_event:
        result = await service.handle_webhook(b"{}", "sig")

    assert result["received"] is True
    assert any(call.kwargs.get("event_status") == "processed" for call in record_event.mock_calls)


@pytest.mark.asyncio
async def test_handle_webhook_transient_error_returns_500_and_records_failed():
    event = {"id": "evt_3", "type": "invoice.paid", "data": {"object": {"id": "in_3"}}}

    with patch("src.features.billing.webhooks.service.get_supabase", return_value=MagicMock()):
        service = WebhooksService()

    with patch("src.features.billing.webhooks.service.stripe.Webhook.construct_event", return_value=event), patch.object(
        service, "_is_event_processed", return_value=False
    ), patch.object(
        service,
        "_handle_invoice_paid",
        new=AsyncMock(side_effect=TransientError("temporary")),
    ), patch.object(service, "_record_event") as record_event:
        with pytest.raises(HTTPException) as exc:
            await service.handle_webhook(b"{}", "sig")

    assert exc.value.status_code == 500
    assert any(call.kwargs.get("event_status") == "failed" for call in record_event.mock_calls)


@pytest.mark.asyncio
async def test_handle_webhook_permanent_error_acknowledges_without_500():
    event = {"id": "evt_4", "type": "invoice.paid", "data": {"object": {"id": "in_4"}}}

    with patch("src.features.billing.webhooks.service.get_supabase", return_value=MagicMock()):
        service = WebhooksService()

    with patch("src.features.billing.webhooks.service.stripe.Webhook.construct_event", return_value=event), patch.object(
        service, "_is_event_processed", return_value=False
    ), patch.object(
        service,
        "_handle_invoice_paid",
        new=AsyncMock(side_effect=PermanentError("bad data")),
    ), patch.object(service, "_record_event") as record_event:
        result = await service.handle_webhook(b"{}", "sig")

    assert result["received"] is True
    assert any(call.kwargs.get("event_status") == "failed" for call in record_event.mock_calls)


@pytest.mark.asyncio
async def test_handle_webhook_unknown_event_records_skipped():
    event = {"id": "evt_5", "type": "unknown.event", "data": {"object": {"id": "obj_1"}}}

    with patch("src.features.billing.webhooks.service.get_supabase", return_value=MagicMock()):
        service = WebhooksService()

    with patch("src.features.billing.webhooks.service.stripe.Webhook.construct_event", return_value=event), patch.object(
        service, "_is_event_processed", return_value=False
    ), patch.object(service, "_record_event") as record_event:
        result = await service.handle_webhook(b"{}", "sig")

    assert result["received"] is True
    assert any(call.kwargs.get("event_status") == "skipped" for call in record_event.mock_calls)
