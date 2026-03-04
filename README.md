# Processa AI

Plataforma de tecnologia jurídica com gestão de escritório, assistência com IA, calculadoras trabalhistas e blog especializado. Desenvolvida com **Vite 7 + React 19** (frontend) e **Python 3.13 + FastAPI** (backend), utilizando **Supabase** como banco de dados e autenticação.

## Estrutura do Monorepo

```
processa-ai/
├── apps/
│   ├── frontend/           # Vite 7 + React 19 + TypeScript (SPA)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── backend/            # Python 3.13 + FastAPI
│       ├── src/
│       ├── Dockerfile
│       └── pyproject.toml
├── services/
│   └── worker/             # Worker assíncrono (processamento de jobs IA)
│       ├── src/
│       ├── Dockerfile
│       └── pyproject.toml
├── docker-compose.yml      # Orquestração de serviços (dev)
├── docker-compose.prod.yml # Override para produção
└── package.json            # Workspace raiz (npm)
```

## Funcionalidades

- **Gestão de Escritório (Office)**: Clientes, processos, serviços, documentos, honorários, prazos, andamentos (timeline) e calendário
- **Portal do Cliente**: Área de acesso para clientes do escritório acompanharem seus processos
- **Assistente IA**: Ferramentas de IA jurídica com upload de documentos, OCR e processamento assíncrono via worker
- **Calculadoras Trabalhistas**: Cálculos de rescisão e simulações previdenciárias
- **Blog Jurídico**: Sistema completo com editor Markdown, categorias e admin dashboard
- **Billing**: Assinaturas via Stripe com sistema de créditos
- **Autenticação**: Login, registro e recuperação de senha via Supabase Auth
- **Newsletter e Suporte**: Inscrição em newsletter e formulário de contato
- **Notificações**: Sistema de notificações in-app
- **Materiais**: Biblioteca de materiais jurídicos para download

## Tecnologias

### Frontend (`apps/frontend`)
| Tecnologia | Versão |
|---|---|
| Vite | 7 |
| React | 19 |
| TypeScript | 5.9 |
| React Router | 7 (SPA, sem SSR) |
| Tailwind CSS | 4 |
| shadcn/ui | Radix UI primitives |
| Zustand | 5 |
| react-hook-form + Zod | Validação de formulários |
| Supabase JS | `@supabase/supabase-js` (client-side) |
| lucide-react | Ícones |
| Sonner | Toasts |
| PostHog | Analytics |

### Backend (`apps/backend`)
| Tecnologia | Versão |
|---|---|
| Python | 3.13 |
| FastAPI | Framework ASGI |
| Uvicorn | Servidor ASGI |
| Pydantic | 2.10 (validação) |
| psycopg | 3 (PostgreSQL async) |
| Supabase | Database + Auth + Storage |
| Stripe | Pagamentos e assinaturas |
| SendGrid | Envio de e-mails |
| Redis | Fila de jobs (via `redis-py`) |
| uv | Package manager |
| Ruff | Linter e formatter |

### Worker (`services/worker`)
| Tecnologia | Uso |
|---|---|
| Python 3.13 | Runtime |
| Redis (BLPOP) | Consumo da fila de jobs |
| OpenAI / Mistral | Providers de LLM |
| Supabase Storage | Acesso a documentos |
| OCR (Tesseract/pdf) | Extração de texto de documentos |

## Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/processa-ai.git
cd processa-ai
```

### 2. Instale as dependências

**Frontend:**
```bash
cd apps/frontend
npm install
```

**Backend:**
```bash
cd apps/backend
pip install uv   # se não tiver
uv sync
```

### 3. Configure as variáveis de ambiente

**Frontend** (`apps/frontend/.env`):
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_BACKEND_URL=http://localhost:8000
VITE_INTERNAL_TOKEN=seu-token-interno
```

**Backend** (`apps/backend/.env`):
```env
DATABASE_URL=postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
INTERNAL_TOKEN=seu-token-interno
REDIS_URL=redis://localhost:6379/0
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ENCRYPTION_KEY=chave-fernet-base64
SENDGRID_API_KEY=SG....
SENDGRID_FROM=email@dominio.com
```

### 4. Inicie o desenvolvimento

