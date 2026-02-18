# 🏗️ Scheduler Architecture - APScheduler

Resposta à pergunta: **"O Python APScheduler ficaria acoplado no backend ou no worker? Ou seria um terceiro serviço?"**

## 📊 TL;DR - Resumo Executivo

**Implementação Atual:** Acoplado no backend (simples, funciona para início)
**Recomendação Futura:** Worker separado (quando escalar horizontalmente)

---

## 🎯 Resposta Completa

### Situação Atual: Acoplado no Backend ✅

**O que foi implementado:**
- APScheduler rodando **dentro** do processo do FastAPI
- Usa `MemoryJobStore` (jobs armazenados em memória)
- Inicia automaticamente quando o backend sobe
- Para automaticamente quando o backend desce

**Arquivos:**
- [`apps/backend/src/core/scheduler.py`](apps/backend/src/core/scheduler.py) - Configuração
- [`apps/backend/src/main.py`](apps/backend/src/main.py) - Integração no lifespan

**Estrutura:**
```
┌──────────────────────────────┐
│     Backend Process          │
│                              │
│  ┌────────────────────────┐  │
│  │   FastAPI App          │  │
│  │   - /api/v1/...        │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │  APScheduler           │  │
│  │  - Check deadlines 8AM │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

---

## ✅ Vantagens da Implementação Atual

1. **Simplicidade:**
   - Não precisa de infraestrutura adicional
   - Um único serviço para manter
   - Deploy simples (apenas o backend)

2. **Custo:**
   - Sem custo adicional de infraestrutura
   - Um único processo rodando

3. **Desenvolvimento:**
   - Fácil de debugar
   - Logs centralizados
   - Bom para MVP/início

4. **Configuração:**
   - Já está funcionando!
   - Sem necessidade de Redis, workers, etc.

---

## ⚠️ Limitações (Quando se Torna Problema)

### Problema 1: Horizontal Scaling

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Backend    │       │  Backend    │       │  Backend    │
│ Instance 1  │       │ Instance 2  │       │ Instance 3  │
│             │       │             │       │             │
│ Scheduler   │       │ Scheduler   │       │ Scheduler   │
│ runs at 8AM │  +    │ runs at 8AM │  +    │ runs at 8AM │
│             │       │             │       │             │
│ Creates 50  │       │ Creates 50  │       │ Creates 50  │
│ notifs      │       │ notifs      │       │ notifs      │
└─────────────┘       └─────────────┘       └─────────────┘

RESULTADO: 150 notificações (triplicado!) ❌
```

**Quando acontece:**
- Load balancer com múltiplas instâncias
- Auto-scaling (Kubernetes, Railway, etc.)
- Deploy zero-downtime (nova versão sobe antes da antiga cair)

### Problema 2: Reinicializações

Se o backend cair/reiniciar durante a execução de um job:
- Job é interrompido (não termina)
- Precisa esperar próxima execução agendada
- Perda de trabalho em progresso

---

## 🚀 Soluções por Fase

### Fase 1: Agora (Implementado) ✅

**Usar backend acoplado + MemoryJobStore**

```python
# src/core/scheduler.py
jobstores = {
    'default': MemoryJobStore()  # Simples, em memória
}
```

**Quando funciona bem:**
- ✅ 1 instância do backend
- ✅ MVP/início do projeto
- ✅ Baixo tráfego
- ✅ Deploy manual (não auto-scaling)

---

### Fase 1.5: Scaling com Lock Distribuído

**Quando começar a escalar horizontalmente:**

```python
# src/core/scheduler.py
from apscheduler.jobstores.redis import RedisJobStore

jobstores = {
    'default': RedisJobStore(
        host='redis-url.upstash.io',
        port=6379,
        password='xxx',
        db=0
    )
}
```

**Como funciona:**
```
┌─────────────┐       ┌─────────────┐
│  Backend 1  │       │  Backend 2  │
│  Scheduler  │       │  Scheduler  │
└──────┬──────┘       └──────┬──────┘
       │                     │
       └──────┬──────────────┘
              ▼
       ┌─────────────┐
       │    Redis    │
       │ (Job Lock)  │
       └─────────────┘
```

**Benefícios:**
- ✅ Múltiplas instâncias funcionam
- ✅ Apenas UMA instância executa o job
- ✅ Coordenação via Redis
- ✅ Fácil migração do código atual

**Custo:**
- Precisa de Redis (Upstash tem free tier)
- Adicionar `apscheduler[redis]` às dependências

---

### Fase 2: Worker Separado (Futuro)

**Quando:**
- Muitos jobs agendados
- Jobs pesados/demorados
- Precisa de alta disponibilidade para jobs
- Backend escala muito mais que necessidade de jobs

**Estrutura:**
```
apps/
├── backend/          # API REST apenas
├── frontend/         # Next.js
└── worker/          # NOVO: Apenas jobs agendados
    ├── main.py
    ├── jobs/
    │   ├── check_deadlines.py
    │   └── send_reports.py
    └── pyproject.toml
```

