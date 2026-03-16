# Scheduler Architecture - APScheduler

## TL;DR

**Implementação atual:** `AsyncIOScheduler` acoplado no backend, rodando dentro do processo FastAPI
**Recomendação futura:** Worker separado (quando escalar horizontalmente)

---

## Implementação Atual

**Arquivo:** [`apps/backend/src/core/scheduler.py`](../../apps/backend/src/core/scheduler.py)
**Integração:** [`apps/backend/src/main.py`](../../apps/backend/src/main.py) — iniciado/parado no lifespan do FastAPI

### Jobs Configurados

| Job | Agendamento | Descrição |
|-----|-------------|-----------|
| `check_deadlines_daily` | Diário às 8h (BRT) | Verifica prazos próximos → cria notificações in-app + envia emails |
| `weekly_deadline_summary` | Toda segunda às 8h (BRT) | Envia resumo semanal de prazos por email |
| `cleanup_old_data_monthly` | Todo dia 1º às 3h (BRT) | Limpa AI jobs antigos, uploads órfãos e convites expirados |

### Configuração

```python
AsyncIOScheduler(
    jobstores={"default": MemoryJobStore()},  # Jobs em memória
    executors={"default": AsyncIOExecutor()}, # Execução assíncrona (compatível com FastAPI)
    job_defaults={
        "coalesce": True,            # Se atrasou, roda apenas uma vez (não recupera perdidas)
        "max_instances": 1,          # Apenas uma instância por job ao mesmo tempo
        "misfire_grace_time": 3600,  # Job pode atrasar até 1h antes de ser descartado
    },
    timezone=ZoneInfo("America/Sao_Paulo"),
)
```

### Admin Notification

Cada job envia um email para `admin@processai.app.br` ao iniciar (via `send_email()`), servindo como heartbeat de monitoramento.

### Estrutura

```
Backend Process
├── FastAPI App (/api/v1/...)
└── AsyncIOScheduler
    ├── check_deadlines_job         → DeadlineNotificationService.check_upcoming_deadlines()
    ├── weekly_deadline_summary_job → DeadlineNotificationService.send_weekly_summary()
    └── cleanup_old_data_job        → CleanupService.run_all()
```

### Vantagens da abordagem atual

- Sem infraestrutura adicional — um único serviço para manter
- Deploy simples
- Logs centralizados com o restante do backend
- `AsyncIOExecutor` integra nativamente com o event loop do FastAPI (sem bloqueios)
- Ideal para MVP e escala inicial (1 instância, poucos jobs)

---

## Limitações — Quando se Torna Problema

### Problema: Horizontal Scaling

Com múltiplas instâncias do backend (Railway auto-scaling, Kubernetes, etc.), cada instância tem seu próprio `MemoryJobStore` isolado. Resultado: todos os jobs rodam em paralelo em cada instância.

```
Instance 1: check_deadlines → cria 50 notificações
Instance 2: check_deadlines → cria 50 notificações  ← duplicado!
Instance 3: check_deadlines → cria 50 notificações  ← duplicado!
```

**Sinais de que isso está acontecendo:**
- Notificações duplicadas
- Logs mostrando o mesmo job rodando várias vezes
- Provider mostrando 2+ instâncias ativas

---

## Upgrades Futuros

### Fase 1.5 — Redis Lock (ao escalar horizontalmente)

Trocar `MemoryJobStore` por `RedisJobStore`. O Redis age como coordenador distribuído: apenas **uma** instância executa cada job, as demais ficam aguardando o lock.

```python
from apscheduler.jobstores.redis import RedisJobStore

jobstores = {
    "default": RedisJobStore(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
    )
}
```

```
Instance 1: Scheduler ──┐
Instance 2: Scheduler ──┼──> Redis (Job Lock) ──> apenas 1 executa
Instance 3: Scheduler ──┘
```

**Migração:** ~1h de trabalho — o código dos jobs não muda, apenas a config do jobstore.
**Custo:** $0 (Upstash Redis tem free tier)

### Fase 2 — Worker Separado (ao ter muitos jobs ou jobs pesados)

Quando o scheduler crescer em número de jobs ou em tempo de execução, mover para um serviço dedicado desacopla o ciclo de vida do backend.

```
apps/
├── backend/     # API REST — escala independente
├── frontend/
└── services/
    └── worker/  # Scheduler dedicado — escala independente
        ├── main.py          # BlockingScheduler
        └── jobs/
            ├── check_deadlines.py
            ├── weekly_summary.py
            └── cleanup.py
```

```python
# services/worker/main.py
from apscheduler.schedulers.blocking import BlockingScheduler

scheduler = BlockingScheduler()
scheduler.add_job(check_deadlines_job, "cron", hour=8, minute=0)
scheduler.add_job(weekly_summary_job, "cron", day_of_week="mon", hour=8)
scheduler.add_job(cleanup_job, "cron", day=1, hour=3)
scheduler.start()  # Bloqueia aqui
```

```yaml
# railway.toml
[[services]]
name = "api"
source = "apps/backend"

[[services]]
name = "worker"
source = "services/worker"
```

**Migração:** ~1 dia de trabalho
**Custo adicional:** ~$5-10/mês (Railway worker service)

**Quando migrar:**
- Jobs demorando > 1 minuto e deixando a API lenta
- 10+ jobs agendados
- Necessidade de reiniciar o backend sem interromper jobs em execução
- Orçamento disponível para infraestrutura adicional

---

## Checklist de Decisão

| Cenário | Solução |
|---------|---------|
| 1 instância, MVP, baixo tráfego | ✅ Atual (MemoryJobStore acoplado) |
| 2+ instâncias / auto-scaling | 🔄 RedisJobStore (migração simples) |
| 10+ jobs ou jobs pesados | 🚀 Worker separado |

---

## Referências

- [APScheduler Docs](https://apscheduler.readthedocs.io/)
- [RedisJobStore](https://apscheduler.readthedocs.io/en/3.x/modules/jobstores/redis.html)
- [Upstash Redis](https://upstash.com/) — free tier disponível
- [Railway Multi-Service](https://docs.railway.app/reference/project-services)
