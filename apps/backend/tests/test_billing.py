"""Comprehensive billing tests: webhooks, subscriptions, and StripeObject compatibility.

These tests cover:
- Webhook handler dispatch and error handling
- StripeObject vs dict compatibility (_sget helper)
- checkout.session.completed (subscription + credit purchase)
- invoice.paid / invoice.payment_failed / invoice.payment_action_required
- customer.subscription.created / updated / deleted / paused / resumed
- charge.refunded / charge.dispute.created / customer.updated
- Subscription service: checkout, portal, cancel, change plan, sync
- Edge cases: missing metadata, missing fields, race conditions
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import stripe
from fastapi import HTTPException

from src.features.billing.webhooks.service import (
    PermanentError,
    TransientError,
    WebhooksService,
    _sget,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_stripe_object(data: dict) -> stripe.StripeObject:
    """Build a real StripeObject from a dict (nested)."""
    return stripe.StripeObject.construct_from(data, None)


def _make_event(event_id: str, event_type: str, obj_data: dict, *, as_stripe_object: bool = False):
    """Build a webhook event dict or StripeObject."""
    raw = {
        "id": event_id,
        "type": event_type,
        "data": {"object": obj_data},
    }
    if as_stripe_object:
        return _make_stripe_object(raw)
    return raw


def _supabase_query_chain(data=None):
    """Return a MagicMock that mimics Supabase's fluent query chain."""
    chain = MagicMock()
    result = SimpleNamespace(data=data)
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.neq.return_value = chain
    chain.in_.return_value = chain
    chain.not_ = chain  # not_ is a property accessor, not a call
    chain.is_.return_value = chain
    chain.limit.return_value = chain
    chain.single.return_value = chain
    chain.update.return_value = chain
    chain.upsert.return_value = chain
    chain.insert.return_value = chain
    chain.execute.return_value = result
    return chain


def _create_service(supabase=None) -> WebhooksService:
    """Instantiate WebhooksService with a mocked Supabase client."""
    sb = supabase or MagicMock()
    with patch("src.features.billing.webhooks.service.get_supabase", return_value=sb):
        return WebhooksService()


# ---------------------------------------------------------------------------
# _sget helper tests
# ---------------------------------------------------------------------------


class TestSget:
    """Tests for _sget — safe accessor for dict and StripeObject."""

    def test_dict_get_existing_key(self):
        assert _sget({"a": 1}, "a") == 1

    def test_dict_get_missing_key(self):
        assert _sget({"a": 1}, "b") is None

    def test_dict_get_missing_key_with_default(self):
        assert _sget({"a": 1}, "b", "fallback") == "fallback"

    def test_dict_get_none_value_returns_default(self):
        # dict.get returns None natively, _sget should too
        assert _sget({"a": None}, "a") is None

    def test_stripe_object_get_existing_key(self):
        obj = _make_stripe_object({"customer": "cus_123", "mode": "subscription"})
        assert _sget(obj, "customer") == "cus_123"
        assert _sget(obj, "mode") == "subscription"

    def test_stripe_object_get_missing_key(self):
        obj = _make_stripe_object({"customer": "cus_123"})
        assert _sget(obj, "nonexistent") is None

    def test_stripe_object_get_missing_key_with_default(self):
        obj = _make_stripe_object({"customer": "cus_123"})
        assert _sget(obj, "nonexistent", False) is False

    def test_stripe_object_nested_metadata(self):
        obj = _make_stripe_object(
            {
                "metadata": {"user_id": "user_123", "credits": "50"},
            }
        )
        metadata = _sget(obj, "metadata", {})
        assert _sget(metadata, "user_id") == "user_123"
        assert _sget(metadata, "credits") == "50"
        assert _sget(metadata, "missing") is None

    def test_stripe_object_none_value_returns_none(self):
        """StripeObject stores None explicitly — _sget returns None (not the default)."""
        obj = _make_stripe_object({"customer": None})
        assert _sget(obj, "customer", "default") is None

    def test_sget_is_needed_because_stripe_objects_vary(self):
        """_sget provides a uniform accessor for both dict and StripeObject,
        avoiding reliance on .get() which may not be available on all
        StripeObject instances (e.g., from Webhook.construct_event)."""
        obj = _make_stripe_object({"id": "test"})
        assert _sget(obj, "id") == "test"
        assert _sget(obj, "missing") is None
        assert _sget(obj, "missing", "fallback") == "fallback"


# ---------------------------------------------------------------------------
# Webhook dispatch with StripeObject events
# ---------------------------------------------------------------------------