#### Opção A: Docker Compose
```bash
cp .env.example .env
# Edite .env com suas credenciais
docker-compose up --build
```

Serviços:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Worker: processamento em background
- Redis: fila de jobs

#### Opção B: Desenvolvimento Local

**Frontend (porta 5173):**
```bash
cd apps/frontend && npm run dev
```

**Backend (porta 8000):**
```bash
cd apps/backend && uv run uvicorn src.main:app --reload
```

## Comandos de Desenvolvimento

### Frontend
```bash
cd apps/frontend
npm run dev          # Servidor de desenvolvimento (porta 5173)
npm run build        # Build de produção
npm run preview      # Preview do build
npm run lint         # ESLint
```

### Backend
```bash
cd apps/backend
uv run uvicorn src.main:app --reload   # Servidor (porta 8000)
uv run pytest                          # Testes
uv run ruff check src/                 # Linting
uv run ruff format src/                # Formatação
```

## Rotas da Aplicação

### Frontend (React Router v7)

**Públicas:**
| Rota | Descrição |
|---|---|
| `/` | Landing page |
| `/blog` | Lista de posts |
| `/blog/:id` | Post individual |
| `/planos` | Planos e preços |
| `/sobre` | Sobre a plataforma |
| `/materiais` | Biblioteca de materiais |
| `/termos` | Termos de uso |
| `/privacidade` | Política de privacidade |

**App (requer autenticação):**
| Rota | Descrição |
|---|---|
| `/app` | Dashboard |
| `/app/clientes` | Gestão de clientes |
| `/app/clientes/:id` | Detalhe do cliente |
| `/app/processos` | Gestão de processos |
| `/app/processos/:id` | Detalhe do processo (documentos, andamentos, honorários) |
| `/app/servicos` | Gestão de serviços |
| `/app/servicos/:id` | Detalhe do serviço |
| `/app/calendario` | Calendário de prazos e compromissos |
| `/app/documentos` | Biblioteca de documentos |
| `/app/ia` | Hub de ferramentas de IA |
| `/app/ia/:toolId` | Ferramenta de IA específica |
| `/app/calculadoras` | Calculadoras trabalhistas |
| `/app/assinatura` | Gerenciar assinatura |
| `/app/notificacoes` | Central de notificações |
| `/app/configuracoes` | Configurações do usuário |
| `/app/ajuda` | Central de ajuda |

**Portal do Cliente:**
| Rota | Descrição |
|---|---|
| `/portal/ativar` | Ativação de conta do portal (via link de convite) |
| `/portal` | Dashboard do cliente |

**Admin (requer role admin/author):**
| Rota | Descrição |
|---|---|
| `/admin` | Dashboard administrativo |
| `/admin/posts/novo` | Criar novo post |
| `/admin/posts/:id` | Editar post |

### Backend API

Todas as rotas sob o prefixo `/api`.

**Core:**
| Prefixo | Módulo |
|---|---|
| `/api/profiles` (alias `/api/users`) | Perfis de usuário |
| `/api/dashboard` | Dashboard analytics |
| `/api/blog` | Posts, categorias |
| `/api/newsletter` | Inscrição/cancelamento |
| `/api/support` | Formulário de contato |
| `/api/feedback` | Feedback de usuários |
| `/api/materials` | Materiais para download |
| `/api/plans` | Planos disponíveis |
| `/api/notifications` | Notificações |
| `/api/storage` | Upload via signed URL |

**Billing:**
| Prefixo | Módulo |
|---|---|
| `/api/billing/subscriptions` | Assinaturas Stripe |
| `/api/billing/webhooks` | Webhooks Stripe |
| `/api/credits` | Sistema de créditos |

**Office (Gestão de Escritório):**
| Prefixo | Módulo |
|---|---|
| `/api/office/clients` | Clientes |
| `/api/office/processes` | Processos |
| `/api/office/documents` | Documentos |
| `/api/office/timeline` | Andamentos |
| `/api/office/deadlines` | Prazos |
| `/api/office/fees` | Honorários |
| `/api/office/fee-payments` | Pagamentos de honorários |
| `/api/office/notes` | Anotações |
| `/api/office/services` | Serviços |
| `/api/office/calendar` | Calendário |

