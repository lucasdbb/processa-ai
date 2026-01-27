# API Gateway

API Gateway para o projeto Processa AI. Roteia requisições do frontend para os microserviços.

## Arquitetura

```
Frontend (React)
    ↓
API Gateway (FastAPI - porta 8080)
    ├── /api/ai → ai-worker (porta 8001)
    ├── /api/calculators → calc-engine (porta 8002)
    └── /api/office → office-api (porta 8003)
```

## Desenvolvimento

### Instalar dependências
```bash
cd services/api-gateway
uv pip install -e .
```

### Rodar servidor
```bash
uv run python src/main.py
```

Servidor inicia em: `http://localhost:8080`

### Configuração

Variáveis de ambiente (`.env`):

```env
# Server
PORT=8080
HOST=0.0.0.0
ENVIRONMENT=development

# Microservices
AI_WORKER_BASE_URL=http://localhost:8001
AI_WORKER_INTERNAL_TOKEN=dev-internal-token

CALC_ENGINE_BASE_URL=http://localhost:8002
CALC_ENGINE_INTERNAL_TOKEN=dev-internal-token

OFFICE_API_BASE_URL=http://localhost:8003
OFFICE_API_INTERNAL_TOKEN=dev-internal-token

# Timeouts
UPSTREAM_TIMEOUT_S=300
```

## Endpoints Implementados

### AI

- `GET /api/ai/jobs/{job_id}` - Status de job
- `GET /api/ai/analyses/history` - Histórico de análises
- `GET /api/ai/documents/{id}/download` - Download de documento

### Próximos

- `POST /api/ai/cnis-analysis` - Submeter análise (requer implementar upload no ai-worker)
- Proxies para calc-engine e office-api
- Autenticação completa com validação JWT

## Status

✅ Estrutura básica criada  
✅ Proxy para ai-worker (jobs, histórico, downloads)  
⚠️ Upload de PDFs (pendente - requer endpoint no ai-worker)  
⚠️ Validação JWT completa (pendente)  
⚠️ Proxies para calc-engine e office-api (pendente)