class TestWebhookDispatchWithStripeObject:
    """Ensure handle_webhook works when construct_event returns StripeObjects."""

    @pytest.mark.asyncio
    async def test_checkout_completed_with_stripe_object(self):
        """The exact scenario that caused the production bug."""
        event = _make_event(
            "evt_live_1",
            "checkout.session.completed",
            {
                "id": "cs_live_abc",
                "mode": "subscription",
                "customer": "cus_live",
                "subscription": "sub_live",
                "metadata": {"user_id": "user-1"},
            },
            as_stripe_object=True,
        )

        service = _create_service()

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=False),
            patch.object(service, "_record_event"),
            patch.object(service, "_handle_checkout_completed", new=AsyncMock()) as handler,
        ):
            result = await service.handle_webhook(b"{}", "sig")

        assert result["received"] is True
        handler.assert_awaited_once()
        # Verify the data passed to handler is accessible
        call_args = handler.call_args[0][0]
        assert _sget(call_args, "mode") == "subscription"
        assert _sget(call_args, "customer") == "cus_live"

    @pytest.mark.asyncio
    async def test_invoice_paid_with_stripe_object(self):
        event = _make_event(
            "evt_2",
            "invoice.paid",
            {"id": "in_1", "subscription": "sub_1", "customer": "cus_1"},
            as_stripe_object=True,
        )
        service = _create_service()

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=False),
            patch.object(service, "_record_event"),
            patch.object(service, "_handle_invoice_paid", new=AsyncMock()) as handler,
        ):
            result = await service.handle_webhook(b"{}", "sig")

        assert result["received"] is True
        handler.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_subscription_updated_with_stripe_object(self):
        event = _make_event(
            "evt_3",
            "customer.subscription.updated",
            {
                "id": "sub_1",
                "customer": "cus_1",
                "status": "active",
                "items": {
                    "data": [
                        {
                            "price": {"id": "price_1"},
                            "current_period_start": 1000,
                            "current_period_end": 2000,
                        }
                    ]
                },
                "cancel_at_period_end": False,
            },
            as_stripe_object=True,
        )
        service = _create_service()

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=False),
            patch.object(service, "_record_event"),
            patch.object(service, "_handle_subscription_updated", new=AsyncMock()) as handler,
        ):
            result = await service.handle_webhook(b"{}", "sig")

        assert result["received"] is True
        handler.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_metadata_resolved_from_stripe_object_event(self):
        """Verify user_id is correctly resolved from StripeObject metadata."""
        event = _make_event(
            "evt_meta",
            "checkout.session.completed",
            {
                "id": "cs_1",
                "mode": "subscription",
                "customer": "cus_1",
                "subscription": "sub_1",
                "metadata": {"user_id": "user-resolved"},
            },
            as_stripe_object=True,
        )
        service = _create_service()

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=False),
            patch.object(service, "_record_event") as record_event,
            patch.object(service, "_handle_checkout_completed", new=AsyncMock()),
        ):
            await service.handle_webhook(b"{}", "sig")

        # Check that record_event was called with user_id in metadata
        processing_call = record_event.call_args_list[0]
        assert processing_call.kwargs["metadata"]["user_id"] == "user-resolved"

    @pytest.mark.asyncio
    async def test_customer_id_fallback_when_no_metadata_user_id(self):
        """When metadata has no user_id, resolve via stripe_customer_id lookup."""
        event = _make_event(
            "evt_fallback",
            "invoice.paid",
            {"id": "in_1", "customer": "cus_lookup", "subscription": "sub_1"},
            as_stripe_object=True,
        )
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(data=[{"user_id": "user-from-db"}])
        service = _create_service(supabase)

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=False),
            patch.object(service, "_record_event") as record_event,
            patch.object(service, "_handle_invoice_paid", new=AsyncMock()),
        ):
            await service.handle_webhook(b"{}", "sig")

        processing_call = record_event.call_args_list[0]
        assert processing_call.kwargs["metadata"]["user_id"] == "user-from-db"

    @pytest.mark.asyncio
    async def test_event_metadata_built_from_stripe_object(self):
        """Verify event_metadata dict is properly built from StripeObject fields."""
        event = _make_event(
            "evt_meta_build",
            "charge.refunded",
            {
                "id": "ch_1",
                "customer": "cus_1",
                "invoice": "in_1",
                "charge": "ch_1",
                "amount_refunded": 5000,
                "refunded": True,
            },
            as_stripe_object=True,
        )
        service = _create_service()

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=False),
            patch.object(service, "_record_event") as record_event,
            patch.object(service, "_handle_charge_refunded", new=AsyncMock()),
        ):
            await service.handle_webhook(b"{}", "sig")

        metadata = record_event.call_args_list[0].kwargs["metadata"]
        assert metadata["id"] == "ch_1"
        assert metadata["customer"] == "cus_1"
        assert metadata["invoice"] == "in_1"


