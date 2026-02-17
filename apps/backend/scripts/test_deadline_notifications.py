"""
Script para testar notificações de prazos manualmente

Uso:
    uv run python scripts/test_deadline_notifications.py
"""
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.features.office.deadlines.notifications import DeadlineNotificationService

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    logger.info("=" * 60)
    logger.info("TESTE: Verificação de Notificações de Prazos")
    logger.info("=" * 60)

    # Show current time
    brazil_tz = ZoneInfo('America/Sao_Paulo')
    now = datetime.now(brazil_tz)
    today = now.date()

    logger.info(f"Horário atual (Brazil): {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    logger.info(f"Data de hoje: {today}")
    logger.info("-" * 60)

    try:
        service = DeadlineNotificationService()
        logger.info("Service inicializado")

        logger.info("Executando verificação de prazos...")
        await service.check_upcoming_deadlines()

        logger.info("=" * 60)
        logger.info("Verificação concluída com sucesso!")
        logger.info("=" * 60)

    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"ERRO: {e}")
        logger.error("=" * 60)
        raise


if __name__ == "__main__":
    asyncio.run(main())