**Worker:** `apps/worker/main.py`
```python
from apscheduler.schedulers.blocking import BlockingScheduler

scheduler = BlockingScheduler()

# Importar jobs
from jobs.check_deadlines import check_deadlines
from jobs.send_reports import send_weekly_reports

# Agendar
scheduler.add_job(check_deadlines, 'cron', hour=8, minute=0)
scheduler.add_job(send_weekly_reports, 'cron', day_of_week='mon', hour=9)

if __name__ == "__main__":
    print("Worker started")
    scheduler.start()  # Bloqueia aqui
```

**Deploy:** Railway/Render/Fly.io
```yaml
# railway.toml
[[services]]
name = "api"
source = "apps/backend"

[[services]]
name = "worker"  # Novo serviço independente
source = "apps/worker"
```

**Benefícios:**
- ✅ Backend escala independentemente
- ✅ Worker escala independentemente
- ✅ Melhor isolamento
- ✅ Logs separados
- ✅ Pode reiniciar API sem afetar jobs

**Custos:**
- Serviço adicional (~ $5-10/mês)
- Mais complexidade operacional

---

## 🎯 Minha Recomendação Final

### Agora (Você já tem isso! ✅)
```
Backend com APScheduler acoplado + MemoryJobStore
```

**Razão:** Simples, funciona perfeitamente para início.

---

### Quando tiver 2+ instâncias do backend
```
Backend com APScheduler + RedisJobStore
```

**Migração:**
1. Adicionar Upstash Redis (free tier)
2. Trocar `MemoryJobStore()` por `RedisJobStore()`
3. Pronto! Código continua igual

**Custo adicional:** $0 (Upstash free tier)

---

### Quando tiver 10+ jobs ou jobs pesados
```
Worker separado + Redis
```

**Migração:**
1. Criar `apps/worker/`
2. Mover código do scheduler para lá
3. Deploy como serviço separado
4. Remover scheduler do backend

**Custo adicional:** ~$5-10/mês (Railway worker)

---

## 📋 Checklist de Decisão

### Use Backend Acoplado (atual) se:
- [ ] Tem apenas 1 instância do backend
- [ ] Poucos jobs (< 5)
- [ ] Jobs rápidos (< 30 segundos)
- [ ] MVP/início do projeto
- [ ] Orçamento limitado

### Migre para Redis Lock se:
- [ ] Começou horizontal scaling (2+ instâncias)
- [ ] Notificações duplicadas aparecendo
- [ ] Auto-scaling habilitado
- [ ] Zero-downtime deploys

### Migre para Worker Separado se:
- [ ] 10+ jobs agendados
- [ ] Jobs demorados (> 1 minuto)
- [ ] Precisa escalar backend muito mais que jobs
- [ ] Precisa de alta disponibilidade para jobs
- [ ] Tem orçamento para infraestrutura adicional

---

## 🔍 Como Saber Quando Migrar?

### Sinais de que precisa de Redis Lock:
1. Notificações duplicadas
2. Logs mostram job rodando múltiplas vezes
3. Railway/provider mostra 2+ instâncias ativas

### Sinais de que precisa de Worker:
1. Backend lento durante execução de jobs
2. Timeouts em jobs
3. Precisa de mais de 10 jobs diferentes
4. Jobs demorando minutos para completar

---

## 💡 Exemplo Real - Trajetória do Processa AI

```
Mês 1-3: MVP
└─> Backend acoplado + MemoryJobStore
    Status: ✅ Perfeito

Mês 4-6: Crescimento
└─> 100+ usuários, Railway auto-scaling ativado
    Problema: Notificações duplicadas!
    Solução: Migrar para RedisJobStore (1 hora de trabalho)
    Status: ✅ Resolvido

Mês 7-12: Escala
└─> 1000+ usuários, 15 jobs agendados
    Problema: Jobs pesados deixando API lenta
    Solução: Worker separado (1 dia de trabalho)
    Status: ✅ Otimizado
```

---

## 🎓 Conclusão

**Resposta direta à sua pergunta:**

> "O Python APScheduler ficaria acoplado no backend ou no worker?"

**Resposta:** Depende da fase do projeto!

1. **Início (AGORA):** Acoplado no backend ✅ (já implementado)
2. **Crescimento:** Acoplado no backend + Redis 🔄 (quando tiver 2+ instâncias)
3. **Escala:** Worker separado 🚀 (quando tiver muitos jobs)

Você já tem a melhor solução para **AGORA**. Quando precisar evoluir, a migração é simples e gradual! 🎉

---

## 📚 Referências

- [APScheduler Docs](https://apscheduler.readthedocs.io/)
- [Redis Job Store](https://apscheduler.readthedocs.io/en/3.x/modules/jobstores/redis.html)
- [Upstash Redis](https://upstash.com/) - Free tier disponível
- [Railway Multi-Service](https://docs.railway.app/reference/project-services)