# ---------------------------------------------------------------------------
# checkout.session.completed handler
# ---------------------------------------------------------------------------


class TestHandleCheckoutCompleted:
    """Tests for _handle_checkout_completed."""

    def _make_subscription_mock(self, status="active", price_id="price_autonomo"):
        """Create a mock Stripe Subscription object."""
        item = MagicMock()
        item.price.id = price_id
        item.current_period_start = 1700000000
        item.current_period_end = 1702600000

        sub = MagicMock()
        sub.status = status
        sub.cancel_at_period_end = False
        sub.__getitem__ = lambda self, key: {"items": MagicMock(data=[item])}[key]
        return sub, item

    @pytest.mark.asyncio
    async def test_subscription_checkout_success(self):
        """Full happy path: checkout → upsert subscription → grant credits → email."""
        session = _make_stripe_object(
            {
                "mode": "subscription",
                "customer": "cus_1",
                "subscription": "sub_1",
                "metadata": {"user_id": "user-1"},
            }
        )

        sub_mock, item_mock = self._make_subscription_mock()
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(data=[{"email": "test@test.com"}])
        supabase.rpc.return_value.execute.return_value = SimpleNamespace(data=True)
        service = _create_service(supabase)

        with (
            patch(
                "src.features.billing.webhooks.service.retrieve_subscription", return_value=sub_mock
            ),
            patch("src.features.billing.webhooks.service.get_first_item", return_value=item_mock),
            patch(
                "src.features.billing.webhooks.service.get_subscription_period",
                return_value={"current_period_start": 1700000000, "current_period_end": 1702600000},
            ),
            patch.object(service, "_get_plan_id_from_price", return_value="autonomo"),
            patch.object(service, "_grant_plan_credits", new=AsyncMock()) as grant_credits,
            patch.object(service, "_get_user_email", new=AsyncMock(return_value="test@test.com")),
            patch.object(service, "_get_plan_name", new=AsyncMock(return_value="Autônomo")),
            patch(
                "src.features.billing.webhooks.service.send_subscription_welcome", new=AsyncMock()
            ) as send_email,
        ):
            await service._handle_checkout_completed(session)

        # Verify upsert was called with correct data
        upsert_call = supabase.table.return_value.upsert.call_args[0][0]
        assert upsert_call["user_id"] == "user-1"
        assert upsert_call["stripe_customer_id"] == "cus_1"
        assert upsert_call["stripe_subscription_id"] == "sub_1"
        assert upsert_call["plan_id"] == "autonomo"
        assert upsert_call["status"] == "active"

        grant_credits.assert_awaited_once_with("user-1", "autonomo")
        send_email.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_checkout_payment_mode_delegates_to_credit_purchase(self):
        session = _make_stripe_object(
            {
                "mode": "payment",
                "metadata": {"user_id": "user-1", "credits": "50"},
            }
        )
        service = _create_service()

        with patch.object(service, "_handle_credit_purchase", new=AsyncMock()) as handler:
            await service._handle_checkout_completed(session)

        handler.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_checkout_missing_customer_raises_permanent_error(self):
        session = _make_stripe_object(
            {
                "mode": "subscription",
                "subscription": "sub_1",
                "metadata": {"user_id": "user-1"},
            }
        )
        service = _create_service()

        with pytest.raises(PermanentError, match="Missing customer"):
            await service._handle_checkout_completed(session)

    @pytest.mark.asyncio
    async def test_checkout_missing_subscription_raises_permanent_error(self):
        session = _make_stripe_object(
            {
                "mode": "subscription",
                "customer": "cus_1",
                "metadata": {"user_id": "user-1"},
            }
        )
        service = _create_service()

        with pytest.raises(PermanentError, match="Missing customer"):
            await service._handle_checkout_completed(session)

    @pytest.mark.asyncio
    async def test_checkout_missing_user_id_raises_permanent_error(self):
        session = _make_stripe_object(
            {
                "mode": "subscription",
                "customer": "cus_1",
                "subscription": "sub_1",
                "metadata": {},
            }
        )
        service = _create_service()

        with pytest.raises(PermanentError, match="Missing user_id"):
            await service._handle_checkout_completed(session)

    @pytest.mark.asyncio
    async def test_checkout_stripe_api_failure_raises_transient(self):
        session = _make_stripe_object(
            {
                "mode": "subscription",
                "customer": "cus_1",
                "subscription": "sub_1",
                "metadata": {"user_id": "user-1"},
            }
        )
        service = _create_service()

        with patch(
            "src.features.billing.webhooks.service.retrieve_subscription",
            side_effect=stripe.StripeError("API down"),
        ):
            with pytest.raises(TransientError, match="Failed to retrieve subscription"):
                await service._handle_checkout_completed(session)

    @pytest.mark.asyncio
    async def test_checkout_db_failure_raises_transient(self):
        session = _make_stripe_object(
            {
                "mode": "subscription",
                "customer": "cus_1",
                "subscription": "sub_1",
                "metadata": {"user_id": "user-1"},
            }
        )
        sub_mock, item_mock = self._make_subscription_mock()
        supabase = MagicMock()
        supabase.table.return_value.upsert.return_value.execute.side_effect = Exception("DB down")
        service = _create_service(supabase)

        with (
            patch(
                "src.features.billing.webhooks.service.retrieve_subscription", return_value=sub_mock
            ),
            patch("src.features.billing.webhooks.service.get_first_item", return_value=item_mock),
            patch(
                "src.features.billing.webhooks.service.get_subscription_period",
                return_value={"current_period_start": 1700000000, "current_period_end": 1702600000},
            ),
            patch.object(service, "_get_plan_id_from_price", return_value="autonomo"),
        ):
            with pytest.raises(TransientError, match="Failed to update subscription"):
                await service._handle_checkout_completed(session)

    @pytest.mark.asyncio
    async def test_checkout_email_failure_does_not_raise(self):
        """Email failure must NOT cause webhook to fail (non-critical)."""
        session = _make_stripe_object(
            {
                "mode": "subscription",
                "customer": "cus_1",
                "subscription": "sub_1",
                "metadata": {"user_id": "user-1"},
            }
        )
        sub_mock, item_mock = self._make_subscription_mock()
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain()
        service = _create_service(supabase)

        with (
            patch(
                "src.features.billing.webhooks.service.retrieve_subscription", return_value=sub_mock
            ),
            patch("src.features.billing.webhooks.service.get_first_item", return_value=item_mock),
            patch(
                "src.features.billing.webhooks.service.get_subscription_period",
                return_value={"current_period_start": 1700000000, "current_period_end": 1702600000},
            ),
            patch.object(service, "_get_plan_id_from_price", return_value="autonomo"),
            patch.object(service, "_grant_plan_credits", new=AsyncMock()),
            patch.object(
                service,
                "_get_user_email",
                new=AsyncMock(side_effect=Exception("email service down")),
            ),
        ):
            # Should NOT raise
            await service._handle_checkout_completed(session)


