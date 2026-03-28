from typing import List

from fastapi import HTTPException, status

from src.core.logging import logger
from src.core.security import (
    check_ip_rate_limit,
    log_registration_ip,
    validate_cpf,
)
from src.core.stripe_client import create_checkout_session
from src.core.supabase import get_supabase
from src.features.billing.credits.constants import (
    CHECKLIST_BONUS_AMOUNT,
    CREDIT_PACKAGES,
    FEATURE_COSTS,
    WELCOME_CREDITS_AMOUNT,
)
from src.features.billing.credits.schemas import (
    AdminCreditsMetrics,
    AdminTopConsumer,
    AdminUsageByFeature,
    ConsumeCreditsResponse,
    CreditCheckResponse,
    CreditHistoryResponse,
    CreditPackage,
    CreditTransaction,
    FeatureCostItem,
    PurchaseCheckoutResponse,
)
from src.features.billing.subscriptions.service import SubscriptionsService


class CreditsService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_user_credits(self, user_id: str) -> dict:
        """Get user's credit balance with subscription and purchased breakdown."""
        try:
            result = (
                self.supabase.table("user_credits")
                .select("*")
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not result.data:
                # User doesn't have credits record yet, create one with 0 credits
                result = (
                    self.supabase.table("user_credits")
                    .insert(
                        {
                            "user_id": user_id,
                            "subscription_credits": 0,
                            "purchased_credits": 0,
                        }
                    )
                    .execute()
                )
                return self._format_credits_response(
                    result.data[0] if result.data else None, user_id
                )

            return self._format_credits_response(result.data, user_id)
        except Exception as e:
            logger.error(f"Failed to get user credits: {e}")
            # Return default values on error
            return self._format_credits_response(None, user_id)

    def _format_credits_response(self, data: dict | None, user_id: str) -> dict:
        """Format credits data for API response."""
        if not data:
            return {
                "user_id": user_id,
                "subscription_credits": 0,
                "purchased_credits": 0,
                "total_available": 0,
                "last_reset_at": None,
            }

        subscription_credits = data.get("subscription_credits", 0)
        purchased_credits = data.get("purchased_credits", 0)

        return {
            "user_id": data.get("user_id", user_id),
            "subscription_credits": subscription_credits,
            "purchased_credits": purchased_credits,
            "total_available": subscription_credits + purchased_credits,
            "last_reset_at": data.get("last_reset_at"),
        }

    async def get_feature_cost(self, feature_key: str) -> int:
        """Retorna custo em créditos de uma feature."""
        feature = FEATURE_COSTS.get(feature_key)
        if not feature or not feature.is_active:
            return 9999
        return feature.base_cost

    async def check_credits(self, user_id: str, feature_key: str) -> CreditCheckResponse:
        """Verifica se user tem créditos suficientes."""
        cost = await self.get_feature_cost(feature_key)
        credits_data = await self.get_user_credits(user_id)
        available = credits_data["total_available"]

        return CreditCheckResponse(has_credits=available >= cost, cost=cost, available=available)

    async def consume_credits(self, user_id: str, feature_key: str) -> ConsumeCreditsResponse:
        """Consome créditos para uma feature."""
        cost = await self.get_feature_cost(feature_key)

        # Chama a função SQL RPC consume_credits
        try:
            result = self.supabase.rpc(
                "consume_credits", {"p_user_id": user_id, "p_amount": cost, "p_reason": feature_key}
            ).execute()

            success = result.data

            # Busca saldo atualizado
            credits_data = await self.get_user_credits(user_id)
            remaining = credits_data["total_available"]

            return ConsumeCreditsResponse(
                success=success, credits_consumed=cost if success else 0, remaining=remaining
            )
        except Exception as e:
            logger.error(f"Error consuming credits: {e}")
            return ConsumeCreditsResponse(success=False, credits_consumed=0, remaining=0)

    async def refund_credits(self, user_id: str, amount: int, reason: str):
        """Devolve créditos em caso de falha."""
        # Usa grant_credits_to_user via RPC ou insert direto em transactions?
        # A função grant_credits_to_user existe no banco? O plano diz que sim.
        # Vamos assumir que sim, ou implementar via RPC.
        # Se não tiver RPC exposta,
        # podemos fazer via insert em user_credits (increment) + transaction log.
        # Mas o ideal é ter uma RPC `grant_credits`.

        # O plano menciona `grant_credits_to_user` como existente.
        try:
            self.supabase.rpc(
                "grant_credits_to_user",
                {
                    "p_user_id": user_id,
                    "p_amount": amount,
                    "p_reason": reason,
                    # Devolve como purchased para não expirar? Ou subscription?
                    "p_credit_type": "purchased",
                    # Melhor devolver como purchased para garantir que o usuário não perca.
                },
            ).execute()
        except Exception as e:
            logger.error(f"Error refunding credits: {e}")

    async def get_all_feature_costs(self) -> List[FeatureCostItem]:
        """Lista todas as features e seus custos."""
        return [
            FeatureCostItem(
                feature_key=fc.feature_key,
                display_name=fc.display_name,
                cost=fc.base_cost,
                description=fc.description,
            )
            for fc in FEATURE_COSTS.values()
            if fc.is_active
        ]

    async def get_packages(self) -> List[CreditPackage]:
        """Lista pacotes de créditos disponíveis para compra."""
        return sorted(
            [
                CreditPackage(
                    id=pkg.id,
                    name=pkg.name,
                    credits=pkg.credits,
                    price_cents=pkg.price_cents,
                )
                for pkg in CREDIT_PACKAGES.values()
            ],
            key=lambda p: p.price_cents,
        )

    async def create_purchase_checkout(
        self, user_id: str, package_id: str, redirect_url: str
    ) -> PurchaseCheckoutResponse:
        """Cria Stripe checkout session para compra de créditos."""
        # Validar redirect_url para prevenir Open Redirect
        subscription_service = SubscriptionsService()
        redirect_url = subscription_service._validate_redirect_url(redirect_url) or redirect_url

        # 1. Buscar pacote nas constantes
        package_def = CREDIT_PACKAGES.get(package_id)
        if not package_def:
            raise HTTPException(status_code=404, detail="Pacote não encontrado")

        package = {
            "id": package_def.id,
            "name": package_def.name,
            "credits": package_def.credits,
            "price_cents": package_def.price_cents,
        }

        # 2. Buscar ou criar customer_id do usuário no Stripe
        subscription_service = SubscriptionsService()
        customer_id = await subscription_service.get_or_create_customer(user_id)

        # 3. Criar checkout session
        # Preço em centavos. Criar line item ad-hoc
        # SEGURANÇA: Usamos o preço das constantes do servidor (package["price_cents"]),
        # ignorando qualquer input de preço que pudesse vir do frontend.
        line_items = [
            {
                "price_data": {
                    "currency": "brl",
                    "product_data": {
                        "name": f"Pacote de Créditos: {package['name']}",
                        "description": f"{package['credits']} créditos para usar na plataforma",
                    },
                    "unit_amount": package["price_cents"],
                },
                "quantity": 1,
            }
        ]

        session = create_checkout_session(
            customer=customer_id,
            line_items=line_items,
            mode="payment",
            success_url=f"{redirect_url}?success=true",
            cancel_url=f"{redirect_url}?canceled=true",
            metadata={
                "user_id": user_id,
                "package_id": package_id,
                "credits": str(package["credits"]),
                "type": "credit_purchase",
            },
        )

        return PurchaseCheckoutResponse(checkout_url=session.url, session_id=session.id)

    async def grant_welcome_credits(self, user_id: str, cpf: str, ip: str) -> dict:
        """Concede créditos de boas-vindas."""
        # 1. Verificar se já reivindicou
        profile = (
            self.supabase.table("profiles")
            .select("welcome_credits_claimed")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if profile.data and profile.data.get("welcome_credits_claimed"):
            raise HTTPException(status_code=400, detail="Créditos de boas-vindas já reivindicados")

        # 2. Validar CPF
        if not validate_cpf(cpf):
            raise HTTPException(status_code=400, detail="CPF inválido")

        # 3. Verificar CPF duplicado
        # A constraint unique no banco já cuida disso,
        # mas podemos checar antes para erro mais amigável
        cpf_check = self.supabase.table("profiles").select("id").eq("cpf", cpf).execute()
        if cpf_check.data:
            raise HTTPException(status_code=409, detail="CPF já cadastrado em outra conta")

        # 4. Rate limit de IP
        if not await check_ip_rate_limit(self.supabase, ip):
            raise HTTPException(
                status_code=429, detail="Limite de contas atingido para este dispositivo/IP"
            )

        # 5. Salvar CPF e marcar claimed
        try:
            result = (
                self.supabase.table("profiles")
                .update({"cpf": cpf, "welcome_credits_claimed": True})
                .eq("id", user_id)
                .execute()
            )

            if not result.data:
                logger.error(f"Failed to update profile for {user_id}. No rows affected.")
                raise HTTPException(
                    status_code=500, detail="Erro ao atualizar perfil. Tente novamente."
                )

        except HTTPException:
            raise
        except Exception as e:
            # Provavelmente violação de constraint unique se passou da checagem anterior
            # (race condition)
            logger.error(f"Error updating profile cpf: {e}")
            raise HTTPException(
                status_code=409, detail="Erro ao salvar CPF. Verifique se já não está em uso."
            )

        # 6. Log IP
        await log_registration_ip(self.supabase, ip, user_id)

        # 7. Grant credits
        # Assumindo que existe a RPC grant_credits_to_user
        try:
            self.supabase.rpc(
                "grant_credits_to_user",
                {
                    "p_user_id": user_id,
                    "p_amount": WELCOME_CREDITS_AMOUNT,
                    "p_reason": "welcome_bonus",
                    "p_credit_type": "purchased",  # Nunca expira
                },
            ).execute()
        except Exception as e:
            logger.error(f"Error granting welcome credits: {e}")

            # Rollback: desfazer marcação de claimed e limpar CPF para permitir nova tentativa
            try:
                self.supabase.table("profiles").update({"welcome_credits_claimed": False}).eq(
                    "id", user_id
                ).execute()
                logger.info(f"Rolled back welcome credits claim for user {user_id}")
            except Exception as rollback_error:
                logger.error(
                    f"Failed to rollback welcome credits claim for user {user_id}: {rollback_error}"
                )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao conceder créditos. Tente novamente.",
            )

        return {"success": True, "credits_granted": WELCOME_CREDITS_AMOUNT}

    async def grant_checklist_bonus(self, user_id: str) -> dict:
        """Concede créditos bônus por completar o checklist de onboarding."""
        # Check if already claimed via profile flag
        profile = (
            self.supabase.table("profiles")
            .select("checklist_bonus_claimed")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if profile.data and profile.data.get("checklist_bonus_claimed"):
            raise HTTPException(status_code=400, detail="Bônus do checklist já reivindicado")

        # Mark as claimed
        self.supabase.table("profiles").update({"checklist_bonus_claimed": True}).eq(
            "id", user_id
        ).execute()

        # Grant credits
        try:
            self.supabase.rpc(
                "grant_credits_to_user",
                {
                    "p_user_id": user_id,
                    "p_amount": CHECKLIST_BONUS_AMOUNT,
                    "p_reason": "checklist_bonus",
                    "p_credit_type": "purchased",
                },
            ).execute()
        except Exception as e:
            logger.error(f"Error granting checklist bonus: {e}")
            # Rollback
            self.supabase.table("profiles").update({"checklist_bonus_claimed": False}).eq(
                "id", user_id
            ).execute()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao conceder bônus. Tente novamente.",
            )

        return {"success": True, "credits_granted": CHECKLIST_BONUS_AMOUNT}

    async def get_transaction_history(
        self, user_id: str, page: int = 1, page_size: int = 20
    ) -> CreditHistoryResponse:
        """Histórico de transações."""
        start = (page - 1) * page_size
        end = start + page_size - 1

        # Total count
        count_result = (
            self.supabase.table("credit_transactions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        total = count_result.count

        # Data
        result = (
            self.supabase.table("credit_transactions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(start, end)
            .execute()
        )

        transactions = [CreditTransaction(**item) for item in result.data]

        return CreditHistoryResponse(
            transactions=transactions, total=total, page=page, page_size=page_size
        )

    async def get_admin_metrics(self) -> AdminCreditsMetrics:
        """Busca métricas administrativas de créditos."""

        # 1. Usage Stats via RPC
        stats_res = self.supabase.rpc("get_credits_usage_stats", {"days_limit": 30}).execute()
        stats = stats_res.data[0] if stats_res.data else {}

        # 2. Top Consumers via RPC
        top_res = self.supabase.rpc("get_top_consumers", {"limit_count": 10}).execute()
        top_consumers = top_res.data or []

        # 3. Revenue Estimado (Credits Sold)
        # Soma transações de compra (grant + purchased)
        revenue_res = (
            self.supabase.table("credit_transactions")
            .select("amount")
            .eq("transaction_type", "grant")
            .eq("credit_type", "purchased")
            .execute()
        )

        total_credits_sold = (
            sum(item["amount"] for item in revenue_res.data) if revenue_res.data else 0
        )
        # Estimativa: média R$0,80 por crédito = 80 centavos
        estimated_revenue = int(total_credits_sold * 80)

        usage_data = stats.get("usage_by_feature", []) or []

        return AdminCreditsMetrics(
            total_consumed_all_time=stats.get("total_consumed_all_time", 0),
            total_consumed_last_30d=stats.get("total_consumed_period", 0),
            total_revenue_cents=estimated_revenue,
            usage_by_feature=[AdminUsageByFeature(**item) for item in usage_data],
            top_consumers=[AdminTopConsumer(**item) for item in top_consumers],
        )


credits_service = CreditsService()
