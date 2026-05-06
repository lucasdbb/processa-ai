# Processa AI

> ⚠️ **Projeto descontinuado.** O SaaS Processa AI foi encerrado e o código fonte foi liberado como open source para fins de estudo, referência e portfólio. Não há manutenção ativa, e nenhum suporte é fornecido.

Plataforma de tecnologia jurídica com gestão de escritório, assistência com IA, chat jurídico com RAG, calculadoras trabalhistas e blog especializado. Desenvolvida com **Vite 7 + React 19** (frontend) e **Python 3.13 + FastAPI** (backend), utilizando **Supabase** como banco de dados e autenticação.

## Estrutura do Monorepo

O projeto é dividido em três aplicações/serviços principais:

*   [**Frontend** (`apps/frontend/`)](./apps/frontend/): Vite 7 + React 19 + TypeScript (SPA)
*   [**Backend** (`apps/backend/`)](./apps/backend/): Python 3.13 + FastAPI
*   [**Worker** (`services/worker/`)](./services/worker/): Worker assíncrono para IA e geração de documentos

```text
processa-ai/
├── apps/
│   ├── frontend/           # Vite 7 + React 19 + TypeScript (SPA)
│   └── backend/            # Python 3.13 + FastAPI
├── services/
│   └── worker/             # Worker assíncrono (processamento de jobs IA + PDFs)
├── docker-compose.yml      # Orquestração de serviços
└── package.json            # Workspace raiz (npm)
```

## Funcionalidades

- **Gestão de Escritório**: Clientes, processos, serviços, documentos, honorários, prazos, andamentos (timeline), notas e calendário
- **Portal do Cliente**: Área read-only para clientes do escritório acompanharem seus processos (acesso via link de convite)
- **Ferramentas de IA**: Análise de CNIS, resumo de processos, reclamação trabalhista, scanner de petições — com upload de documentos, OCR e processamento assíncrono via worker
- **Chat Jurídico com RAG**: Chat com IA especializada em direito brasileiro, fundamentado em legislação via RAG taxonômico (pgvector), streaming SSE, cobrança por sessão
- **Calculadoras**: Rescisão trabalhista e simulação de aposentadoria, com geração de relatório PDF
- **Blog Jurídico**: Sistema completo com editor Markdown, categorias e admin dashboard
- **Billing**: Assinaturas via Stripe com sistema de créditos
- **Onboarding Seguro de Créditos**: Liberação de créditos de boas-vindas condicionada a CPF válido e telefone verificado por SMS
- **Autenticação**: Login, registro e OAuth via Supabase Auth
- **Newsletter e Suporte**: Inscrição em newsletter e formulário de contato
- **Notificações**: Sistema de notificações in-app
- **Materiais**: Biblioteca de materiais jurídicos para download

## Tecnologias

### Frontend (`apps/frontend`)
| Tecnologia | Versão/Detalhe |
|---|---|
| Vite | 7 |
| React | 19 |
| TypeScript | 5.9 (strict mode) |
| React Router | 7 (SPA, sem SSR) |
| React Query | Server state caching |
| Tailwind CSS | 4 (via `@tailwindcss/vite`) |
| shadcn/ui | Radix UI primitives |
| Zustand | 5 (estado global) |
| react-hook-form + Zod | Validação de formulários |
| Supabase JS | `@supabase/supabase-js` (client-side) |
| DOMPurify | Sanitização XSS |
| lucide-react | Ícones |
| Sonner | Toasts |
| PostHog | Analytics |

### Backend (`apps/backend`)
| Tecnologia | Versão/Detalhe |
|---|---|
| Python | 3.13 |
| FastAPI | Framework ASGI |
| Uvicorn | Servidor ASGI |
| Pydantic | 2 (validação com type safety) |
| psycopg | 3 (PostgreSQL async, connection pool) |
| PyJWT | Verificação de JWT Supabase |
| Supabase | Database + Auth + Storage |
| Stripe | Pagamentos e assinaturas |
| Google Gemini | Chat jurídico com RAG (streaming SSE) |
| Brevo | Envio de e-mails |
| uv | Package manager |
| Ruff | Linter e formatter |

### Worker (`services/worker`)
| Tecnologia | Uso |
|---|---|
| Python 3.13 | Runtime |
| PostgreSQL queue | Consumo de jobs (`FOR UPDATE SKIP LOCKED`) |
| Google Gemini (async) | LLM para análises (Pro) + tarefas leves (Flash Lite) |
| Google Embeddings | `gemini-embedding-001` para RAG |
| Supabase Storage | Acesso a documentos |
| OCR | Extração de texto de documentos |

## Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/marcelogcardozo/processa-ai.git
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