# ---------------------------------------------------------------------------
# Credit purchase handler
# ---------------------------------------------------------------------------


class TestHandleCreditPurchase:
    @pytest.mark.asyncio
    async def test_credit_purchase_success(self):
        session = _make_stripe_object(
            {
                "metadata": {"user_id": "user-1", "credits": "25"},
            }
        )
        supabase = MagicMock()
        supabase.rpc.return_value.execute.return_value = SimpleNamespace(data=True)
        service = _create_service(supabase)

        await service._handle_credit_purchase(session)

        supabase.rpc.assert_called_once_with(
            "grant_credits_to_user",
            {
                "p_user_id": "user-1",
                "p_amount": 25,
                "p_reason": "credit_purchase",
                "p_credit_type": "purchased",
            },
        )

    @pytest.mark.asyncio
    async def test_credit_purchase_missing_metadata_skips(self):
        session = _make_stripe_object({"metadata": {}})
        service = _create_service()

        # Should not raise
        await service._handle_credit_purchase(session)

    @pytest.mark.asyncio
    async def test_credit_purchase_rpc_failure_raises_transient(self):
        session = _make_stripe_object(
            {
                "metadata": {"user_id": "user-1", "credits": "10"},
            }
        )
        supabase = MagicMock()
        supabase.rpc.return_value.execute.side_effect = Exception("rpc down")
        service = _create_service(supabase)

        with pytest.raises(TransientError, match="Failed to grant credits"):
            await service._handle_credit_purchase(session)


# ---------------------------------------------------------------------------
# Invoice handlers
# ---------------------------------------------------------------------------


