"""
Script para testar notificações de prazos manualmente

Uso:
    uv run python scripts/test_deadline_notifications.py
"""
import asyncio
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.features.office.deadlines.notifications import DeadlineNotificationService


async def main():
    print("=" * 60)
    print("TESTE: Verificação de Notificações de Prazos")
    print("=" * 60)

    # Show current time
    brazil_tz = ZoneInfo('America/Sao_Paulo')
    now = datetime.now(brazil_tz)
    today = now.date()

    print(f"\nHorário atual (Brazil): {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"Data de hoje: {today}")
    print("\n" + "-" * 60)

    try:
        service = DeadlineNotificationService()
        print("\n[OK] Service inicializado")

        print("\nExecutando verificacao de prazos...")
        await service.check_upcoming_deadlines()

        print("\n" + "=" * 60)
        print("[OK] Verificacao concluida com sucesso!")
        print("=" * 60)

    except Exception as e:
        print("\n" + "=" * 60)
        print(f"[ERRO]: {e}")
        print("=" * 60)
        raise


if __name__ == "__main__":
    asyncio.run(main())
