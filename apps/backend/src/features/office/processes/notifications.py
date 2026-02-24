"""
Process notifications helpers
Create notifications when processes are updated
"""

from src.core.supabase import get_supabase


async def notify_process_updated(
    user_id: str,
    process_id: str,
    process_number: str,
    update_type: str,
    description: str | None = None,
):
    """
    Create notification when a process is updated

    Args:
        user_id: ID of the user to notify
        process_id: ID of the process
        process_number: Process number for display
        update_type: Type of update (status_change, document_added, etc.)
        description: Optional description of the update
    """
    supabase = get_supabase()

    notification = {
        "user_id": user_id,
        "type": "process",
        "title": f"Atualização no processo {process_number}",
        "description": description or "O processo foi atualizado",
        "metadata": {
            "process_id": process_id,
            "process_number": process_number,
            "update_type": update_type,
        },
    }

    supabase.table("notifications").insert(notification).execute()


# Example usage in ProcessesService.update_process():
#
# After updating the process:
#   if old_status != new_status:
#       await notify_process_updated(
#           user_id=str(user_id),
#           process_id=str(process_id),
#           process_number=process.process_number,
#           update_type="status_change",
#           description=f"Status alterado de {old_status} para {new_status}"
#       )
