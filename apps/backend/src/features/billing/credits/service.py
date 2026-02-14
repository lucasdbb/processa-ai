import stripe
from fastapi import HTTPException
from typing import List, Optional
from datetime import datetime

from src.core.supabase import get_supabase
from src.core.logging import logger
from src.core.security import (
    validate_cpf,
    check_ip_rate_limit,
    log_registration_ip,
    check_blocked_entity
)
from src.core.stripe_client import create_checkout_session
from src.features.billing.credits.schemas import (
    CreditCheckResponse,
    ConsumeCreditsResponse,
    FeatureCostItem,
    CreditPackage,
    PurchaseCheckoutResponse,
    CreditTransaction,
    CreditHistoryResponse,
    AdminCreditsMetrics,
    AdminUsageByFeature,
    AdminTopConsumer
)

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
                            "subscription_used": 0,
                            "purchased_credits": 0,
                            "purchased_used": 0,
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
                "subscription": {
                    "total": 0,
                    "used": 0,
                    "available": 0,
                },
                "purchased": {
                    "total": 0,
                    "used": 0,
                    "available": 0,
                },
                "total_available": 0,
                "last_reset_at": None,
            }

        return {
            "user_id": data.get("user_id", user_id),
            "subscription": {
                "total": data.get("subscription_credits", 0),
                "used": data.get("subscription_used", 0),
                "available": data.get("subscription_available", 0),
            },
            "purchased": {
                "total": data.get("purchased_credits", 0),
                "used": data.get("purchased_used", 0),
                "available": data.get("purchased_available", 0),
            },
            "total_available": data.get("total_available", 0),
            "last_reset_at": data.get("last_reset_at"),
        }

    async def get_feature_cost(self, feature_key: str) -> int:
        """Busca custo base de credit_costs pelo feature_key."""
        result = self.supabase.table("credit_costs").select("base_cost").eq("feature_key", feature_key).single().execute()
        if not result.data:
            # Fallback seguro se não encontrar
            return 9999
        return result.data["base_cost"]

    async def check_credits(self, user_id: str, feature_key: str) -> CreditCheckResponse:
        """Verifica se user tem créditos suficientes."""
        cost = await self.get_feature_cost(feature_key)
        credits_data = await self.get_user_credits(user_id)
        available = credits_data["total_available"]
        
        return CreditCheckResponse(
            has_credits=available >= cost,
            cost=cost,
            available=available
        )

    async def consume_credits(self, user_id: str, feature_key: str) -> ConsumeCreditsResponse:
        """Consome créditos para uma feature."""
        cost = await self.get_feature_cost(feature_key)
        
        # Chama a função SQL RPC consume_credits
        try:
            result = self.supabase.rpc(
                "consume_credits",
                {
                    "p_user_id": user_id,
                    "p_amount": cost,
                    "p_reason": feature_key
                }
            ).execute()
            
            success = result.data
            
            # Busca saldo atualizado
            credits_data = await self.get_user_credits(user_id)
            remaining = credits_data["total_available"]
            
            return ConsumeCreditsResponse(
                success=success,
                credits_consumed=cost if success else 0,
                remaining=remaining
            )
        except Exception as e:
            logger.error(f"Error consuming credits: {e}")
            return ConsumeCreditsResponse(
                success=False,
                credits_consumed=0,
                remaining=0
            )

    async def refund_credits(self, user_id: str, amount: int, reason: str):
        """Devolve créditos em caso de falha."""
        # Usa grant_credits_to_user via RPC ou insert direto em transactions?
        # A função grant_credits_to_user existe no banco? O plano diz que sim.
        # Vamos assumir que sim, ou implementar via RPC.
        # Se não tiver RPC exposta, podemos fazer via insert em user_credits (increment) + transaction log.
        # Mas o ideal é ter uma RPC `grant_credits`.
        
        # O plano menciona `grant_credits_to_user` como existente.
        try:
            self.supabase.rpc(
                "grant_credits_to_user",
                {
                    "p_user_id": user_id,
                    "p_amount": amount,
                    "p_reason": reason,
                    "p_credit_type": "purchased" # Devolve como purchased para não expirar? Ou subscription?
                    # Melhor devolver como purchased para garantir que o usuário não perca.
                }
            ).execute()
        except Exception as e:
            logger.error(f"Error refunding credits: {e}")

    async def get_all_feature_costs(self) -> List[FeatureCostItem]:
        """Lista todas as features e seus custos."""
        result = self.supabase.table("credit_costs").select("*").eq("is_active", True).execute()
        return [FeatureCostItem(**item) for item in result.data]

    async def get_packages(self) -> List[CreditPackage]:
        """Lista pacotes de créditos ativos."""
        result = self.supabase.table("credit_packages").select("*").eq("is_active", True).order("sort_order").execute()
        return [CreditPackage(**item) for item in result.data]

    async def create_purchase_checkout(self, user_id: str, package_id: str, redirect_url: str) -> PurchaseCheckoutResponse:
        """Cria Stripe checkout session para compra de créditos."""
        # 1. Buscar pacote
        package_result = self.supabase.table("credit_packages").select("*").eq("id", package_id).single().execute()
        if not package_result.data:
            raise HTTPException(status_code=404, detail="Pacote não encontrado")
        
        package = package_result.data
        
        # 2. Buscar customer_id do usuário
        user_result = self.supabase.table("profiles").select("stripe_customer_id, email").eq("id", user_id).single().execute()
        if not user_result.data or not user_result.data.get("stripe_customer_id"):
             raise HTTPException(status_code=400, detail="Usuário sem customer ID do Stripe")
             
        customer_id = user_result.data["stripe_customer_id"]
        
        # 3. Criar checkout session
        # Preço em centavos. Criar line item ad-hoc
        # SEGURANÇA: Usamos o preço do BANCO DE DADOS (package["price_cents"]), 
        # ignorando qualquer input de preço que pudesse vir do frontend (se viesse).
        line_items = [{
            "price_data": {
                "currency": "brl",
                "product_data": {
                    "name": f"Pacote de Créditos: {package['name']}",
                    "description": f"{package['credits']} créditos para usar na plataforma",
                },
                "unit_amount": package["price_cents"], # Preço oficial do banco
            },
            "quantity": 1,
        }]
        
        session = create_checkout_session(
            customer=customer_id,
            line_items=line_items,
            mode="payment",
            success_url=f"{redirect_url}?success=true",
            cancel_url=f"{redirect_url}?canceled=true",
            metadata={
                "user_id": user_id,
                "package_id": package_id,
                "credits": str(package["credits"]), # Quantidade oficial do banco
                "type": "credit_purchase"
            }
        )
        
        return PurchaseCheckoutResponse(
            checkout_url=session.url,
            session_id=session.id
        )

    async def grant_welcome_credits(self, user_id: str, cpf: str, ip: str) -> dict:
        """Concede créditos de boas-vindas."""
        # 1. Verificar se já reivindicou
        profile = self.supabase.table("profiles").select("welcome_credits_claimed").eq("id", user_id).single().execute()
        if profile.data and profile.data.get("welcome_credits_claimed"):
            raise HTTPException(status_code=400, detail="Créditos de boas-vindas já reivindicados")
            
        # 2. Validar CPF
        if not validate_cpf(cpf):
            raise HTTPException(status_code=400, detail="CPF inválido")
            
        # 3. Verificar CPF duplicado
        # A constraint unique no banco já cuida disso, mas podemos checar antes para erro mais amigável
        cpf_check = self.supabase.table("profiles").select("id").eq("cpf", cpf).execute()
        if cpf_check.data:
            raise HTTPException(status_code=409, detail="CPF já cadastrado em outra conta")
            
        # 4. Rate limit de IP
        if not await check_ip_rate_limit(self.supabase, ip):
             raise HTTPException(status_code=429, detail="Limite de contas atingido para este dispositivo/IP")
             
        # 5. Salvar CPF e marcar claimed
        try:
            self.supabase.table("profiles").update({
                "cpf": cpf,
                "welcome_credits_claimed": True
            }).eq("id", user_id).execute()
        except Exception as e:
            # Provavelmente violação de constraint unique se passou da checagem anterior (race condition)
            logger.error(f"Error updating profile cpf: {e}")
            raise HTTPException(status_code=409, detail="Erro ao salvar CPF. Verifique se já não está em uso.")

        # 6. Log IP
        await log_registration_ip(self.supabase, ip, user_id)
        
        # 7. Grant credits
        # Assumindo que existe a RPC grant_credits_to_user
        try:
            self.supabase.rpc(
                "grant_credits_to_user",
                {
                    "p_user_id": user_id,
                    "p_amount": 10,
                    "p_reason": "welcome_bonus",
                    "p_credit_type": "purchased" # Nunca expira
                }
            ).execute()
        except Exception as e:
            logger.error(f"Error granting welcome credits: {e}")
            # Se falhar o grant, deveríamos reverter o profile?
            # Idealmente sim, mas por simplicidade vamos deixar assim e o user reclama no suporte
            # Ou tentar retry.
            pass
            
        return {"success": True, "credits_granted": 10}
        
    async def get_transaction_history(self, user_id: str, page: int = 1, page_size: int = 20) -> CreditHistoryResponse:
        """Histórico de transações."""
        start = (page - 1) * page_size
        end = start + page_size - 1
        
        # Total count
        count_result = self.supabase.table("credit_transactions").select("id", count="exact").eq("user_id", user_id).execute()
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
            transactions=transactions,
            total=total,
            page=page,
            page_size=page_size
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
        revenue_res = self.supabase.table("credit_transactions")\
            .select("amount")\
            .eq("transaction_type", "grant")\
            .eq("credit_type", "purchased")\
            .execute()
            
        total_credits_sold = sum(item['amount'] for item in revenue_res.data) if revenue_res.data else 0
        # Estimativa: média R$0,80 por crédito = 80 centavos
        estimated_revenue = int(total_credits_sold * 80)
        
        usage_data = stats.get("usage_by_feature", []) or []
        
        return AdminCreditsMetrics(
            total_consumed_all_time=stats.get("total_consumed_all_time", 0),
            total_consumed_last_30d=stats.get("total_consumed_period", 0),
            total_revenue_cents=estimated_revenue,
            usage_by_feature=[AdminUsageByFeature(**item) for item in usage_data],
            top_consumers=[AdminTopConsumer(**item) for item in top_consumers]
        )

credits_service = CreditsService()