class TestInvoiceHandlers:
    @pytest.mark.asyncio
    async def test_invoice_paid_renews_subscription(self):
        invoice = _make_stripe_object(
            {
                "subscription": "sub_1",
                "customer": "cus_1",
            }
        )
        sub_mock = MagicMock()
        item_mock = MagicMock()
        item_mock.current_period_start = 1700000000
        item_mock.current_period_end = 1702600000

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data=[{"user_id": "user-1", "plan_id": "autonomo"}]
        )
        service = _create_service(supabase)

        with (
            patch(
                "src.features.billing.webhooks.service.retrieve_subscription", return_value=sub_mock
            ),
            patch(
                "src.features.billing.webhooks.service.get_subscription_period",
                return_value={"current_period_start": 1700000000, "current_period_end": 1702600000},
            ),
            patch.object(service, "_reset_monthly_credits", new=AsyncMock()) as reset,
        ):
            await service._handle_invoice_paid(invoice)

        reset.assert_awaited_once_with("user-1", "autonomo")

    @pytest.mark.asyncio
    async def test_invoice_paid_without_subscription_skips(self):
        invoice = _make_stripe_object({"id": "in_1"})
        service = _create_service()

        # Should not raise
        await service._handle_invoice_paid(invoice)

    @pytest.mark.asyncio
    async def test_invoice_failed_sets_past_due(self):
        invoice = _make_stripe_object(
            {
                "subscription": "sub_1",
                "customer": "cus_1",
            }
        )
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(data=[{"user_id": "user-1"}])
        service = _create_service(supabase)

        with (
            patch.object(service, "_get_user_email", new=AsyncMock(return_value=None)),
        ):
            await service._handle_invoice_failed(invoice)

        update_call = supabase.table.return_value.update.call_args[0][0]
        assert update_call["status"] == "past_due"

    @pytest.mark.asyncio
    async def test_invoice_action_required_sets_incomplete(self):
        invoice = _make_stripe_object(
            {
                "subscription": "sub_1",
                "customer_email": "test@test.com",
                "hosted_invoice_url": "https://stripe.com/inv",
            }
        )
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain()
        service = _create_service(supabase)

        with patch(
            "src.features.billing.webhooks.service.send_payment_action_required", new=AsyncMock()
        ) as send:
            await service._handle_invoice_action_required(invoice)

        update_call = supabase.table.return_value.update.call_args[0][0]
        assert update_call["status"] == "incomplete"
        send.assert_awaited_once_with("test@test.com", "https://stripe.com/inv")


# ---------------------------------------------------------------------------
# Subscription lifecycle handlers
# ---------------------------------------------------------------------------


