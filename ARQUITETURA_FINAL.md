# Arquitetura Final - Processa AI

**Versão:** 1.0
**Data:** 2025-11-03
**Status:** Ready for Implementation

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Decisões Tecnológicas](#2-decisões-tecnológicas)
3. [Arquitetura de Serviços](#3-arquitetura-de-serviços)
4. [Estrutura do Frontend](#4-estrutura-do-frontend)
5. [Estrutura do Backend](#5-estrutura-do-backend)
6. [Estrutura do Monorepo](#6-estrutura-do-monorepo)
7. [Banco de Dados](#7-banco-de-dados)
8. [Autenticação e Autorização](#8-autenticação-e-autorização)
9. [State Management](#9-state-management)
10. [Comunicação Entre Serviços](#10-comunicação-entre-serviços)
11. [Segurança](#11-segurança)
12. [Performance e Caching](#12-performance-e-caching)
13. [Observabilidade](#13-observabilidade)
14. [Deploy e CI/CD](#14-deploy-e-cicd)
15. [Análise de Custos](#15-análise-de-custos)
16. [Roadmap de Implementação](#16-roadmap-de-implementação)

---

## 1. Visão Geral

### 1.1 Contexto

**Processa AI** é uma plataforma legal-tech com três funcionalidades principais:
- **Blog/Feed Jurídico**: CMS para administradores criarem posts + leitura pública
- **AI Chat**: Assistente IA treinado com streaming para advogados
- **Calculadoras Jurídicas**: Ferramentas de cálculo (previdência, rescisão trabalhista)

### 1.2 Estado Atual

**Stack Atual:**
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS (~8.169 LOC)
- Backend: Vercel Serverless Functions + Supabase (~1.209 LOC)
- Estrutura: Monorepo (apps/web + apps/api + packages/types)

**Pontos Fortes:**
- ✅ Segurança bem implementada (score 9.0/10)
- ✅ TypeScript end-to-end
- ✅ Arquitetura organizada

**Problemas Identificados:**
- ❌ Vercel Functions com timeout (60s Pro) - inadequado para AI streaming
- ❌ State management via prop drilling
- ❌ Sem testes automatizados
- ❌ Sem monitoramento de produção
- ❌ Background jobs não suportados nativamente

### 1.3 Objetivos da Nova Arquitetura

1. **Eliminar timeouts** para AI Chat streaming longo (>60s)
2. **Suportar background jobs** para cálculos complexos
3. **Melhorar state management** eliminando prop drilling
4. **Reduzir custos** operacionais (~54% economia)
5. **Melhorar performance** com latência <1ms no banco de dados
6. **Escalabilidade independente** de cada serviço
7. **Observabilidade completa** desde o dia 1

---

## 2. Decisões Tecnológicas

### 2.1 Platform: Railway

**Escolhido:** Railway Hobby Plan ($5/mês base)

**Justificativa:**
- ✅ Sem timeouts (long-lived processes)
- ✅ WebSocket/SSE nativo para AI streaming
- ✅ Background jobs (BullMQ em containers)
- ✅ Docker first-class support
- ✅ Internal network <1ms latência
- ✅ PostgreSQL + Redis templates FREE
- ✅ Custos previsíveis (não por invocação)

**Quando Railway NÃO faz sentido:**
- Global Edge Computing extremo (Vercel Edge é melhor)
- Tráfego extremamente variável (serverless escala a zero)
- Zero DevOps knowledge (Vercel abstrai tudo)

### 2.2 Database & Auth: Supabase

**Escolhido:** Supabase (PostgreSQL + Auth + Storage)

**Justificativa:**
- ✅ PostgreSQL managed com backups automáticos
- ✅ Auth built-in (JWT, OAuth, Magic Links)
- ✅ Storage integrado (imagens, uploads)
- ✅ Row Level Security (RLS) nativo
- ✅ Realtime subscriptions (PostgreSQL)
- ✅ REST API auto-gerada
- ✅ Free tier generoso (500MB DB, 1GB storage)

**Trade-offs:**
- ⚠️ Latência cross-region (50-200ms vs <1ms Railway interno)
- ⚠️ Vendor lock-in parcial (Supabase SDK)
- ✅ Mitigação: Auth vale o trade-off, usar SQL direto quando possível

### 2.3 Frontend Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Framework** | React 19 | Já implementado, React Compiler |
| **Build** | Vite 7.x | Build rápido, HMR excelente |
| **Routing** | React Router DOM 7.x | Standard de facto |
| **State (Client)** | Zustand 5.x | Simples, performático, <1KB |
| **State (Server)** | React Query 5.x | Cache inteligente, invalidação automática |
| **Forms** | React Hook Form 7.x | Performance, validação |
| **Validation** | Zod 3.x | Compartilhado frontend/backend |
| **Styling** | Tailwind CSS 3.x | Utility-first, rápido |
| **UI Components** | Custom (CVA) | Controle total, lightweight |
| **Icons** | Lucide React | Moderno, tree-shakeable |
| **HTTP Client** | Fetch API | Nativo, sem deps extras |

### 2.4 Backend Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Runtime** | Node.js 20.x | LTS, stable |
| **Framework** | Express 4.x | Maduro, flexível |
| **ORM** | Drizzle ORM 0.29.x | Type-safe, performático, serverless-friendly |
| **Database** | PostgreSQL 16.x | Via Supabase |
| **Auth** | Supabase Auth | Built-in JWT, OAuth, Magic Links |
| **Storage** | Supabase Storage | S3-compatible, integrado |
| **Cache** | Redis (Railway) | Cache + BullMQ queues |
| **Job Queue** | BullMQ 5.x | Robusto, Redis-based |
| **WebSocket** | ws 8.x | Lightweight para AI Chat |
| **AI** | OpenAI SDK 4.x | Official SDK |
| **Validation** | Zod 3.x | Type-safe schemas |
| **Logging** | Pino 8.x | Fast, structured |
| **Error Tracking** | Sentry 7.x | Industry standard |
| **Security** | Helmet 7.x | Security headers |

### 2.5 DevOps Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Container** | Docker | Railway first-class support |
| **Orchestration** | Railway | Simples, managed |
| **CI/CD** | GitHub Actions | Native, gratuito |
| **Monorepo** | npm workspaces | Nativo, zero config |
| **Migrations** | Drizzle Kit | Type-safe SQL migrations |
| **Testing** | Vitest | Vite-native, rápido |
| **E2E** | Playwright | Cross-browser, robusto |

---

## 3. Arquitetura de Serviços

### 3.1 Diagrama de Alto Nível

```
┌────────────────────────────────────────────────────────────────────┐
│                    RAILWAY PROJECT: processa-ai                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐         ┌──────────────────┐                 │
│  │  web-frontend   │────────▶│   api-backend    │                 │
│  │  Nginx + React  │  HTTP   │   Express REST   │                 │
│  │  Port: 80       │         │   Port: 3000     │                 │
│  └─────────────────┘         └────────┬─────────┘                 │
│                                        │                            │
│                          ┌─────────────┼─────────────┐             │
│                          ▼             ▼             ▼             │
│                   ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│                   │ ai-chat  │  │calculator│  │  Redis   │       │
│                   │ Service  │  │ Service  │  │  Cache   │       │
│                   │Port: 3001│  │Port: 3002│  │Port: 6379│       │
│                   └────┬─────┘  └────┬─────┘  └──────────┘       │
│                        │             │                             │
│                        └─────────────┘                             │
│                                │                                   │
│  Private Network: Railway Internal DNS                            │
└───────────────────────────────┼───────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │      SUPABASE         │
                    │  ┌─────────────────┐  │
                    │  │   PostgreSQL    │  │
                    │  │   (Database)    │  │
                    │  └─────────────────┘  │
                    │  ┌─────────────────┐  │
                    │  │   Auth Service  │  │
                    │  │ (JWT + OAuth)   │  │
                    │  └─────────────────┘  │
                    │  ┌─────────────────┐  │
                    │  │     Storage     │  │
                    │  │ (Images/Files)  │  │
                    │  └─────────────────┘  │
                    └───────────────────────┘
```

### 3.2 Justificativa para Separação de Serviços

**API Backend (Orquestrador Central):**
- Workload: I/O-bound (DB queries, proxying)
- Latência: Baixa (<50ms)
- Responsabilidades: Autenticação, Blog CRUD, User management, Orquestração
- Recursos: 0.5 vCPU, 512MB RAM

**AI Chat Service (Separado):**
- Workload: I/O-bound (OpenAI API calls)
- Latência: Variável (2-30s por resposta)
- Padrão: WebSocket/SSE (long-lived connections)
- Justificativa: Isolar latência da OpenAI, evitar timeouts
- Recursos: 0.5 vCPU, 512MB RAM

**Calculator Service (Separado):**
- Workload: CPU-bound (cálculos complexos)
- Latência: Previsível (100-500ms)
- Padrão: Job queue (BullMQ)
- Justificativa: Background processing, não bloqueia API
- Recursos: 0.5 vCPU, 512MB RAM

**Estratégia de Escalabilidade:**

**Opção A: Container Único (MVP - 0-1k usuários)**
- Custo: $5.38/mês
- Simplicidade: Alta
- API + AI Chat + Calculator integrados em um container
- Ideal para validação inicial

**Opção B: 3 Containers Separados (Produção - >1k usuários)**
- Custo: $5.63/mês (+$0.25/mês)
- Escalabilidade: Alta
- Serviços isolados, escaláveis independentemente
- Migrar quando: Tráfego >1000 req/min, AI causando bloqueios, jobs atrasando

---

## 4. Estrutura do Frontend

### 4.1 Arquitetura Feature-Based

**Organização por domínio de negócio:**

```
apps/web/src/
├── features/
│   ├── auth/
│   │   ├── components/      # LoginModal, UserMenu, RegisterForm
│   │   ├── hooks/           # useAuth, useSession, useSupabaseAuth
│   │   ├── stores/          # authStore (Zustand)
│   │   ├── services/        # authService (Supabase client)
│   │   └── types/           # User, Session types
│   │
│   ├── blog/
│   │   ├── components/      # PostCard, PostList, PostEditor
│   │   ├── hooks/           # useBlogs, useCreatePost, useBlogCache
│   │   ├── services/        # blogService
│   │   └── types/           # Post, Category types
│   │
│   ├── ai-chat/
│   │   ├── components/      # ChatWindow, MessageBubble, StreamingIndicator
│   │   ├── hooks/           # useChat, useStreamResponse, useChatHistory
│   │   ├── services/        # chatService (WebSocket)
│   │   └── types/           # Message, ChatSession types
│   │
│   └── calculators/
│       ├── components/      # CalculatorForm, ResultView, HistoryList
│       ├── hooks/           # useCalculator, useCalculationHistory
│       ├── services/        # calculatorService
│       └── types/           # Calculation types
│
├── shared/
│   ├── components/          # Button, Input, Card, Modal, Loading
│   ├── hooks/               # useDebounce, useLocalStorage, useMediaQuery
│   ├── utils/               # formatters, validators, helpers
│   └── types/               # Common types
│
├── core/
│   ├── api/                 # API client (Supabase + Railway services)
│   ├── router/              # Route configuration (React Router)
│   ├── providers/           # React Query, Theme, Supabase Provider
│   └── config/              # App configuration, constants
│
└── app/
    ├── App.tsx              # Root component
    └── main.tsx             # Entry point
```

### 4.2 Vantagens da Arquitetura Feature-Based

**Colocação (Colocation):**
- Código relacionado agrupado junto
- Fácil encontrar e modificar features

**Escalabilidade:**
- Adicionar novas features sem afetar existentes
- Tree-shaking elimina código não usado

**Manutenibilidade:**
- Separação clara de responsabilidades
- Testes isolados por feature

**Ownership:**
- Times podem "possuir" features específicas
- Reduz conflitos de merge

### 4.3 Roteamento

**Estrutura de Rotas:**

- `/` - Landing page (pública)
- `/dashboard` - Dashboard do usuário (protegida)
- `/blog` - Lista de posts (pública)
- `/blog/:slug` - Post individual (público)
- `/ferramentas` - AI Chat (protegida)
- `/calculadoras` - Calculadoras (protegida)
- `/admin` - Painel admin (admin only)

**Proteção de Rotas:**

- `<ProtectedRoute>` - Requer autenticação
- `<AdminRoute>` - Requer role admin
- Lazy loading de componentes pesados
- Prefetch em hover para navegação instantânea

### 4.4 Componentes UI (Design System)

**Padrão:** CVA (class-variance-authority) + Tailwind

**Componentes Base:**
- Button (variants: primary, secondary, ghost, danger)
- Input (types: text, email, password, number)
- Card (variants: default, outlined, elevated)
- Modal (sizes: sm, md, lg, fullscreen)
- Loading (spinners, skeletons)
- Toast (success, error, warning, info)

**Organização:**
- Cada componente em pasta própria
- Co-located tests
- Storybook para documentação (futuro)

---

## 5. Estrutura do Backend

### 5.1 Arquitetura Domain-Driven Design Lite

**Organização por camadas:**

```
apps/api/
├── src/
│   ├── server.ts            # Entry point
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── handlers/    # HTTP handlers (thin layer)
│   │   │   ├── use-cases/   # Business logic
│   │   │   ├── repositories/# Data access
│   │   │   ├── domain/      # Entities, value objects
│   │   │   └── types/       # TypeScript types
│   │   │
│   │   ├── blog/
│   │   │   ├── handlers/
│   │   │   ├── use-cases/
│   │   │   ├── repositories/
│   │   │   └── types/
│   │   │
│   │   ├── ai-chat/
│   │   │   ├── handlers/
│   │   │   ├── use-cases/
│   │   │   ├── services/    # OpenAI integration
│   │   │   └── types/
│   │   │
│   │   └── calculators/
│   │       ├── handlers/
│   │       ├── use-cases/
│   │       ├── services/    # Calculation logic
│   │       └── types/
│   │
│   ├── shared/
│   │   ├── middleware/      # Auth, CORS, Rate limit, Error handler
│   │   ├── errors/          # Custom error classes
│   │   ├── validation/      # Zod schemas
│   │   └── utils/           # Helpers, formatters
│   │
│   ├── infrastructure/
│   │   ├── database/        # Drizzle client, schema
│   │   ├── cache/           # Redis client
│   │   ├── supabase/        # Supabase client (Auth + Storage)
│   │   └── external/        # OpenAI, outros APIs
│   │
│   └── config/
│       ├── env.ts           # Environment variables
│       ├── database.ts      # DB configuration
│       └── redis.ts         # Redis configuration
```

### 5.2 Separação de Responsabilidades

**Handlers (Thin Layer):**
- Recebem requisição HTTP
- Validam input (Zod)
- Chamam use cases
- Retornam response HTTP

**Use Cases (Business Logic):**
- Contêm regras de negócio
- Independentes de HTTP/DB
- Testáveis em isolamento
- Reutilizáveis (jobs, CLI, etc)

**Repositories (Data Access):**
- Abstração do banco de dados
- Queries isoladas
- Fácil mockar em testes

**Domain (Entities):**
- Modelos de negócio
- Validações de domínio
- Lógica interna de entidades

---

## 6. Estrutura do Monorepo

### 6.1 Organização Completa

```
processa-ai/
├── apps/
│   ├── web/                 # Frontend React
│   │   ├── src/             # (ver seção 4.1)
│   │   ├── public/
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   ├── railway.json
│   │   └── package.json
│   │
│   ├── api/                 # Backend principal
│   │   ├── src/             # (ver seção 5.1)
│   │   ├── Dockerfile
│   │   ├── railway.json
│   │   └── package.json
│   │
│   ├── ai-chat/             # AI Chat Service
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── services/    # OpenAI, context builder
│   │   │   ├── websocket/   # WebSocket handler
│   │   │   └── lib/         # Cache, logger
│   │   ├── Dockerfile
│   │   ├── railway.json
│   │   └── package.json
│   │
│   └── calculator/          # Calculator Service
│       ├── src/
│       │   ├── server.ts
│       │   ├── services/    # Pension, termination calculators
│       │   ├── workers/     # BullMQ worker
│       │   └── queues/      # Job queue setup
│       ├── Dockerfile
│       ├── railway.json
│       └── package.json
│
├── packages/
│   ├── types/               # Tipos TypeScript compartilhados
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── database/
│   │   │   └── shared/
│   │   └── package.json
│   │
│   ├── validators/          # Zod schemas compartilhados
│   │   ├── src/
│   │   │   ├── auth.ts
│   │   │   ├── blog.ts
│   │   │   ├── chat.ts
│   │   │   └── calculators.ts
│   │   └── package.json
│   │
│   ├── ui/                  # Design system (futuro)
│   │   ├── components/
│   │   ├── styles/
│   │   └── package.json
│   │
│   └── utils/               # Utilidades compartilhadas
│       ├── src/
│       │   ├── formatters.ts
│       │   ├── validators.ts
│       │   └── constants.ts
│       └── package.json
│
├── scripts/
│   ├── setup-railway.sh
│   ├── migrate-db.sh
│   └── seed-db.ts
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-railway.yml
│
├── docker-compose.yml       # Local development
├── package.json             # Root workspace
├── tsconfig.json            # Shared TS config
├── .gitignore
├── .env.example
└── README.md
```

### 6.2 Benefícios do Monorepo

**Code Sharing:**
- Tipos compartilhados (packages/types)
- Validação unificada (packages/validators)
- Componentes UI reutilizáveis (packages/ui)
- Zero config, importações diretas

**Build Optimization:**
- Cache compartilhado entre apps
- Rebuild apenas o que mudou
- Type-checking incremental

**Developer Experience:**
- Refactoring cross-app seguro
- Single source of truth
- Testes integrados facilitados

---

## 7. Banco de Dados

### 7.1 Supabase PostgreSQL

**Configuração:**
- PostgreSQL 16.x via Supabase
- Storage: FREE até 500MB, depois $0.50/GB-month
- Backups: Automáticos com point-in-time recovery
- Connection pooling: Habilitado (Supavisor)

### 7.2 Schema Principal

**Tabelas Core:**

**USERS & AUTH** (gerenciado pelo Supabase Auth):
- **auth.users** - Tabela Supabase nativa (email, password, OAuth)
- **public.user_profiles** - Perfis estendidos
  - Campos: id (FK auth.users), document_type, document_number, full_name, phone, avatar_url, role, timestamps
  - RLS: Users podem ler/editar apenas próprio perfil, admins leem todos

**BLOG:**
- **posts** - Artigos do blog
  - Campos: id, title, slug, content, excerpt, cover_image_url, author_id (FK), category, tags[], status, published_at, timestamps
  - RLS: Público pode ler published, admins podem tudo
  - Índices: author_id, status, published_at DESC
  - Full-text search: GIN index em português (title + content)

**AI CHAT:**
- **chat_sessions** - Sessões de chat
  - Campos: id, user_id (FK), title, timestamps
  - RLS: Users veem apenas próprias sessões

- **chat_messages** - Mensagens
  - Campos: id, session_id (FK), role (user/assistant/system), content, tokens_used, created_at
  - RLS: Cascade delete com session
  - Índices: session_id, created_at DESC

**CALCULATORS:**
- **calculations** - Audit trail
  - Campos: id, user_id (FK), calculator_type, input_data (JSONB), result_data (JSONB), status, created_at
  - RLS: Users veem apenas próprios cálculos
  - Índices: user_id, calculator_type, created_at DESC

### 7.3 Row Level Security (RLS)

**Estratégia:**
- Todas as tabelas públicas com RLS habilitado
- Policies baseadas em auth.uid() do Supabase
- Service role key bypass RLS (backend apenas)
- Anon role bloqueado para escrita

**Exemplos de Policies:**

**user_profiles:**
- SELECT: Autenticados podem ver todos
- UPDATE: Apenas próprio perfil
- INSERT: Automático via trigger após signup

**posts:**
- SELECT: Todos podem ler published
- INSERT/UPDATE/DELETE: Apenas admins

**chat_sessions/messages:**
- SELECT/INSERT/UPDATE/DELETE: Apenas owner (user_id = auth.uid())

### 7.4 Migrations

**Ferramenta:** Drizzle Kit

**Workflow:**
1. Definir schema em Drizzle
2. Gerar migration SQL: `npm run db:generate`
3. Review SQL gerado
4. Aplicar em dev: `npm run db:push -- --env=local`
5. Testar
6. Aplicar em produção: `npm run db:push -- --env=production`

**Rollback:**
- Drizzle não tem rollback automático
- Criar migration reversa manualmente
- Backup antes de migrations críticas

---

## 8. Autenticação e Autorização

### 8.1 Supabase Auth

**Métodos Suportados:**
- Email + Password (principal)
- Magic Links (passwordless)
- OAuth (Google, GitHub - futuro)
- 2FA/TOTP (futuro)

**Fluxo de Autenticação:**

1. **Signup:**
   - Frontend → Supabase Auth → Cria user em auth.users
   - Trigger cria perfil em user_profiles
   - Email de verificação enviado
   - Session token retornado (JWT)

2. **Login:**
   - Frontend → Supabase Auth → Valida credenciais
   - Retorna access_token (JWT 1h) + refresh_token (30d)
   - Tokens armazenados em httpOnly cookies (Supabase client)

3. **Session Management:**
   - Access token em memory/sessionStorage
   - Refresh automático pelo Supabase client
   - Multiple sessions suportado (logout em todos os dispositivos)

4. **Logout:**
   - Frontend → Supabase Auth → Invalida session
   - Clear tokens locais

### 8.2 Autorização (RBAC)

**Roles:**
- `user` - Usuário padrão (blog read, chat, calculators)
- `admin` - Administrador (CRUD blog, analytics)
- `super_admin` - Super admin (user management - futuro)

**Implementação:**

**Backend:**
- Middleware valida JWT do Supabase
- Extrai role do user_profiles
- Middleware `requireRole(['admin'])` protege endpoints

**Frontend:**
- Hook `useAuth()` expõe user e role
- Renderização condicional baseada em role
- Protected routes verificam autenticação + role

### 8.3 Security

**JWT Tokens:**
- Access token: 1 hora de vida
- Refresh token: 30 dias
- Secret gerenciado pelo Supabase
- Signature validation automática

**Session Timeout:**
- Inatividade: 7 dias (configurável)
- Refresh automático em background
- Redirect para login após expiração

**Rate Limiting:**
- Login: 5 tentativas / 15 min
- Signup: 3 tentativas / 1 hora
- Password reset: 3 tentativas / 1 hora

---

## 9. State Management

### 9.1 Zustand (Client State)

**Stores:**

**authStore:**
- Estado: user, isAuthenticated, role
- Actions: login, logout, updateProfile
- Persist: localStorage (somente user ID)
- Sync com Supabase Auth

**uiStore:**
- Estado: theme, sidebarOpen, modals
- Actions: toggleSidebar, openModal, closeModal
- Persist: localStorage

**Características:**
- <1KB gzipped
- Zero boilerplate
- DevTools integration
- Selective subscriptions (evita re-renders)

### 9.2 React Query (Server State)

**Configuração:**

**Global Config:**
- staleTime: 5 minutos (dados "frescos")
- cacheTime: 10 minutos (manter em cache)
- retry: 3 tentativas
- refetchOnWindowFocus: true

**Queries por Feature:**

**Blog:**
- `useBlogs()` - Lista posts published
- `useBlogPost(slug)` - Post individual
- `useUserPosts()` - Posts do autor
- Cache key: `['blogs']`, `['blog', slug]`

**Chat:**
- `useChatSessions()` - Sessões do user
- `useChatMessages(sessionId)` - Mensagens da sessão
- Invalidação após nova mensagem

**Calculators:**
- `useCalculations()` - Histórico
- `useCalculation(id)` - Cálculo específico
- Polling para status de jobs (BullMQ)

**Mutations:**
- Invalidação automática de queries relacionadas
- Optimistic updates para UX instantâneo
- Rollback em caso de erro

### 9.3 Divisão de Responsabilidades

| Tipo de Estado | Ferramenta | Exemplos |
|----------------|------------|----------|
| **Client State** | Zustand | Auth, theme, UI state, sidebar, modals |
| **Server State** | React Query | Posts, messages, calculations, user data |
| **Form State** | React Hook Form | Inputs, validation, submission |
| **URL State** | React Router | Query params, route params, filters |
| **WebSocket State** | Custom hook | AI Chat streaming, realtime updates |

---

## 10. Comunicação Entre Serviços

### 10.1 Service Communication Matrix

```
┌──────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  Source →    │  API     │ AI Chat  │Calculator│ Supabase │  Redis   │
│  Target ↓    │ Backend  │ Service  │ Service  │          │          │
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Web Frontend │   HTTP   │    WS    │    -     │  Direct  │    -     │
│              │   REST   │ (proxy)  │          │  (Auth)  │          │
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ API Backend  │    -     │   HTTP   │   HTTP   │  Direct  │  Direct  │
│              │          │ (internal)│ (queue) │ (Svc key)│          │
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ AI Chat      │    -     │    -     │    -     │  Direct  │  Direct  │
│ Service      │          │          │          │  (read)  │ (cache)  │
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Calculator   │    -     │    -     │    -     │  Direct  │  Direct  │
│ Service      │          │          │          │  (write) │ (queue)  │
└──────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

### 10.2 Frontend ↔ Supabase (Autenticação)

**Fluxo:**
1. Frontend usa Supabase Client SDK
2. Autenticação direta com Supabase Auth
3. JWT token retornado e armazenado
4. Token enviado em chamadas ao backend Railway
5. Backend valida JWT com Supabase public key

**Vantagem:** Frontend não precisa passar pelo backend para auth

### 10.3 Frontend ↔ API Backend (REST)

**Padrão:** REST com Fetch API + React Query

**Fluxo:**
1. Frontend faz request com access_token no header
2. API Backend valida token
3. Processa request e retorna response
4. React Query cacheia resultado

**Endpoints Principais:**
- GET /api/blog/posts - Lista posts
- POST /api/blog/posts - Criar post (admin)
- GET /api/chat/sessions - Listar sessões
- POST /api/calculators/pension - Submeter cálculo

### 10.4 API Backend ↔ AI Chat (WebSocket Proxy)

**Fluxo:**
1. Frontend solicita URL WebSocket: GET /api/chat/stream
2. API Backend valida auth e retorna wsUrl do AI Chat Service
3. Frontend conecta direto ao AI Chat Service via WebSocket
4. AI Chat valida token JWT e estabelece conexão
5. Mensagens streamed incrementalmente

**Vantagem:** Conexão direta reduz latência, Backend não fica no meio

### 10.5 API Backend ↔ Calculator (Job Queue)

**Padrão:** Async Job Queue (BullMQ)

**Fluxo de Submissão:**
1. Frontend envia POST /api/calculators/pension
2. API Backend adiciona job à fila Redis (BullMQ)
3. API retorna imediatamente: `{ jobId, status: 'pending' }`
4. Frontend polling: GET /api/calculators/pension/:jobId

**Processamento:**
1. Calculator Worker escuta fila 'calculation'
2. Processa job assincronamente
3. Salva resultado em Supabase
4. Marca job como 'completed'
5. Frontend vê status atualizado

**Configuração:**
- Concurrency: 5 workers simultâneos
- Redis: Railway internal
- Timeout: 60s por job
- Retry: 3 tentativas em caso de falha

### 10.6 Railway Internal Network

**DNS Interno:**
- API Backend: `api-backend.railway.internal:3000`
- AI Chat: `ai-chat.railway.internal:3001`
- Calculator: `calculator.railway.internal:3002`
- Redis: `redis.railway.internal:6379`

**Benefícios:**
- Latência <1ms entre serviços
- Sem exposição pública (segurança)
- Sem custo de egress

### 10.7 Todos os Serviços ↔ Supabase

**Acesso ao Banco:**
- Frontend: Supabase Client (anon key + RLS)
- Backend: Supabase Client (service role key - bypass RLS)
- Connection string via variável de ambiente
- Connection pooling via Supavisor

**Storage:**
- Frontend: Upload direto com signed URLs
- Backend: Gera signed URLs para downloads
- Organização: buckets por tipo (avatars, blog-images, documents)

---

## 11. Segurança

### 11.1 Camadas de Segurança

**1. Network Level:**
- HTTPS enforced (HSTS headers)
- Railway internal network isolado
- Supabase não exposto publicamente (exceto Auth/Storage)
- CORS configurado (origins permitidos)

**2. Authentication:**
- Supabase Auth com JWT
- Access token: 1h, Refresh: 30d
- httpOnly cookies (CSRF protection)
- Rate limiting em endpoints sensíveis

**3. Authorization:**
- RLS (Row Level Security) em todas as tabelas
- RBAC (Role-Based Access Control)
- Middleware `requireRole()` no backend
- Protected routes no frontend

**4. Input Validation:**
- Frontend: Zod + React Hook Form
- Backend: Zod schemas (shared)
- Database: Constraints, CHECK, tipos

**5. Output Encoding:**
- HTML sanitization: DOMPurify
- SQL injection: ORM queries parametrizadas
- XSS: CSP headers

### 11.2 Security Headers

**Aplicados via Helmet.js:**

- **Strict-Transport-Security:** max-age=31536000; includeSubDomains
- **X-Content-Type-Options:** nosniff
- **X-Frame-Options:** DENY
- **Content-Security-Policy:** default-src 'self'; script-src 'self' 'unsafe-inline'
- **Permissions-Policy:** geolocation=(), microphone=(), camera=()

### 11.3 Rate Limiting

**Implementação:** Redis + sliding window

**Limites por Endpoint:**

| Endpoint | Limite | Janela | Chave |
|----------|--------|--------|-------|
| Login | 5 req | 15 min | IP + email |
| Register | 3 req | 1 hora | IP |
| Password Reset | 3 req | 1 hora | IP + email |
| AI Chat | 20 msg | 1 hora | user_id |
| Blog Read | 100 req | 1 min | IP |
| Blog Write | 10 req | 1 min | user_id |
| Calculator | 30 req | 1 hora | user_id |

**Headers de Resposta:**
- X-RateLimit-Limit: 100
- X-RateLimit-Remaining: 95
- X-RateLimit-Reset: 1635724800

### 11.4 Data Protection

**Dados Sensíveis:**
- Passwords: Hashed pelo Supabase Auth (bcrypt)
- Tokens: JWT signed pelo Supabase (HS256)
- API Keys: Environment variables
- PII: Encrypted at rest (Supabase)

**LGPD Compliance:**
- Consentimento: Checkbox no signup
- Acesso: Endpoint GET /api/users/me/data
- Exportação: JSON download
- Exclusão: Soft delete (GDPR right to be forgotten)
- Auditoria: Logs de acesso a dados sensíveis

### 11.5 Security Checklist

- [x] HTTPS enforced
- [x] JWT com expiração curta
- [x] Refresh tokens em httpOnly cookies
- [x] Rate limiting implementado
- [x] Input validation (Zod)
- [x] SQL injection prevention (Drizzle ORM)
- [x] XSS protection (CSP + sanitização)
- [x] CSRF protection (SameSite cookies)
- [x] CORS configurado
- [x] Security headers (Helmet)
- [x] Secrets em env vars
- [x] Database backups automáticos (Supabase)
- [ ] 2FA para admins (futuro)
- [x] Audit logging para ações sensíveis
- [ ] LGPD compliance completo (Fase 2)

---

## 12. Performance e Caching

### 12.1 Frontend Performance

**Metas:**
- Initial bundle: <200KB gzipped
- Time to Interactive (TTI): <3s
- Lighthouse Score: >90
- First Contentful Paint (FCP): <1.5s
- Largest Contentful Paint (LCP): <2.5s

**Técnicas:**

**1. Code Splitting:**
- Route-based splitting (lazy loading)
- Component-based para modals pesados
- Dynamic imports para features opcionais

**2. Image Optimization:**
- Lazy loading nativo: `loading="lazy"`
- Formatos modernos: WebP, AVIF
- Responsive images: srcset
- Dimensões explícitas (evita layout shift)

**3. Virtual Scrolling:**
- Para listas >100 itens (blog, mensagens)
- @tanstack/react-virtual
- Renderiza apenas itens visíveis

**4. React Query Caching:**
- staleTime: 5min (dados frescos)
- cacheTime: 10min (mantém em cache)
- Prefetching em hover
- Optimistic updates

**5. Bundle Analysis:**
- rollup-plugin-visualizer
- Identificar dependências pesadas
- Tree-shaking agressivo

### 12.2 Backend Performance

**Database Optimization:**

**Indexes Críticos:**
- posts(status) WHERE status = 'published'
- posts(published_at DESC)
- chat_messages(session_id, created_at DESC)
- calculations(user_id, created_at DESC)
- Full-text: GIN index em português

**Query Optimization:**
- SELECT apenas campos necessários
- JOIN estratégico (evitar N+1)
- EXPLAIN ANALYZE para queries lentas
- Pagination (LIMIT + OFFSET ou cursor-based)

**Connection Pooling:**
- Supavisor (Supabase) ou pgBouncer
- Max connections: 20 (Railway Hobby)
- Idle timeout: 30s
- Connection timeout: 2s

**Caching Strategy:**

**Redis Layers:**

**L1 - Redis Cache (5min TTL):**
- blog:posts:published
- blog:post:{slug}
- user:profile:{userId}

**L2 - React Query Cache (10min):**
- Frontend caching automático
- Invalidação em mutations

**Cache Invalidation:**
- Create/Update/Delete → Invalidar pattern
- Example: Criar post → DELETE blog:posts:*

**Response Compression:**
- Gzip/Brotli para responses >1KB
- Level 6 (balanço CPU vs tamanho)
- Middleware de compression

### 12.3 CDN Strategy

**Cloudflare CDN:**
- Imagens: Cache 1 ano
- CSS/JS: Cache 1 ano (hashed filenames)
- HTML: Cache 5min com stale-while-revalidate

**Cache-Control Headers:**

**Assets Estáticos:**
- `public, max-age=31536000, immutable`

**API Endpoints Públicos:**
- `public, s-maxage=300, stale-while-revalidate=600`

**API Endpoints Privados:**
- `private, no-cache`

### 12.4 Performance Monitoring

**Métricas:**

| Métrica | Target | Crítico |
|---------|--------|---------|
| API Latency p95 | <500ms | >2s |
| DB Query p95 | <100ms | >500ms |
| OpenAI API p95 | <3s | >10s |
| Cache Hit Rate | >80% | <50% |
| Error Rate | <1% | >5% |

---

## 13. Observabilidade

### 13.1 Logging

**Structured Logging (Pino):**

**Log Levels:**
- debug: Desenvolvimento
- info: Eventos normais (login, logout)
- warn: Situações anormais
- error: Erros que precisam atenção
- fatal: Sistema inoperante

**Campos Padrão:**
- timestamp (ISO 8601)
- level
- service (api-backend, ai-chat, calculator)
- environment (development, production)
- requestId (trace requests)

**Agregação:**
- Railway Logs (built-in)
- CloudWatch Logs (futuro)
- Datadog ou Axiom (escala)

### 13.2 Error Tracking

**Sentry:**

**Frontend:**
- Browser errors
- React error boundaries
- User interactions (breadcrumbs)
- Session replay (10% sample)

**Backend:**
- Uncaught exceptions
- HTTP errors (4xx, 5xx)
- Database errors
- External API errors

**Context:**
- User ID, email
- Request method, URL, headers
- Stack trace
- Custom tags (feature, severity)

**Alerting:**
- Critical errors: PagerDuty + Slack
- Warnings: Slack
- Threshold: >10 errors/min

### 13.3 Application Performance Monitoring (APM)

**Métricas Chave:**

| Métrica | Descrição | Alertas |
|---------|-----------|---------|
| **Latency p95** | Tempo de resposta API | >2s |
| **Throughput** | Requests por segundo | - |
| **Error Rate** | % de requests com erro | >5% |
| **Apdex Score** | User satisfaction | <0.8 |

**Traces:**
- Distributed tracing (OpenTelemetry - futuro)
- Request → API → DB → External APIs
- Identificar gargalos

### 13.4 Real User Monitoring (RUM)

**Web Vitals:**
- LCP (Largest Contentful Paint): <2.5s
- FID (First Input Delay): <100ms
- CLS (Cumulative Layout Shift): <0.1

**Tracking:**
- Google Analytics 4
- Custom events (chat_message_sent, calculator_used)
- Conversions (signup, primeira calculadora)

### 13.5 Health Checks

**Endpoints:**

**GET /health:**
- Status: ok/degraded/down
- Timestamp
- Services: database, redis, openai, supabase
- Latency de cada serviço

**Response Example:**
- status: "ok"
- services.database: { status: "ok", latency: "5ms" }
- services.redis: { status: "ok", latency: "2ms" }

**Monitoring:**
- UptimeRobot: Check a cada 5min
- Better Uptime (alternativa)
- Alerts: Email + Slack

### 13.6 Business Metrics

**KPIs:**
- DAU/MAU (Daily/Monthly Active Users)
- Chat messages per user per day
- Calculator usage by type
- Blog post engagement (views, time on page)
- Signup → First calculation time

**Dashboard:**
- PostHog (open-source)
- Mixpanel (alternativa)
- Custom analytics em Supabase

---

## 14. Deploy e CI/CD

### 14.1 Ambientes

| Ambiente | Branch | Deploy | URL | Propósito |
|----------|--------|--------|-----|-----------|
| **Development** | feature/* | Manual | localhost:5173 | Dev local |
| **Staging** | develop | Auto (PR merge) | staging.railway.app | Testes |
| **Production** | main | Auto (PR merge) | processa-ai.com.br | Produção |

### 14.2 CI/CD Pipeline (GitHub Actions)

**Workflow:**

**1. Pull Request:**
- Lint (ESLint)
- Type check (TypeScript)
- Unit tests (Vitest)
- Build test

**2. Merge to Develop:**
- Deploy automático para Staging
- E2E tests (Playwright) no Staging
- Notificação Slack

**3. Merge to Main:**
- Deploy automático para Production
- Smoke tests
- Monitoramento ativo
- Rollback automático se error rate >5%

### 14.3 Railway Deploy

**Setup:**

1. Criar projeto Railway: `railway init`
2. Adicionar PostgreSQL template (ou conectar Supabase)
3. Adicionar Redis template
4. Deploy services:
   - web-frontend (Port 80)
   - api-backend (Port 3000)
   - ai-chat (Port 3001 - Opção B)
   - calculator (Port 3002 - Opção B)

**Environment Variables:**

**Todos os Services:**
- NODE_ENV=production
- SUPABASE_URL
- SUPABASE_ANON_KEY (frontend)
- SUPABASE_SERVICE_KEY (backend)
- REDIS_URL (Railway internal)

**API Backend:**
- DATABASE_URL (Supabase)
- JWT_SECRET
- OPENAI_API_KEY
- AI_CHAT_SERVICE_URL (internal)
- CALCULATOR_SERVICE_URL (internal)
- SENTRY_DSN

**AI Chat:**
- OPENAI_API_KEY
- REDIS_URL
- DATABASE_URL

**Calculator:**
- REDIS_URL
- DATABASE_URL

### 14.4 Database Migrations

**Processo:**

1. Desenvolvimento local:
   - Alterar schema em Drizzle
   - `npm run db:generate` (gera SQL)
   - `npm run db:push -- --env=local`

2. Staging:
   - PR merge → CI roda migrations
   - Testes E2E validam schema

3. Produção:
   - Backup automático pré-migration
   - `npm run db:push -- --env=production`
   - Rollback se falhar

### 14.5 Rollback Strategy

**Frontend (Railway):**
- Rollback com 1 clique no dashboard
- Cada deploy tem URL única
- Instant rollback (sem rebuild)

**Backend:**
- Blue/Green deployment
- Manter versão anterior rodando
- Switch traffic se nova versão falhar

**Database:**
- Backup automático antes de migration
- Restore manual se necessário
- Sempre escrever migrations reversíveis

---

## 15. Análise de Custos

### 15.1 MVP (0-1.000 usuários)

**Railway (Opção A - Container Único):**
- Base fee: $5/mês
- api-backend (API + AI + Calculator): 0.5 vCPU, 512MB = $0.25/mês
- web-frontend: 0.25 vCPU, 256MB = $0.13/mês
- Redis: FREE (250MB)
- **Subtotal Railway:** $5.38/mês

**Supabase:**
- Database: FREE (500MB)
- Auth: FREE
- Storage: FREE (1GB)
- **Subtotal Supabase:** $0/mês

**Externos:**
- OpenAI API: 1000 chats/mês = $17/mês
- Sentry (Developer): FREE
- **Subtotal Externos:** $17/mês

**TOTAL MVP:** ~$22/mês

**Comparação com Setup Anterior:**
- Vercel Pro: $20/mês
- Supabase: $0
- Upstash Redis: $10/mês
- OpenAI: $17/mês
- **Total Anterior:** ~$47/mês

**ECONOMIA: $25/mês (53% mais barato)**

### 15.2 Crescimento (1k-10k usuários)

**Railway (Opção B - 3 Containers):**
- Base fee: $5/mês
- web-frontend: 0.5 vCPU, 512MB = $0.25/mês
- api-backend (2 instâncias): 2 × $0.25 = $0.50/mês
- ai-chat (2 instâncias): 2 × $0.25 = $0.50/mês
- calculator: 0.5 vCPU, 512MB = $0.25/mês
- Redis: 500MB = $2/mês
- **Subtotal Railway:** $8.50/mês

**Supabase:**
- Database Pro: $25/mês (2GB, backups)
- Storage: $1/mês (20GB)
- **Subtotal Supabase:** $26/mês

**Externos:**
- OpenAI API: 10k chats/mês = $170/mês
- Sentry Team: $26/mês
- **Subtotal Externos:** $196/mês

**TOTAL Crescimento:** ~$231/mês

**Comparação:**
- Vercel Pro + Functions: $70/mês
- Supabase Pro: $25/mês
- Upstash Pro: $20/mês
- OpenAI: $170/mês
- Sentry: $26/mês
- **Total Alternativo:** ~$311/mês

**ECONOMIA: $80/mês (26% mais barato)**

### 15.3 Escala (100k+ usuários)

**Migração Recomendada: Railway Pro ou AWS**

**Railway Pro:**
- Base: $20/mês
- 4× API Backend
- 8× AI Chat
- 2× Calculator
- PostgreSQL: 50GB
- Redis: 5GB
- **Estimado:** $300-500/mês

**AWS (Comparação):**
- ALB + ECS Fargate: $300/mês
- RDS PostgreSQL: $150/mês
- ElastiCache Redis: $100/mês
- S3 + CloudFront: $50/mês
- **Estimado:** $600/mês

**Conclusão:** Railway competitivo até ~100k usuários

### 15.4 Resumo de Custos

| Usuários | Stack | Custo Total | Economia |
|----------|-------|-------------|----------|
| **0-1k** | Railway Hobby + Supabase Free | $22/mês | 53% |
| **1k-10k** | Railway Hobby + Supabase Pro | $231/mês | 26% |
| **10k-100k** | Railway Pro + Supabase Pro | $500/mês | 17% |
| **100k+** | AWS ou Railway Enterprise | $1500+/mês | - |

---

## 16. Roadmap de Implementação

### 16.1 Overview (10 semanas)

```
┌─────────┬─────────────────────────────────────────────────────────┐
│ Semana  │ Fase                                                    │
├─────────┼─────────────────────────────────────────────────────────┤
│ 1-2     │ Foundation: Monorepo + Tooling                         │
│ 3-4     │ Frontend: State Management + Feature-Based             │
│ 5-6     │ Backend: Clean Architecture + Railway Deploy           │
│ 7       │ AI Chat: WebSocket Streaming                            │
│ 8       │ Calculators: BullMQ + Background Jobs                   │
│ 9       │ Security + Performance + Monitoring                     │
│ 10      │ Testing + Documentation + Launch                        │
└─────────┴─────────────────────────────────────────────────────────┘
```

---

### 16.2 Fase 1: Foundation (Semanas 1-2)

**Objetivos:**
- Setup monorepo com npm workspaces
- Configurar CI/CD básico
- Setup Supabase + Railway
- Configurar ferramentas de desenvolvimento

**Tarefas:**

**Semana 1:**
- [ ] Criar estrutura de monorepo (apps/, packages/)
- [ ] Configurar npm workspaces no package.json raiz
- [ ] Setup TypeScript compartilhado (tsconfig.json base)
- [ ] Configurar ESLint + Prettier compartilhados
- [ ] Setup Supabase projeto (database, auth, storage)
- [ ] Criar tabelas iniciais (users, posts, sessions, messages)
- [ ] Configurar RLS policies básicas

**Semana 2:**
- [ ] Setup Railway projeto
- [ ] Adicionar Redis template
- [ ] Configurar GitHub Actions (CI básico: lint, type-check)
- [ ] Setup Sentry (frontend + backend)
- [ ] Criar docker-compose.yml para desenvolvimento local
- [ ] Documentar setup no README.md
- [ ] Testar build de todos os workspaces

**Entregáveis:**
- ✅ Monorepo funcionando
- ✅ CI/CD rodando
- ✅ Supabase configurado
- ✅ Railway preparado
- ✅ Dev environment local

---

### 16.3 Fase 2: Frontend Refactor (Semanas 3-4)

**Objetivos:**
- Implementar arquitetura feature-based
- Migrar para Zustand + React Query
- Eliminar prop drilling
- Setup routing moderno

**Tarefas:**

**Semana 3:**
- [ ] Reestruturar apps/web/src/ para feature-based
  - [ ] Criar pastas features/ (auth, blog, ai-chat, calculators)
  - [ ] Criar shared/ (components, hooks, utils)
  - [ ] Criar core/ (api, router, providers)
- [ ] Implementar Zustand stores:
  - [ ] authStore (user, isAuthenticated, login, logout)
  - [ ] uiStore (theme, sidebar, modals)
- [ ] Setup React Query provider
- [ ] Migrar auth state de App.tsx para authStore

**Semana 4:**
- [ ] Implementar React Query hooks:
  - [ ] useBlogs(), useBlogPost()
  - [ ] useChatSessions(), useChatMessages()
  - [ ] useCalculations()
- [ ] Refatorar componentes para usar hooks
- [ ] Implementar Protected Routes
- [ ] Lazy loading de rotas pesadas
- [ ] Testes de integração do state management

**Entregáveis:**
- ✅ Frontend feature-based
- ✅ State management moderno
- ✅ Zero prop drilling
- ✅ Routing otimizado

---

### 16.4 Fase 3: Backend Clean Architecture (Semanas 5-6)

**Objetivos:**
- Implementar Clean Architecture
- Migrar para Drizzle ORM
- Deploy inicial no Railway
- Integração com Supabase Auth

**Tarefas:**

**Semana 5:**
- [ ] Reestruturar apps/api/src/ (features, shared, infrastructure)
- [ ] Setup Drizzle ORM:
  - [ ] Definir schema completo
  - [ ] Gerar primeira migration
  - [ ] Aplicar em dev local
- [ ] Implementar feature "blog":
  - [ ] Handlers (HTTP thin layer)
  - [ ] Use cases (business logic)
  - [ ] Repositories (data access)
- [ ] Implementar middleware:
  - [ ] Auth (Supabase JWT validation)
  - [ ] Error handler
  - [ ] Logger (Pino)

**Semana 6:**
- [ ] Criar Dockerfiles para cada service
- [ ] Setup Railway.json configs
- [ ] Deploy API Backend no Railway (Opção A - container único)
- [ ] Configurar environment variables no Railway
- [ ] Testar endpoints de produção
- [ ] Setup domain customizado (processa-ai.com.br)
- [ ] Configurar HTTPS + SSL

**Entregáveis:**
- ✅ Backend com Clean Architecture
- ✅ Drizzle ORM funcionando
- ✅ Deploy Railway ativo
- ✅ Integração Supabase Auth

---

### 16.5 Fase 4: AI Chat Streaming (Semana 7)

**Objetivos:**
- Implementar WebSocket server
- Streaming de respostas OpenAI
- Persistência de mensagens
- Deploy AI Chat Service (Opção B)

**Tarefas:**

**Dia 1-2:**
- [ ] Implementar WebSocket server (ws library)
- [ ] Handler de conexão com validação JWT
- [ ] Context builder (carregar histórico)
- [ ] Rate limiting específico para chat

**Dia 3-4:**
- [ ] Integração OpenAI streaming:
  - [ ] Setup OpenAI SDK
  - [ ] Stream incremental de tokens
  - [ ] Error handling (timeout, rate limit)
- [ ] Salvar mensagens no Supabase
- [ ] Implementar semantic cache (Redis)

**Dia 5-7:**
- [ ] Frontend: Hook useStreamingChat
- [ ] Componentes: ChatWindow, MessageBubble
- [ ] Indicador de "typing..." durante streaming
- [ ] Testar com múltiplas sessões simultâneas
- [ ] Deploy AI Chat Service separado (se Opção B)

**Entregáveis:**
- ✅ AI Chat streaming funcionando
- ✅ WebSocket estável
- ✅ Mensagens persistidas
- ✅ UX de streaming suave

---

### 16.6 Fase 5: Calculators + Background Jobs (Semana 8)

**Objetivos:**
- Implementar BullMQ job queue
- Workers para cálculos complexos
- Audit trail de cálculos
- Deploy Calculator Service (Opção B)

**Tarefas:**

**Dia 1-2:**
- [ ] Setup BullMQ:
  - [ ] Criar queue 'calculations'
  - [ ] Implementar worker
  - [ ] Configurar Redis connection
- [ ] Implementar cálculo de previdência
- [ ] Implementar cálculo de rescisão trabalhista

**Dia 3-4:**
- [ ] API endpoints:
  - [ ] POST /api/calculators/pension (submit job)
  - [ ] GET /api/calculators/pension/:jobId (status)
  - [ ] GET /api/calculators/history (user history)
- [ ] Salvar resultados em Supabase
- [ ] Audit trail (quem, quando, inputs, outputs)

**Dia 5-7:**
- [ ] Frontend:
  - [ ] Formulários de calculadoras
  - [ ] Polling de status
  - [ ] Exibição de resultados
  - [ ] Histórico de cálculos
- [ ] Deploy Calculator Service separado (se Opção B)
- [ ] Testes E2E de todo o fluxo

**Entregáveis:**
- ✅ Calculadoras funcionais
- ✅ Background jobs estáveis
- ✅ Audit trail completo
- ✅ UI polida

---

### 16.7 Fase 6: Security, Performance & Monitoring (Semana 9)

**Objetivos:**
- Hardening de segurança
- Otimizações de performance
- Observabilidade completa

**Tarefas:**

**Segurança (Dia 1-3):**
- [ ] Implementar rate limiting (Redis):
  - [ ] Login: 5/15min
  - [ ] Signup: 3/1h
  - [ ] AI Chat: 20/1h
  - [ ] Calculator: 30/1h
- [ ] Security headers (Helmet)
- [ ] Input validation audit (Zod em todos os endpoints)
- [ ] CORS configurado corretamente
- [ ] Secrets audit (nenhum hardcoded)
- [ ] RLS policies review

**Performance (Dia 4-5):**
- [ ] Implementar caching layer (Redis):
  - [ ] Blog posts (5min TTL)
  - [ ] User profiles (10min TTL)
  - [ ] Invalidação em mutations
- [ ] Database indexes review
- [ ] Query optimization (EXPLAIN ANALYZE)
- [ ] Frontend bundle analysis
- [ ] Image optimization (lazy load, WebP)

**Monitoring (Dia 6-7):**
- [ ] Sentry error tracking funcionando
- [ ] Structured logging (Pino) em produção
- [ ] Health check endpoints
- [ ] UptimeRobot monitoring
- [ ] Dashboards básicos (Railway + Supabase)
- [ ] Alertas críticos (Slack/email)

**Entregáveis:**
- ✅ Sistema seguro (OWASP Top 10)
- ✅ Performance otimizada
- ✅ Observabilidade completa

---

### 16.8 Fase 7: Testing, Docs & Launch (Semana 10)

**Objetivos:**
- Testes automatizados
- Documentação completa
- Soft launch
- Iteração baseada em feedback

**Tarefas:**

**Testing (Dia 1-4):**
- [ ] Unit tests (Vitest):
  - [ ] Use cases (>80% coverage)
  - [ ] Repositories
  - [ ] Utilities
- [ ] Integration tests:
  - [ ] API endpoints
  - [ ] Database operations
- [ ] E2E tests (Playwright):
  - [ ] User signup → login
  - [ ] Create blog post (admin)
  - [ ] Send chat message
  - [ ] Submit calculation
  - [ ] Logout
- [ ] Load testing (k6):
  - [ ] API endpoints
  - [ ] WebSocket concurrent connections

**Documentation (Dia 5-6):**
- [ ] README.md completo:
  - [ ] Setup local
  - [ ] Deploy
  - [ ] Environment variables
- [ ] API documentation (Swagger/OpenAPI)
- [ ] ADRs (Architecture Decision Records)
- [ ] Runbook de deploy
- [ ] Incident response plan

**Launch (Dia 7):**
- [ ] Deploy final para produção
- [ ] Smoke tests completos
- [ ] Monitoring ativo e verificado
- [ ] Convidar primeiros usuários
- [ ] Coletar feedback
- [ ] Hot fixes se necessário

**Entregáveis:**
- ✅ Sistema testado e documentado
- ✅ Produção estável
- ✅ Primeiros usuários ativos
- ✅ Feedback loop estabelecido

---

## 17. Conclusão

### 17.1 Resumo de Decisões Arquiteturais

| Aspecto | Decisão | Justificativa |
|---------|---------|---------------|
| **Platform** | Railway | Sem timeouts, background jobs, custo previsível |
| **Database** | Supabase PostgreSQL | Auth built-in, Storage, RLS, managed |
| **Auth** | Supabase Auth | JWT, OAuth, Magic Links, 2FA ready |
| **Storage** | Supabase Storage | S3-compatible, integrado |
| **Cache** | Redis (Railway) | Internal network <1ms, FREE tier |
| **Frontend Framework** | React 19 | Já implementado, React Compiler |
| **State Management** | Zustand + React Query | Simples, performático, cache inteligente |
| **Backend Framework** | Express | Maduro, flexível |
| **ORM** | Drizzle | Type-safe, performático |
| **Job Queue** | BullMQ | Robusto, Redis-based |
| **Monitoring** | Sentry | Error tracking completo |
| **Monorepo** | npm workspaces | Nativo, zero config |

### 17.2 Benefícios da Nova Arquitetura

**Técnicos:**
- ✅ Sem timeouts para AI streaming
- ✅ Background jobs nativos
- ✅ Latência DB <1ms (Railway internal)
- ✅ State management moderno (zero prop drilling)
- ✅ Type-safety end-to-end
- ✅ Escalabilidade independente de serviços
- ✅ Observabilidade desde dia 1

**Negócio:**
- ✅ Custo 53% menor (MVP)
- ✅ Desenvolvimento mais rápido (DX melhor)
- ✅ Manutenção simplificada
- ✅ Escalabilidade provada (Railway + Supabase)
- ✅ Time-to-market reduzido

### 17.3 Próximos Passos

1. **Aprovar arquitetura** ✅
2. **Criar backlog detalhado** (Issues GitHub)
3. **Iniciar Fase 1** (Foundation)
4. **Setup CI/CD**
5. **Desenvolvimento iterativo** (2 semanas por fase)
6. **Launch MVP** (Semana 10)

### 17.4 Métricas de Sucesso

**Técnicas:**
- API latency p95 < 500ms
- DB query time p95 < 100ms
- AI Chat streaming sem timeouts
- Zero downtime deploys
- Error rate < 1%
- Test coverage > 80%

**Negócio:**
- Custo mensal < $30 (MVP)
- Uptime > 99.9%
- User satisfaction > 4.5/5
- Time to first value < 5min

---

**Documento Criado:** 2025-11-03
**Versão:** 1.0
**Autor:** Claude Code + Arquiteto de Software
**Status:** ✅ Ready for Implementation

**Let's build this! 🚀**
