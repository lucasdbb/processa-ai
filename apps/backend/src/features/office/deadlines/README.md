# Deadline Notifications - Cron Job Setup

Este documento explica como configurar as notificações automáticas de prazos.

## Como Funciona

O sistema verifica diariamente os prazos que estão próximos de vencer e cria notificações para os usuários responsáveis.

**Alertas criados:**
- 7 dias antes do vencimento
- 3 dias antes do vencimento
- 1 dia antes do vencimento (amanhã)

## Configuração do Cron Job

### Opção 1: Cron tradicional (Linux/Mac)

1. Crie um script Python para executar a verificação:

```python
# apps/backend/scripts/check_deadlines.py
import asyncio
from src.features.office.deadlines.notifications import DeadlineNotificationService

async def main():
    service = DeadlineNotificationService()
    await service.check_upcoming_deadlines()
    print("Deadline notifications checked successfully")

if __name__ == "__main__":
    asyncio.run(main())
```

2. Adicione ao crontab (execute `crontab -e`):

```bash
# Roda todos os dias às 8:00 AM
0 8 * * * cd /path/to/processa-ai/apps/backend && uv run python scripts/check_deadlines.py >> /var/log/deadline-notifications.log 2>&1
```

### Opção 2: Python APScheduler (Recomendado para produção)

Adicione ao `main.py`:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from src.features.office.deadlines.notifications import DeadlineNotificationService

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting scheduler...")

    async def check_deadlines_job():
        service = DeadlineNotificationService()
        await service.check_upcoming_deadlines()

    # Roda todos os dias às 8:00 AM
    scheduler.add_job(check_deadlines_job, 'cron', hour=8, minute=0)
    scheduler.start()

    yield

    # Shutdown
    scheduler.shutdown()
```

Instale a dependência:
```bash
uv add apscheduler
```

### Opção 3: Railway/Cloud (usando Railway Cron)

Railway suporta cron jobs. Adicione ao `railway.toml`:

```toml
[[crons]]
schedule = "0 8 * * *"  # Todos os dias às 8:00 AM
command = "uv run python scripts/check_deadlines.py"
```

### Opção 4: Endpoint + Serviço externo (Cron-job.org, EasyCron)

1. Crie um endpoint protegido:

```python
# apps/backend/src/features/office/deadlines/router.py

@router.post("/deadlines/check-notifications")
async def check_deadline_notifications(
    api_key: str = Header(..., alias="X-API-Key")
):
    if api_key != settings.CRON_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    service = DeadlineNotificationService()
    await service.check_upcoming_deadlines()
    return {"status": "success", "message": "Deadline notifications checked"}
```

2. Configure o serviço externo para chamar:
   - URL: `https://your-api.com/api/v1/deadlines/check-notifications`
   - Header: `X-API-Key: your-secret-key`
   - Schedule: Diário às 8:00 AM

## Testando

Execute manualmente:

```bash
cd apps/backend
uv run python -c "
import asyncio
from src.features.office.deadlines.notifications import DeadlineNotificationService

async def test():
    service = DeadlineNotificationService()
    await service.check_upcoming_deadlines()
    print('Done!')

asyncio.run(test())
"
```

## Logs

Verifique os logs para confirmar que as notificações estão sendo criadas:

```bash
tail -f /var/log/deadline-notifications.log
```

Ou no Railway:
```bash
railway logs
```

## Customização

Para alterar os prazos de notificação, edite o arquivo `notifications.py`:

```python
check_dates = [
    (now + timedelta(days=1), "vence amanhã"),
    (now + timedelta(days=3), "vence em 3 dias"),
    (now + timedelta(days=7), "vence em 7 dias"),
    (now + timedelta(days=14), "vence em 2 semanas"),  # Adicionar nova
]
```
