"""
Calculator notifications helpers
Create notifications when calculations are completed
"""

from src.core.supabase import get_supabase


async def notify_calculation_completed(
    user_id: str,
    calculation_type: str,
    calculation_id: str | None = None,
    result_summary: str | None = None,
):
    """
    Create notification when a calculation is completed

    Args:
        user_id: ID of the user to notify
        calculation_type: Type of calculation (rescisao_trabalhista, previdencia, etc.)
        calculation_id: Optional ID of the calculation record
        result_summary: Optional summary of the result
    """
    supabase = get_supabase()

    calculation_names = {
        "rescisao_trabalhista": "Rescisão Trabalhista",
        "previdencia": "Previdência",
        "inss": "INSS",
        "fgts": "FGTS",
    }

    calc_name = calculation_names.get(calculation_type, "Cálculo")

    notification = {
        "user_id": user_id,
        "type": "calculation",
        "title": f"{calc_name} concluído",
        "description": result_summary or f"O cálculo de {calc_name} foi processado com sucesso",
        "metadata": {
            "calculation_type": calculation_type,
            "calculation_id": calculation_id,
        },
    }

    supabase.table("notifications").insert(notification).execute()


# Example usage in calculator endpoint:
#
# @router.post("/calculators/rescisao-trabalhista")
# async def calculate_rescisao(data: RescisaoInput, user_id: str = Depends(get_user_id)):
#     result = calculate_rescisao_trabalhista(data)
#
#     # Create notification
#     await notify_calculation_completed(
#         user_id=user_id,
#         calculation_type="rescisao_trabalhista",
#         result_summary=f"Valor total: R$ {result['total']}"
#     )
#
#     return result
