from fastapi import HTTPException, status

from src.core.supabase import get_supabase


class PlansService:
    def __init__(self):
        self.supabase = get_supabase()

    async def list_public_plans(self):
        try:
            res = (
                self.supabase.table("billing_plans")
                .select(
                    "id,slug,name,description,is_popular,is_visible,sort_order,price_reais,currency,interval,features,stripe_price_id"
                )
                .filter("is_visible", "eq", True)
                .order("sort_order", desc=False)
                .execute()
            )
            plans = res.data or []

            if not plans:
                return []

            items = []
            for p in plans:
                is_visible = bool(p.get("is_visible"))

                # If plan is not visible, return masked data
                if not is_visible:
                    items.append(
                        {
                            "slug": p.get("slug") or "",
                            "name": p.get("name") or "",
                            "description": "****",
                            "is_popular": bool(p.get("is_popular")),
                            "is_visible": False,
                            "is_sellable": False,
                            "sort_order": int(p.get("sort_order") or 0),
                            "price": {
                                "currency": "BRL",
                                "amount_cents": 0,
                                "interval": "month",
                                "stripe_price_id": None,
                            },
                            "features": ["Feature 1", "Feature 2", "Feature 3"],
                        }
                    )
                    continue

                # Convert price from reais to cents
                price_reais = float(p.get("price_reais") or 0)
                amount_cents = int(price_reais * 100)

                # Get features - it's stored as JSONB array
                features_data = p.get("features") or []
                if isinstance(features_data, str):
                    import json

                    features_data = json.loads(features_data)

                items.append(
                    {
                        "slug": p.get("slug") or "",
                        "name": p.get("name") or "",
                        "description": p.get("description"),
                        "is_popular": bool(p.get("is_popular")),
                        "is_visible": True,
                        "is_sellable": True,  # All visible plans are sellable
                        "sort_order": int(p.get("sort_order") or 0),
                        "price": (
                            {
                                "currency": p.get("currency") or "BRL",
                                "amount_cents": amount_cents,
                                "interval": p.get("interval") or "month",
                                "stripe_price_id": p.get("stripe_price_id"),
                            }
                            if amount_cents >= 0
                            else None
                        ),
                        "features": [str(f).strip() for f in features_data if f],
                    }
                )

            return items
        except HTTPException:
            raise
        except Exception as e:
            import traceback

            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao listar planos: {str(e)}",
            )