class TestSubscriptionLifecycle:
    @pytest.mark.asyncio
    async def test_subscription_created_syncs_data(self):
        subscription = _make_stripe_object(
            {
                "id": "sub_1",
                "customer": "cus_1",
                "status": "active",
                "items": {
                    "data": [
                        {
                            "price": {"id": "price_1"},
                            "current_period_start": 1000,
                            "current_period_end": 2000,
                        }
                    ]
                },
                "cancel_at_period_end": False,
            }
        )

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data=[{"user_id": "user-1", "status": "none"}]
        )
        service = _create_service(supabase)

        with patch.object(service, "_get_plan_id_from_price", return_value="autonomo"):
            await service._handle_subscription_created(subscription)

        update_call = supabase.table.return_value.update.call_args[0][0]
        assert update_call["stripe_subscription_id"] == "sub_1"
        assert update_call["plan_id"] == "autonomo"
        assert update_call["status"] == "active"

    @pytest.mark.asyncio
    async def test_subscription_created_skips_if_already_active(self):
        subscription = _make_stripe_object(
            {
                "id": "sub_1",
                "customer": "cus_1",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_1"}}]},
            }
        )

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data=[{"user_id": "user-1", "status": "active"}]
        )
        service = _create_service(supabase)

        await service._handle_subscription_created(subscription)

        # update should NOT have been called
        supabase.table.return_value.update.assert_not_called()

    @pytest.mark.asyncio
    async def test_subscription_created_unknown_customer_skips(self):
        subscription = _make_stripe_object(
            {
                "id": "sub_1",
                "customer": "cus_unknown",
                "status": "active",
            }
        )

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(data=[])
        service = _create_service(supabase)

        # Should not raise
        await service._handle_subscription_created(subscription)

    @pytest.mark.asyncio
    async def test_subscription_created_missing_fields_raises_permanent(self):
        subscription = _make_stripe_object({})
        service = _create_service()

        with pytest.raises(PermanentError, match="missing required fields"):
            await service._handle_subscription_created(subscription)

    @pytest.mark.asyncio
    async def test_subscription_updated_changes_plan(self):
        subscription = _make_stripe_object(
            {
                "id": "sub_1",
                "status": "active",
                "items": {
                    "data": [
                        {
                            "price": {"id": "price_new"},
                            "current_period_start": 1000,
                            "current_period_end": 2000,
                        }
                    ]
                },
                "cancel_at_period_end": False,
                "previous_attributes": {"items": {}},
            }
        )

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data={"user_id": "user-1", "plan_id": "old_plan"}
        )
        service = _create_service(supabase)

        with (
            patch.object(service, "_get_plan_id_from_price", return_value="new_plan"),
            patch.object(service, "_reset_monthly_credits", new=AsyncMock()) as reset,
            patch.object(service, "_recalculate_document_expiration", new=AsyncMock()),
        ):
            await service._handle_subscription_updated(subscription)

        reset.assert_awaited_once_with("user-1", "new_plan")

    @pytest.mark.asyncio
    async def test_subscription_deleted_resets_to_free(self):
        subscription = _make_stripe_object({"id": "sub_1"})

        # subscriptions table returns user data, billing_plans returns credits
        sub_chain = _supabase_query_chain(data=[{"user_id": "user-1"}])
        plan_chain = _supabase_query_chain(data={"monthly_credits": 0})

        supabase = MagicMock()
        supabase.table.side_effect = lambda name: plan_chain if name == "billing_plans" else sub_chain
        supabase.rpc.return_value.execute.return_value = SimpleNamespace(data=True)
        service = _create_service(supabase)

        with (
            patch.object(service, "_get_user_email", new=AsyncMock(return_value=None)),
            patch.object(service, "_recalculate_document_expiration", new=AsyncMock()),
        ):
            await service._handle_subscription_deleted(subscription)

        update_call = sub_chain.update.call_args[0][0]
        assert update_call["status"] == "canceled"
        assert update_call["plan_id"] == "free"
        assert update_call["stripe_subscription_id"] is None

    @pytest.mark.asyncio
    async def test_subscription_paused(self):
        subscription = _make_stripe_object({"id": "sub_1"})

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain()
        service = _create_service(supabase)

        await service._handle_subscription_paused(subscription)

        update_call = supabase.table.return_value.update.call_args[0][0]
        assert update_call["status"] == "paused"

    @pytest.mark.asyncio
    async def test_subscription_resumed_resets_credits(self):
        subscription = _make_stripe_object({"id": "sub_1"})

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data=[{"user_id": "user-1", "plan_id": "autonomo"}]
        )
        service = _create_service(supabase)

        with patch.object(service, "_reset_monthly_credits", new=AsyncMock()) as reset:
            await service._handle_subscription_resumed(subscription)

        update_call = supabase.table.return_value.update.call_args[0][0]
        assert update_call["status"] == "active"
        reset.assert_awaited_once_with("user-1", "autonomo")


# ---------------------------------------------------------------------------
# Charge / dispute / customer handlers
# ---------------------------------------------------------------------------


class TestChargeAndDisputeHandlers:
    @pytest.mark.asyncio
    async def test_charge_refunded_full_revokes_credits(self):
        charge = _make_stripe_object(
            {
                "invoice": "in_1",
                "amount_refunded": 7490,
                "refunded": True,
            }
        )

        invoice_mock = MagicMock()
        invoice_mock.subscription = "sub_1"

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data=[{"user_id": "user-1", "plan_id": "autonomo"}]
        )
        service = _create_service(supabase)

        with (
            patch(
                "src.features.billing.webhooks.service.retrieve_invoice", return_value=invoice_mock
            ),
        ):
            await service._handle_charge_refunded(charge)

        supabase.rpc.assert_called_once_with(
            "reset_monthly_credits",
            {"p_user_id": "user-1", "p_new_amount": 0},
        )

    @pytest.mark.asyncio
    async def test_charge_refunded_without_invoice_skips(self):
        charge = _make_stripe_object(
            {
                "amount_refunded": 1000,
                "refunded": False,
            }
        )
        service = _create_service()

        # Should not raise
        await service._handle_charge_refunded(charge)

    @pytest.mark.asyncio
    async def test_dispute_created_sends_alert(self):
        dispute = _make_stripe_object(
            {
                "charge": "ch_1",
                "amount": 7490,
                "reason": "fraudulent",
                "status": "needs_response",
            }
        )

        charge_mock = MagicMock()
        charge_mock.invoice = "in_1"
        invoice_mock = MagicMock()
        invoice_mock.subscription = "sub_1"

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(data=[{"user_id": "user-1"}])
        service = _create_service(supabase)

        with (
            patch(
                "src.features.billing.webhooks.service.retrieve_charge", return_value=charge_mock
            ),
            patch(
                "src.features.billing.webhooks.service.retrieve_invoice", return_value=invoice_mock
            ),
            patch(
                "src.features.billing.webhooks.service.send_dispute_alert", new=AsyncMock()
            ) as alert,
        ):
            await service._handle_dispute_created(dispute)

        alert.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_customer_updated_syncs_profile(self):
        customer = _make_stripe_object(
            {
                "id": "cus_1",
                "email": "new@email.com",
                "name": "New Name",
            }
        )

        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(data=[{"user_id": "user-1"}])
        service = _create_service(supabase)

        await service._handle_customer_updated(customer)

        # Verify profile update was called
        update_calls = supabase.table.return_value.update.call_args_list
        assert len(update_calls) > 0