**Outros:**
| Prefixo | Módulo |
|---|---|
| `/api/ai` | Ferramentas de IA |
| `/api/calculators` | Calculadoras trabalhistas |
| `/api/portal` | Portal do cliente (read-only) |

Documentação interativa: http://localhost:8000/docs

## Arquitetura

### Frontend (Vite + React SPA)

- **SPA puro** (sem SSR) com Vite 7 como bundler
- **React Router v7** para roteamento client-side
- **Feature-first architecture**: código organizado por domínio
- **Zustand** para estado global (auth, billing, créditos)
- **Supabase JS** para autenticação client-side (sessão via localStorage + JWT)
- **Route guards** (AuthGuard, AdminGuard, PortalGuard, RequirePlan) para proteção de rotas
- **Lazy loading** para páginas menos acessadas (admin, calculadoras, IA)

```
apps/frontend/src/
├── components/       # Componentes reutilizáveis
│   ├── ui/           # shadcn/ui
│   ├── layout/       # Header, Footer, AppLayout, RootLayout, Sidebar
│   ├── auth/         # AuthGuard, AdminGuard, PortalGuard
│   └── forms/        # Formulários compartilhados
├── features/         # Módulos por domínio
│   ├── auth/         # Autenticação (store, hooks)
│   ├── ai/           # IA (hooks, componentes)
│   ├── blog/         # Blog
│   └── ...
├── pages/            # Páginas (componentes de rota)
│   ├── app/          # Páginas autenticadas
│   ├── admin/        # Tabs do admin
│   └── portal/       # Páginas do portal
├── services/         # Serviços de API
├── stores/           # Zustand stores
├── hooks/            # Custom hooks compartilhados
├── lib/              # Bibliotecas e utils (supabase, analytics, fetch)
└── router.tsx        # Definição de rotas
```

### Backend (FastAPI)

- **Feature-based modules**: cada feature com `router.py`, `schemas.py`, `service.py`
- **Async-first**: todas as operações de I/O são assíncronas
- **Pydantic** para validação de request/response
- **psycopg 3** para queries PostgreSQL diretas (connection pool)
- **Supabase Storage** para arquivos (upload via signed URL)
- **Redis** como fila de jobs para o worker

```
apps/backend/src/
├── main.py           # Entry point FastAPI
├── core/             # Config, DB pool, logging, Supabase client
├── api/              # Router principal (agrega todos os routers)
├── features/
│   ├── core/         # Blog, profiles, storage, newsletter, support, etc.
│   ├── office/       # Clients, processes, documents, timeline, fees, etc.
│   ├── billing/      # Subscriptions, webhooks, credits
│   ├── ai/           # Ferramentas de IA (enqueue jobs)
│   ├── calculators/  # Calculadoras trabalhistas
│   └── portal/       # Portal do cliente (read-only)
└── shared/           # Database, auth dependencies
```

### Worker (Processamento Assíncrono)

- Serviço independente que consome jobs da fila Redis
- Pipeline: download do documento → OCR → envio ao LLM → salvar resultado
- Suporta múltiplos providers (OpenAI, Mistral)
- Escalável horizontalmente (múltiplas réplicas)

```
services/worker/src/
├── main.py           # Loop principal (BLPOP Redis)
├── core/             # Config, DB, queue, LLM, OCR, storage
└── handlers/         # Pipeline de processamento + prompts por tipo de job
```

## Docker

O projeto inclui Docker Compose com 4 serviços:

| Serviço | Porta | Descrição |
|---|---|---|
| `frontend` | 5173 | Vite/React (nginx em produção) |
| `backend` | 8000 | FastAPI (Uvicorn) |
| `worker` | — | Processamento assíncrono de jobs IA |
| `redis` | 6379 | Fila de jobs e cache |

```bash
docker-compose up --build       # Build e iniciar
docker-compose up -d            # Rodar em background
docker-compose down             # Parar serviços
docker-compose logs -f backend  # Ver logs de um serviço
```

## Deploy

### Frontend (Vercel)
```bash
cd apps/frontend && npm run build
vercel --prod
```

Variáveis de ambiente:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL`
- `VITE_INTERNAL_TOKEN`

### Backend (Railway/Render)

Start command:
```bash
uv run uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

## Licença

Este projeto está sob a licença MIT.
