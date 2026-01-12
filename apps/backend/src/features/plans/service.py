from fastapi import HTTPException, status

from src.shared.database import get_supabase


class PlansService:
    def __init__(self):
        self.supabase = get_supabase()

    async def list_public_plans(self):
        try:
            res = (
                self.supabase.table("billing_plans")
                .select("id,slug,name,description,is_popular,is_sellable,sort_order")
                .eq("is_visible", True)
                .order("sort_order", desc=False)
                .execute()
            )
            plans = res.data or []

            if not plans:
                return []

            plan_ids = [p["id"] for p in plans if p.get("id")]

            prices_by_plan: dict[str, dict] = {}
            if plan_ids:
                prices_res = (
                    self.supabase.table("billing_plan_prices")
                    .select("plan_id,currency,amount_cents,interval")
                    .in_("plan_id", plan_ids)
                    .execute()
                )
                for row in prices_res.data or []:
                    plan_id = row.get("plan_id")
                    if not plan_id:
                        continue
                    current = prices_by_plan.get(plan_id)
                    if current is None:
                        prices_by_plan[plan_id] = row
                        continue
                    if current.get("interval") != "month" and row.get("interval") == "month":
                        prices_by_plan[plan_id] = row

            features_by_plan: dict[str, list[dict]] = {}
            if plan_ids:
                feats_res = (
                    self.supabase.table("billing_plan_features")
                    .select("plan_id,feature,sort_order")
                    .in_("plan_id", plan_ids)
                    .execute()
                )
                for row in feats_res.data or []:
                    plan_id = row.get("plan_id")
                    if not plan_id:
                        continue
                    features_by_plan.setdefault(plan_id, []).append(row)

            items = []
            for p in plans:
                plan_id = p.get("id")
                raw_price = prices_by_plan.get(plan_id) if plan_id else None
                raw_features = features_by_plan.get(plan_id, []) if plan_id else []
                raw_features_sorted = sorted(
                    raw_features,
                    key=lambda x: (
                        int(x.get("sort_order") or 0),
                        str(x.get("feature") or ""),
                    ),
                )

                items.append(
                    {
                        "slug": p.get("slug") or "",
                        "name": p.get("name") or "",
                        "description": p.get("description"),
                        "is_popular": bool(p.get("is_popular")),
                        "is_sellable": bool(p.get("is_sellable")),
                        "sort_order": int(p.get("sort_order") or 0),
                        "price": (
                            {
                                "currency": raw_price.get("currency"),
                                "amount_cents": int(raw_price.get("amount_cents") or 0),
                                "interval": raw_price.get("interval"),
                            }
                            if raw_price
                            else None
                        ),
                        "features": [
                            str(f.get("feature") or "").strip()
                            for f in raw_features_sorted
                            if f.get("feature")
                        ],
                    }
                )

            return items
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao listar planos",
            )