# ---------------------------------------------------------------------------
# Subscription service tests
# ---------------------------------------------------------------------------


class TestSubscriptionsService:
    def _create_sub_service(self, supabase=None):
        from src.features.billing.subscriptions.service import SubscriptionsService

        sb = supabase or MagicMock()
        with patch("src.features.billing.subscriptions.service.get_supabase", return_value=sb):
            return SubscriptionsService()

    @pytest.mark.asyncio
    async def test_get_subscription_returns_defaults_for_new_user(self):
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(data=[])
        service = self._create_sub_service(supabase)

        result = await service.get_subscription("user-new")

        assert result["plan_id"] == "free"
        assert result["status"] == "none"
        assert result["stripe_subscription_id"] is None

    @pytest.mark.asyncio
    async def test_get_subscription_returns_existing_data(self):
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data=[
                {
                    "id": "uuid-1",
                    "user_id": "user-1",
                    "stripe_customer_id": "cus_1",
                    "stripe_subscription_id": "sub_1",
                    "plan_id": "autonomo",
                    "status": "active",
                    "current_period_start": "2026-01-01T00:00:00+00:00",
                    "current_period_end": "2026-02-01T00:00:00+00:00",
                    "cancel_at_period_end": False,
                }
            ]
        )
        service = self._create_sub_service(supabase)

        result = await service.get_subscription("user-1")

        assert result["plan_id"] == "autonomo"
        assert result["status"] == "active"
        assert result["stripe_subscription_id"] == "sub_1"

    @pytest.mark.asyncio
    async def test_create_checkout_rejects_invalid_price(self):
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data=[{"stripe_price_id": "price_valid"}]
        )
        service = self._create_sub_service(supabase)

        with pytest.raises(HTTPException) as exc:
            await service.create_checkout_session("user-1", "price_invalid")

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_checkout_rejects_active_subscription(self):
        service = self._create_sub_service()
        # Bypass price validation
        service._validate_price_id = MagicMock()
        service._validate_redirect_url = MagicMock(return_value=None)
        # Return active subscription
        service.get_subscription = AsyncMock(
            return_value={
                "stripe_subscription_id": "sub_1",
                "status": "active",
            }
        )

        with pytest.raises(HTTPException) as exc:
            await service.create_checkout_session("user-1", "price_1")

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_cancel_subscription_without_stripe_sub_raises_400(self):
        service = self._create_sub_service()
        service.get_subscription = AsyncMock(
            return_value={
                "stripe_subscription_id": None,
                "status": "none",
            }
        )

        with pytest.raises(HTTPException) as exc:
            await service.cancel_subscription("user-1")

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_cancel_subscription_inactive_raises_400(self):
        service = self._create_sub_service()
        service.get_subscription = AsyncMock(
            return_value={
                "stripe_subscription_id": "sub_1",
                "status": "canceled",
            }
        )

        with pytest.raises(HTTPException) as exc:
            await service.cancel_subscription("user-1")

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_cancel_subscription_success(self):
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain()
        service = self._create_sub_service(supabase)
        service.get_subscription = AsyncMock(
            return_value={
                "stripe_subscription_id": "sub_1",
                "status": "active",
            }
        )

        with patch(
            "src.features.billing.subscriptions.service.stripe_cancel_subscription",
        ) as cancel:
            result = await service.cancel_subscription("user-1")

        assert result["success"] is True
        cancel.assert_called_once_with("sub_1")

    @pytest.mark.asyncio
    async def test_change_plan_without_subscription_raises_400(self):
        service = self._create_sub_service()
        service._validate_price_id = MagicMock()
        service.get_subscription = AsyncMock(
            return_value={
                "stripe_subscription_id": None,
                "status": "none",
            }
        )

        with pytest.raises(HTTPException) as exc:
            await service.change_plan("user-1", "price_new")

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_portal_no_customer_raises_404(self):
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(data=[{"stripe_customer_id": None}])
        service = self._create_sub_service(supabase)

        with pytest.raises(HTTPException) as exc:
            await service.create_portal_session("user-1")

        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_sync_no_stripe_subscription_returns_not_synced(self):
        supabase = MagicMock()
        supabase.table.return_value = _supabase_query_chain(
            data=[{"stripe_subscription_id": None, "stripe_customer_id": "cus_1"}]
        )
        service = self._create_sub_service(supabase)

        result = await service.sync_subscription("user-1")

        assert result["synced"] is False

    @pytest.mark.asyncio
    async def test_validate_redirect_url_rejects_external_domain(self):
        service = self._create_sub_service()

        with pytest.raises(HTTPException) as exc:
            service._validate_redirect_url("https://evil.com/steal")

        assert exc.value.status_code == 400

    def test_validate_redirect_url_accepts_frontend_domain(self):
        service = self._create_sub_service()

        result = service._validate_redirect_url("http://localhost:5173/app?success=true")
        assert result == "http://localhost:5173/app?success=true"

    def test_validate_redirect_url_accepts_none(self):
        service = self._create_sub_service()
        assert service._validate_redirect_url(None) is None


