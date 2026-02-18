# 🔔 Sistema de Notificações - Processa AI

Documentação completa do sistema de notificações in-app.

## 📋 Visão Geral

O sistema de notificações permite que usuários recebam alertas sobre eventos importantes na plataforma:

- ✅ **Prazos próximos de vencer** (1, 3, 7 dias)
- ✅ **Atualizações em processos** (mudança de status, novos documentos)
- ✅ **Cálculos concluídos** (rescisão, previdência, etc.)
- ✅ **Novos posts no blog** (publicações)
- ✅ **Notificações do sistema** (manutenção, novos recursos)

## 🏗️ Arquitetura

### Backend
```
apps/backend/src/features/core/notifications/
├── __init__.py
├── router.py          # Endpoints REST
├── service.py         # Lógica de negócio
└── schemas.py         # Modelos Pydantic
```

### Frontend
```
apps/frontend/src/
├── services/notification-service.ts   # Cliente API
├── pages/app/notificacoes/           # Página de notificações
└── components/layout/app-header.tsx  # Dropdown de notificações
```

### Banco de Dados
Tabela: `notifications`
- `id` (UUID)
- `user_id` (UUID, referência para auth.users)
- `type` (VARCHAR: system, blog, feature, deadline, process, calculation)
- `title` (VARCHAR)
- `description` (TEXT, opcional)
- `metadata` (JSONB, dados adicionais)
- `read` (BOOLEAN)
- `read_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## 🔌 API Endpoints

### Usuários

**Listar notificações**
```http
GET /api/v1/notifications?unread_only=false
Authorization: Bearer <token>
```

**Marcar como lida**
```http
PATCH /api/v1/notifications/{id}/read
Authorization: Bearer <token>
```

**Marcar todas como lidas**
```http
PATCH /api/v1/notifications/read-all
Authorization: Bearer <token>
```

**Excluir notificação**
```http
DELETE /api/v1/notifications/{id}
Authorization: Bearer <token>
```

### Administradores

**Criar notificação**
```http
POST /api/v1/notifications/admin/notifications
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "system",
  "title": "Nova funcionalidade disponível",
  "description": "Agora você pode...",
  "user_id": null  // null = envia para todos
}
```

**Obter estatísticas**
```http
GET /api/v1/notifications/admin/notifications/stats
Authorization: Bearer <token>
```

**Listar todas as notificações (admin)**
```http
GET /api/v1/notifications/admin/notifications?page=1&page_size=50
Authorization: Bearer <token>
```

## 🎯 Notificações Automáticas

### 1. Prazos Próximos de Vencer

**Arquivo:** `apps/backend/src/features/office/deadlines/notifications.py`

**Como funciona:**
- Cron job diário verifica prazos
- Alerta em 7, 3 e 1 dia antes
- Evita notificações duplicadas

**Configuração:**
Ver [README de Deadlines](apps/backend/src/features/office/deadlines/README.md)

### 2. Processo Atualizado

**Arquivo:** `apps/backend/src/features/office/processes/notifications.py`

**Como usar:**
```python
from src.features.office.processes.notifications import notify_process_updated

# Após atualizar um processo
await notify_process_updated(
    user_id=str(user_id),
    process_id=str(process_id),
    process_number=process.process_number,
    update_type="status_change",
    description=f"Status alterado para {new_status}"
)
```

### 3. Cálculo Concluído

**Arquivo:** `apps/backend/src/features/calculators/notifications.py`

**Como usar:**
```python
from src.features.calculators.notifications import notify_calculation_completed

# Após completar um cálculo
await notify_calculation_completed(
    user_id=user_id,
    calculation_type="rescisao_trabalhista",
    result_summary=f"Valor total: R$ {result['total']}"
)
```

### 4. Novo Post no Blog

**Arquivo:** `apps/backend/src/features/core/blog/notifications.py`

**Como usar:**
```python
from src.features.core.blog.notifications import notify_new_blog_post

# Após publicar um post
await notify_new_blog_post(
    post_id=post_id,
    post_title=post.title,
    post_slug=post.slug
)
```

## 💻 Frontend - Uso

### Listar notificações
```typescript
import { notificationService } from '@/services/notification-service'

// Listar todas
const response = await notificationService.list(false)