**Worker:**
```bash
cd services/worker
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
SUPABASE_JWT_SECRET=seu-jwt-secret
INTERNAL_TOKEN=seu-token-interno
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
ENCRYPTION_KEY=chave-fernet-base64
GEMINI_API_KEY=...
BREVO_API_KEY=xkeysib-...
BREVO_FROM=email@dominio.com
```

**Worker** (`services/worker/.env`):
```env
DATABASE_URL=postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
GEMINI_API_KEY=...
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
- Worker: processamento em background (health check na porta 8001)

#### Opção B: Desenvolvimento Local

**Frontend (porta 5173):**
```bash
cd apps/frontend && npm run dev
```

**Backend (porta 8000):**
```bash
cd apps/backend && uv run uvicorn src.main:app --reload
```

**Worker (porta 8001 para health check):**
```bash
cd services/worker && uv run python -m src.main
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

### Worker
```bash
cd services/worker
uv run python -m src.main              # Iniciar worker
```

## Rotas da Aplicação

### Frontend (React Router v7)

Todas as páginas do app são lazy-loaded com `React.lazy()` + `Suspense`.

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
| `/transparencia-ia` | Transparência sobre uso de IA |
| `/auth/callback` | Callback OAuth/magic-link |

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
| `/app/ia-juridica` | Chat jurídico com RAG |
| `/app/calculadoras` | Calculadoras trabalhistas |
| `/app/calculadoras/:calculatorId` | Calculadora específica |
| `/app/assinatura` | Gerenciar assinatura |
| `/app/notificacoes` | Central de notificações |
| `/app/configuracoes` | Configurações do usuário |
| `/app/ajuda` | Central de ajuda |
| `/app/materiais` | Materiais jurídicos |

**Portal do Cliente:**
| Rota | Descrição |
|---|---|
| `/portal/ativar` | Ativação de conta (via link de convite) |
| `/portal` | Dashboard do cliente |

**Admin (requer role admin/author):**
| Rota | Descrição |
|---|---|
| `/admin` | Dashboard administrativo |
| `/admin/posts/novo` | Criar novo post |
| `/admin/posts/:id` | Editar post |

### Backend API

Todas as rotas sob o prefixo `/api/v1`. Documentação interativa: http://localhost:8000/docs

**Core:**
| Prefixo | Módulo |
|---|---|
| `/api/v1/profiles` (alias `/api/v1/users`) | Perfis de usuário |
| `/api/v1/dashboard` | Dashboard analytics |
| `/api/v1/blog` | Posts, categorias |
| `/api/v1/newsletter` | Inscrição/cancelamento |
| `/api/v1/support` | Formulário de contato |
| `/api/v1/feedback` | Feedback de usuários |
| `/api/v1/materials` | Materiais para download |
| `/api/v1/plans` | Planos disponíveis |
| `/api/v1/notifications` | Notificações |
| `/api/v1/notification-logs` | Logs de notificações |
| `/api/v1/storage` | Upload via signed URL |
| `/api/v1/documents` | Documentos gerais |

**Billing:**
| Prefixo | Módulo |
|---|---|
| `/api/v1/billing/subscriptions` | Assinaturas Stripe |
| `/api/v1/billing/webhooks` | Webhooks Stripe |
| `/api/v1/credits` | Sistema de créditos + validação de telefone por SMS no onboarding |

**Fluxo de créditos de boas-vindas (antiabuso):**
- O usuário solicita código SMS em `POST /api/v1/credits/send-phone-code`
- O usuário valida o código em `POST /api/v1/credits/verify-phone-code`
- O resgate em `POST /api/v1/credits/claim-welcome` exige CPF válido e telefone previamente verificado
- Telefones verificados são únicos por conta para reduzir abuso de créditos grátis

**Office (Gestão de Escritório):**
| Prefixo | Módulo |
|---|---|
| `/api/v1/office/clients` | Clientes |
| `/api/v1/office/processes` | Processos |
| `/api/v1/office/documents` | Documentos |
| `/api/v1/office/timeline` | Andamentos |
| `/api/v1/office/deadlines` | Prazos |
| `/api/v1/office/fees` | Honorários |
| `/api/v1/office/fee-payments` | Pagamentos de honorários |
| `/api/v1/office/notes` | Anotações |
| `/api/v1/office/services` | Serviços |
| `/api/v1/office/calendar` | Calendário |

**IA e Outros:**
| Prefixo | Módulo |
|---|---|
| `/api/v1/ai` | Ferramentas de IA + Chat jurídico (SSE streaming) |
| `/api/v1/calculators` | Calculadoras trabalhistas |
| `/api/v1/jobs` | Status e listagem de jobs assíncronos |
| `/api/v1/portal` | Portal do cliente (read-only) |

## Arquitetura

### Frontend (Vite + React SPA)