# ---------------------------------------------------------------------------
# Idempotency and error handling (enhanced from existing tests)
# ---------------------------------------------------------------------------


class TestWebhookIdempotencyAndErrors:
    @pytest.mark.asyncio
    async def test_idempotency_skips_already_processed(self):
        event = _make_event("evt_dup", "invoice.paid", {"id": "in_1"}, as_stripe_object=True)
        service = _create_service()

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=True),
            patch.object(service, "_handle_invoice_paid", new=AsyncMock()) as handler,
        ):
            result = await service.handle_webhook(b"{}", "sig")

        assert result["status"] == "already_processed"
        handler.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unknown_exception_returns_500(self):
        event = _make_event("evt_err", "invoice.paid", {"id": "in_1"}, as_stripe_object=True)
        service = _create_service()

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=False),
            patch.object(service, "_record_event"),
            patch.object(
                service,
                "_handle_invoice_paid",
                new=AsyncMock(side_effect=RuntimeError("unexpected")),
            ),
        ):
            with pytest.raises(HTTPException) as exc:
                await service.handle_webhook(b"{}", "sig")

        assert exc.value.status_code == 500

    @pytest.mark.asyncio
    async def test_unhandled_event_type_records_skipped(self):
        event = _make_event("evt_skip", "product.created", {"id": "prod_1"}, as_stripe_object=True)
        service = _create_service()

        with (
            patch(
                "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                return_value=event,
            ),
            patch.object(service, "_is_event_processed", return_value=False),
            patch.object(service, "_record_event") as record,
        ):
            result = await service.handle_webhook(b"{}", "sig")

        assert result["received"] is True
        assert any(c.kwargs.get("event_status") == "skipped" for c in record.call_args_list)

    @pytest.mark.asyncio
    async def test_signature_verification_failure_returns_400(self):
        service = _create_service()

        with patch(
            "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
            side_effect=stripe.SignatureVerificationError("bad", "sig"),
        ):
            with pytest.raises(HTTPException) as exc:
                await service.handle_webhook(b"{}", "invalid")

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_all_event_types_dispatch_correctly(self):
        """Verify every supported event type dispatches to the correct handler."""
        event_handler_map = {
            "checkout.session.completed": "_handle_checkout_completed",
            "invoice.paid": "_handle_invoice_paid",
            "invoice.payment_failed": "_handle_invoice_failed",
            "invoice.payment_action_required": "_handle_invoice_action_required",
            "customer.subscription.created": "_handle_subscription_created",
            "customer.subscription.updated": "_handle_subscription_updated",
            "customer.subscription.deleted": "_handle_subscription_deleted",
            "customer.subscription.paused": "_handle_subscription_paused",
            "customer.subscription.resumed": "_handle_subscription_resumed",
            "charge.refunded": "_handle_charge_refunded",
            "charge.dispute.created": "_handle_dispute_created",
            "customer.updated": "_handle_customer_updated",
        }

        for event_type, handler_name in event_handler_map.items():
            event = _make_event(
                f"evt_{handler_name}",
                event_type,
                {"id": "obj_1", "customer": "cus_1"},
                as_stripe_object=True,
            )
            service = _create_service()

            with (
                patch(
                    "src.features.billing.webhooks.service.stripe.Webhook.construct_event",
                    return_value=event,
                ),
                patch.object(service, "_is_event_processed", return_value=False),
                patch.object(service, "_record_event"),
                patch.object(service, handler_name, new=AsyncMock()) as handler,
            ):
                result = await service.handle_webhook(b"{}", "sig")

            assert result["received"] is True, f"Failed for {event_type}"
            handler.assert_awaited_once(), f"Handler {handler_name} not called for {event_type}"