// Apenas não lidas
const unread = await notificationService.list(true)
```

### Marcar como lida
```typescript
await notificationService.markAsRead(notificationId)
```

### Excluir
```typescript
await notificationService.delete(notificationId)
```

### Criar (admin)
```typescript
await notificationService.create({
  type: 'system',
  title: 'Manutenção programada',
  description: 'Sistema ficará fora do ar às 23h',
  user_id: undefined  // envia para todos
})
```

## 🎨 Ícones por Tipo

Cada tipo de notificação tem um ícone e cor específicos:

| Tipo | Ícone | Cor |
|------|-------|-----|
| `deadline` | AlertCircle | Vermelho (destructive) |
| `process` | FolderKanban | Azul |
| `calculation` | Calculator | Verde |
| `blog` | FileText | Roxo |
| `feature` | Sparkles | Amarelo |
| `system` | Info | Cinza |

## 🔐 Segurança

- Todas as rotas requerem autenticação
- Usuários só veem suas próprias notificações
- Rotas admin verificam role do usuário
- Validação de ownership ao marcar/excluir

## 📊 Painel Admin

Acesse em: `/admin?tab=notifications`

**Recursos:**
- Estatísticas (total, lidas, não lidas)
- Criar notificações em massa
- Histórico de notificações enviadas
- Modal de criação intuitivo

## ⚙️ Scheduler - Como Funciona

### Arquitetura Atual (Fase 1)

O scheduler está **acoplado no backend** usando APScheduler com MemoryJobStore:

```
┌─────────────────────────────────────┐
│         Backend API                 │
│  ┌──────────────────────────────┐   │
│  │      FastAPI App             │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │   APScheduler (interno)      │   │
│  │   - Check Deadlines (8AM)    │   │
│  │   - Future jobs...           │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Arquivos:**
- `src/core/scheduler.py` - Configuração do scheduler
- `src/main.py` - Inicia scheduler no lifespan do FastAPI

**⚠️ Importante:**
- Com MemoryJobStore, só funciona com **UMA instância** do backend
- Para múltiplas instâncias (horizontal scaling), migrar para RedisJobStore

### Futuro (Fase 2) - Worker Separado

Quando houver múltiplas instâncias, separar em serviço dedicado:

```
┌─────────────┐     ┌─────────────┐
│  Backend    │     │   Backend   │
│ Instance 1  │     │ Instance 2  │
└─────────────┘     └─────────────┘

       ┌─────────────────────┐
       │   Redis/Upstash     │
       │   (Job Lock)        │
       └──────────┬──────────┘
                  │
                  ▼
         ┌─────────────┐
         │   Worker    │
         │ (Scheduler) │
         └─────────────┘
```

## 🚀 Próximos Passos

### Melhorias Futuras
1. **Notificações push** (web push notifications)
2. **Preferências de notificação** (usuário escolhe o que quer receber)
3. **Notificações por email** (complementar às in-app)
4. **Agrupamento** (agrupar notificações similares)
5. **Filtros avançados** (por tipo, data, etc.)
6. **Notificações em tempo real** (WebSocket)

### Integrações Sugeridas
1. **WhatsApp** - Via API oficial do WhatsApp Business
2. **Telegram** - Bot de notificações
3. **Slack** - Para equipes
4. **SMS** - Para prazos críticos

## 📝 Exemplo Completo

### Criar notificação manual (via admin)

1. Acesse `/admin?tab=notifications`
2. Clique em "Criar Notificação"
3. Preencha:
   - Tipo: Sistema
   - Destinatários: Todos os usuários
   - Título: "Novo recurso disponível"
   - Descrição: "Agora você pode exportar relatórios em PDF"
4. Clique em "Enviar Notificação"

### Criar notificação programática

```python
# Em qualquer service do backend
from src.core.supabase import get_supabase

supabase = get_supabase()

# Notificar um usuário específico
supabase.table("notifications").insert({
    "user_id": "user-uuid-here",
    "type": "feature",
    "title": "Novo recurso para você!",
    "description": "Experimente a nova calculadora de honorários",
    "metadata": {
        "feature_url": "/calculadoras/honorarios",
        "version": "1.2.0"
    }
}).execute()

# Notificar todos os usuários
users = supabase.table("profiles").select("id").execute()
notifications = [
    {
        "user_id": user["id"],
        "type": "system",
        "title": "Manutenção programada",
        "description": "Sistema ficará indisponível dia 15/03 às 23h"
    }
    for user in users.data
]
supabase.table("notifications").insert(notifications).execute()
```

## 🐛 Troubleshooting

**Notificações não aparecem:**
- Verifique se a migration foi aplicada (`alembic upgrade head`)
- Confirme que o user_id está correto
- Verifique logs do backend

**Cron job não está rodando:**
- Confirme que o scheduler foi configurado
- Verifique logs do servidor
- Teste manualmente: `python scripts/check_deadlines.py`

**Notificações duplicadas:**
- O sistema verifica `metadata` para evitar duplicatas
- Para prazos, usa `notification_date` no metadata
- Certifique-se de incluir identificadores únicos no metadata

## 📚 Referências

- [Documentação do Supabase](https://supabase.com/docs)
- [FastAPI - Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [APScheduler](https://apscheduler.readthedocs.io/)
- [Web Push Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