- **SPA puro** (sem SSR) com Vite 7 como bundler
- **React Router v7** para roteamento client-side
- **Feature-first architecture**: código organizado por domínio
- **Zustand** para estado global (auth, billing, créditos)
- **React Query** para server state caching (5 min staleTime)
- **Supabase JS** para autenticação client-side (sessão via localStorage + JWT)
- **Route guards** (AuthGuard, AdminGuard, PortalGuard, RequirePlan) para proteção de rotas
- **Lazy loading** em todas as páginas autenticadas com `React.lazy()` + `Suspense`

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
│   ├── calculators/  # Calculadoras
│   └── onboarding/   # Tour/onboarding
├── pages/            # Páginas (componentes de rota)
│   ├── app/          # Páginas autenticadas (lazy-loaded)
│   ├── admin/        # Tabs do admin (lazy-loaded)
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
- **Pydantic 2** para validação de request/response
- **psycopg 3** para queries PostgreSQL diretas (connection pool, sem ORM)
- **JWT middleware**: verifica assinatura do token Supabase, extrai `user_id` e `role` no `request.state`
- **Identidade server-side**: endpoints usam `Depends(get_user_id)` — nunca aceitam `user_id` do frontend
- **Supabase Storage** para arquivos (upload via signed URL)
- **PostgreSQL queue** para enfileirar jobs para o worker

```
apps/backend/src/
├── main.py           # Entry point FastAPI
├── core/             # Config, DB pool, logging, Supabase client, middleware, auth
├── api/              # Router principal (agrega todos os routers)
├── features/
│   ├── core/         # Blog, profiles, storage, newsletter, support, documents, etc.
│   ├── office/       # Clients, processes, documents, timeline, fees, etc.
│   ├── billing/      # Subscriptions, webhooks, credits
│   ├── ai/           # Ferramentas de IA + chat jurídico (chat/ submodule com RAG)
│   ├── calculators/  # Calculadoras trabalhistas
│   └── portal/       # Portal do cliente (read-only)
└── shared/           # Database utilities
```

### Worker (Processamento Assíncrono)

- Serviço independente que consome jobs de uma **fila PostgreSQL** (`FOR UPDATE SKIP LOCKED`)
- Dois loops concorrentes: **AI worker** (jobs pesados) + **translation worker** (jobs rápidos)
- **Google Gemini** (async SDK) como LLM principal para análises e embeddings
- Pipeline: download do documento → OCR → envio ao LLM → salvar resultado no DB
- Geração de PDFs para calculadoras (rescisão, aposentadoria)
- Ingestão RAG: processamento de documentos para base de conhecimento
- **Health check HTTP** na porta 8001
- **Graceful shutdown** via signal handlers (SIGTERM/SIGINT)
- **Job timeout**: 600 segundos por job
- Escalável horizontalmente (múltiplas réplicas)

```
services/worker/src/
├── main.py           # Loops principais (AI worker + translation worker + health server)
├── core/             # Config, DB, queue, Gemini LLM, OCR, storage, embeddings
└── handlers/         # Pipeline de processamento, prompts, RAG ingest, reports
```

## Docker

O projeto inclui Docker Compose com 3 serviços:

| Serviço | Porta | Descrição |
|---|---|---|
| `frontend` | 5173 → 80 | Vite/React (Nginx em produção) |
| `backend` | 8000 | FastAPI (Uvicorn) |
| `worker` | 8001 (health) | Processamento assíncrono de jobs |

Todos os serviços possuem healthchecks, `restart: unless-stopped`, e o frontend espera o backend ficar healthy antes de iniciar.

```bash
docker-compose up --build       # Build e iniciar
docker-compose up -d            # Rodar em background
docker-compose down             # Parar serviços
docker-compose logs -f backend  # Ver logs de um serviço
```

## Deploy

### Frontend
```bash
cd apps/frontend && npm run build
```

Variáveis de ambiente necessárias:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL`
- `VITE_INTERNAL_TOKEN`

### Backend

Start command:
```bash
uv run uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

Variáveis de ambiente obrigatórias em produção:
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET` (verificação de JWT)
- `INTERNAL_TOKEN` (autenticação frontend→backend)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `GEMINI_API_KEY`

### Worker

Start command:
```bash
uv run python -m src.main
```

Variáveis de ambiente obrigatórias:
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

## Licença

Este projeto é distribuído sob a licença **GNU Affero General Public License v3.0 (AGPL-3.0)**. Veja o arquivo [LICENSE](./LICENSE) para o texto completo.

A AGPL-3.0 é uma licença *copyleft forte*: qualquer pessoa pode usar, modificar e até oferecer este software como serviço (SaaS), **mas é obrigada a disponibilizar publicamente o código-fonte completo de qualquer modificação ou derivação**, incluindo as rodadas em servidores acessíveis ao público.
