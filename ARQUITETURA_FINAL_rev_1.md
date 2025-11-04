# Arquitetura Final - Processa AI (Rev 3)

**Versão:** 1.3 (Serviços all-time running)
**Data:** 2025-11-04
**Status:** Pronto para Implementação (containers-only)

---

## 1. Visão Geral

### Diretriz desta revisão
- Remover o uso de Railway Functions neste MVP.
- Adotar somente serviços backend **all-time running** (containers) para: **blog**, **calculadoras (calc)** e **IA (ai)**.
- O fluxo de IA é **single-turn** (sem tréplica): usuário faz uma solicitação, a IA responde; pode haver anexos e busca na web.
- Latência não é prioridade no MVP; priorizar confiabilidade e simplicidade operacional.

### Motivação
- Evitar limites de execução e timeouts de functions.
- Permitir operações mais longas (busca na web, processamento de arquivos, IA) de forma estável.
- Simplificar o modelo mental de deploy/observabilidade (um processo por serviço).

---

## 2. Decisões Tecnológicas

### Plataforma
- **Railway Services (containers)** para blog, calc e ai.
- **Nginx + React** para frontend (container separado), com proxy por caminho para os serviços.

### Banco de Dados e Auth
- **Supabase**: PostgreSQL + Auth + Storage (mantidos).
- **RLS** ativo; uso de JWT do Supabase validado no backend via **JWKS** (cache).

### Backend
- **Node.js 20 + Express 4** (um serviço por domínio: blog, ai, calc).
- **Drizzle ORM** (opcional) para acesso a Postgres do Supabase; ou Supabase client quando adequado.
- **Zod** para validação.
- **Pino** para logs, **Sentry** para erros e performance.
- **Helmet**, **CORS** e rate limiting (Redis opcional futuramente).

### Frontend
- React 19 + Vite + Tailwind.
- Chama diretamente os serviços por rotas dedicadas (ex.: /api/blog, /api/ai, /api/calc) via Nginx.

---

## 3. Arquitetura de Serviços (Containers)

### Diagrama
```
┌──────────────────────────────────────────────────────────┐
│                RAILWAY PROJECT: processa-ai              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐       ┌──────────────────────────┐  │
│  │  web-frontend   │──────▶│  Nginx (reverse proxy)   │  │
│  │  React + Nginx  │ HTTP  │  /api/blog → blog        │  │
│  │  Port: 80       │       │  /api/ai   → ai          │  │
│  └─────────────────┘       │  /api/calc → calc        │  │
│                             └───────────┬──────────────┘  │
│                                         │                 │
│                  ┌──────────────────────▼────────────────┐│
│                  │         Containers (Node/Express)     ││
│                  │  blog  |  ai  |  calc                 ││
│                  └───────────────────────────────────────┘│
│                                                          │
└──────────────────────────────────┬────────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │       SUPABASE        │
                       │  PostgreSQL + Auth +  │
                       │  Storage (RLS)        │
                       └───────────────────────┘
```

### Responsabilidades por serviço
- **blog**: CRUD de posts, listagem pública/privada, categorias, OG data.
- **ai**: geração de resposta single-turn; opcionalmente SSE; integração com OpenAI, leitura de arquivos do Storage e busca na web.
- **calc**: endpoints síncronos para cálculos (previdência, rescisão), validação com Zod; se algum cálculo ficar pesado, avaliar job async futuro.

---

## 4. Estrutura do Monorepo

```
processa-ai/
├── apps/
│   ├── web/                 # Frontend
│   ├── blog/                # Serviço Blog (Express)
│   ├── ai/                  # Serviço IA (Express)
│   └── calculator/          # Serviço Calculadoras (Express)
├── packages/
│   ├── types/
│   ├── validators/
│   └── utils/
├── supabase/
│   └── migrations/
└── ...
```

- Cada serviço com seu Dockerfile e railway.json.
- Compartilhamento de tipos e schemas via packages/.

---

## 5. API e Contratos

- Padrão REST simples:
  - blog: `GET /posts`, `GET /posts/:slug`, `POST /posts`, `PUT /posts/:id`, `DELETE /posts/:id`
  - ai: `POST /generate` (body: prompt, refs de arquivo, enableWebSearch), retorno JSON; opcional SSE `GET /generate/stream` com query params
  - calc: `POST /previdencia`, `POST /rescisao` (inputs validados por Zod), retorno JSON
- Autenticação por Bearer token (JWT Supabase). Claims de role e usuário avaliados em middleware.
- CORS e rate limiting básicos.

---

## 6. IA Single-turn

- Fluxo:
  1) Validar input (Zod) e permissões conforme necessidade.
  2) Se enableWebSearch, executar busca limitada (timeout e nº de resultados controlados).
  3) Montar contexto (resumo de resultados + metadados/trechos de arquivos do Storage, se fornecidos).
  4) Chamar OpenAI com limites (max_tokens, temperature) e retornar resposta.
  5) SSE opcional para stream gradual; padrão será resposta completa.
- Logging de duração e custo para monitorar e otimizar.

---

## 7. Banco de Dados e Storage

- Supabase Postgres com RLS: garantir que as queries em contexto de usuário respeitem policies.
- Supabase Storage: uploads do frontend; backend lê arquivos quando necessário (evitar transferir grandes volumes).
- Índices e consultas otimizadas para listagem de posts.

---

## 8. Segurança

- Helmet, CORS estrito, rate limiting por IP/usuário.
- Validação com Zod em todas as entradas.
- Middleware de Auth com verificação de JWT via JWKS (cache local).
- Segredos via Railway.
- Auditar endpoints admin do blog; logs de mudança.

---

## 9. Observabilidade

- Pino logs estruturados com request-id.
- Sentry para erros/performance.
- Health/readiness endpoints por serviço.
- OpenTelemetry (opcional) para traces entre serviços.

---

## 10. Deploy e CI/CD

- GitHub Actions:
  - Lint, typecheck, tests.
  - Build por serviço e deploy para Railway.
  - Migrations: um fluxo único (Drizzle Kit ou SQL Supabase). Evitar duplicidade e garantir rollbacks.
- Ambientes separados (dev/staging/prod) com variáveis distintas.

---

## 11. Custos

- Containers all-time running: custo fixo previsível no Railway.
- Sem functions: sem custos por invocação; adequado para workloads não triviais do MVP.
- Monitorar egress entre Railway e Supabase.

---

## 12. Roadmap

1) Criar apps/blog, apps/ai, apps/calculator (Express + Dockerfile + railway.json).
2) Implementar middleware de Auth comum (JWT via JWKS) e validação (Zod) compartilhados em packages/.
3) Implementar endpoints do blog (CRUD + listagem + detail) com RLS quando aplicável.
4) Implementar calculadoras (previdência e rescisão) com testes unitários dos cálculos.
5) Implementar ai/generate single-turn (resposta completa; adicionar SSE depois, se desejado).
6) Integrar Sentry e Pino; health checks.
7) Pipeline CI/CD por serviço; migrations consolidadas.
8) Integrar frontend chamando /api/blog, /api/ai, /api/calc via Nginx.

---

## Conclusão

Esta revisão consolida o MVP com **serviços backend all-time running** para blog, IA e calculadoras, maximizando estabilidade e simplicidade operacional, sem uso de functions. O modelo favorece workloads de duração variável e facilita adicionar streaming ou jobs no futuro, caso necessário.

---

## 13. State Management (Frontend)

- Client state: **Zustand 5.x** por feature (auth, blog, ai, calculators).
- Server state: **React Query 5.x** para cache de dados, invalidação inteligente e prefetch.
- Forms: **React Hook Form** + **Zod** para validação e performance.
- Padrões:
  - Chaves de cache previsíveis: `['blog','list']`, `['blog','detail',slug]`, `['ai','generate',requestId]`, `['calc','previdencia',paramsHash]`.
  - Invalidação: ao criar/atualizar/deletar post → invalidar `['blog','list']` e `['blog','detail',slug]`.
  - Prefetch: hover em links de post e páginas do dashboard.

## 14. Comunicação Entre Serviços

- Padrão HTTP REST via Nginx reverse proxy:
  - `/api/blog/*` → serviço blog (Express)
  - `/api/ai/*` → serviço ai (Express)
  - `/api/calc/*` → serviço calculator (Express)
- Streaming:
  - Resposta padrão completa (single-turn).
  - **SSE opcional** em `/api/ai/generate/stream?requestId=...` quando desejado. Evitar WebSocket no MVP.
- Uploads:
  - Frontend → Supabase Storage (upload direto) após obter credenciais ou URL assinada (gerada pelo backend se necessário).

## 15. Segurança (Detalhado)

- Autenticação: JWT do Supabase validado via **JWKS** no backend; cache de chaves.
- Autorização: middleware por serviço avaliando `role` (ex.: admin para CRUD do blog).
- RLS: quando usar Supabase client com token do usuário, policies garantem acesso por linha.
- Hardening:
  - **Helmet** para headers de segurança.
  - **CORS** estrito (origem do frontend e métodos permitidos).
  - **Rate limiting** por IP/usuário nas rotas sensíveis (AI e calculators).
  - Validação de payload com **Zod** em todos os handlers.
  - Segredos em variáveis do Railway (sem commit de chaves).
  - Logs sem PII sensível; mascarar dados quando necessário.

## 16. Performance e Caching

- Cache de leitura (blog):
  - HTTP cache control para listagem/detail público.
  - Invalidação automática após mutações (hooks em backend).
- Redis (futuro, opcional):
  - Cachear consultas frequentes se necessário.
  - Armazenar resultados de cálculo por `paramsHash` para evitar recomputação.
- Otimização de consultas:
  - Índices em tabelas de posts (slug, created_at, status).
  - Paginação eficiente (`limit/offset` ou `keyset pagination`).

## 17. Observabilidade

- Logs: **Pino** + `pino-http` com `request-id` (correlação).
- Erros e performance: **Sentry** em backend e frontend.
- Health checks:
  - `GET /health` por serviço.
  - `GET /ready` (readiness) para dependências externas.
- Tracing (opcional): **OpenTelemetry** com export para Sentry/Tempo.

## 18. Deploy e CI/CD (Detalhado)

- Pipelines (GitHub Actions):
  - Jobs: `lint`, `typecheck`, `test` (Vitest), `build` por serviço, `docker build/push`, `deploy` Railway.
  - Estratégia: build e deploy independentes por serviço (`blog`, `ai`, `calculator`, `web`).
  - Migrations: um job dedicado que executa migrations no Supabase (Drizzle Kit ou SQL) antes do deploy dos serviços que dependem do schema.
- Ambientes:
  - `dev`, `staging`, `prod` com variáveis seguras e segregar bancos.
  - Revisões em PR com deploy para `staging` quando possível.

## 19. Análise de Custos (Estimativa MVP)

- Railway Containers (Hobby): custo base por serviço (valores variam; estimar ~US$5-6 por serviço/mês). Para 3 serviços backend + frontend, estimativa ~US$20–25/mês.
- Supabase:
  - Free tier cobre DB (500MB) e Storage (1GB) inicialmente.
  - Custos crescem com uso; monitorar I/O e Storage.
- OpenAI: custo por token gerado/consumido; limite e monitoramento por usuário/admin.
- Egress: tráfego entre Railway e Supabase; monitorar para evitar surpresas.

## 20. Cronograma de Implementação (MVP)

Fase 0 – Preparação (Dia 1–2)
- Definir variáveis de ambiente (Railway e local) e segredos.
- Confirmar regiões de Railway e Supabase.
- Escolher padrão de migrations (Drizzle Kit ou SQL Supabase) e documentar fluxo.

Fase 1 – Infra e Fundamentos (Semana 1)
- Criar serviços: `apps/blog`, `apps/ai`, `apps/calculator` (Express + Dockerfile + railway.json).
- Implementar middleware comum (auth JWT via JWKS, CORS, Helmet, Zod) em `packages/utils` ou `packages/validators`.
- Configurar Nginx no `apps/web` para proxy `/api/blog`, `/api/ai`, `/api/calc`.
- Integrar Sentry e Pino; adicionar endpoints `health/ready`.

Fase 2 – Blog (Semana 2)
- Modelar schema de posts, categorias, autores (migrations).
- Implementar `GET /posts`, `GET /posts/:slug` (público, cache HTTP).
- Implementar `POST /posts`, `PUT /posts/:id`, `DELETE /posts/:id` (protegido, role=admin).
- Testes unitários e integração básicos (Vitest) para handlers e repositories.

Fase 3 – Calculadoras (Semana 3)
- Implementar `POST /previdencia` e `POST /rescisao` com validação **Zod**.
- Especificar fórmulas e cenários de teste; criar suíte de testes unitários para lógica de cálculo.
- Adicionar memoização por `paramsHash` (em memória) e métricas de desempenho.

Fase 4 – IA Single-turn (Semana 4)
- Implementar `POST /generate` com suporte a:
  - prompt principal
  - referências a arquivos (metadados/paths do Supabase Storage)
  - flag de web search (busca limitada; timeout controlado)
- Limitar tokens e tempo de execução; retornar resposta completa.
- Opcional: `GET /generate/stream` com SSE.

Fase 5 – Frontend e Integração (Semana 5)
- Integrar features no frontend: páginas de blog, formulário admin, calculadoras e página de IA.
- Implementar providers (React Query, Supabase), stores Zustand.
- Proteção de rotas (Protected/Admin) com supabase auth.

Fase 6 – Qualidade, Segurança e Deploy (Semana 6)
- Rate limiting nas rotas sensíveis (AI, calc).
- Revisão de RLS e policies no Supabase.
- Pipeline CI/CD completo (lint, test, build, deploy por serviço, migrations).
- Observabilidade: dashboards simples (Sentry), logs com correlação.
- Preparar ambiente `staging` e `prod`; smoke tests.

Marco de Entrega (MVP)
- Blog público e CRUD admin funcionando.
- Calculadoras entregando resultados corretos com testes.
- IA single-turn respondendo com arquivos e busca web limitada.
- Frontend integrado e autenticação funcional.
- CI/CD e observabilidade básicos operando.

## 21. Variáveis de Ambiente (Exemplo)

- Comuns: `NODE_ENV`, `SENTRY_DSN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE` (apenas em serviços admin), `OPENAI_API_KEY`.
- Blog: `DATABASE_URL` (se usar Drizzle/SQL), `JWT_JWKS_URL` (Supabase), `CORS_ORIGIN`.
- AI: `OPENAI_API_KEY`, `WEBSEARCH_API_KEY` (opcional), `JWT_JWKS_URL`, `SUPABASE_STORAGE_BUCKET`.
- Calc: `JWT_JWKS_URL`, `CORS_ORIGIN`.

## 22. Riscos e Mitigações

- Latência entre Railway e Supabase: não crítico para o MVP; se aumentar, considerar otimizações de cache.
- Custo de IA: aplicar limites diários por usuário e monitorar uso; adicionar logging por requisição.
- Segurança de uploads: URLs assinadas com expiração curta; validação de tipo/tamanho.
- Divergência de migrations: manter fonte única (Drizzle OU SQL) e revisar em PRs.
- Escopo de serviços: manter interfaces claras e evitar acoplamento indevido.

## 23. Critérios de Aceite (MVP)

- Blog: CRUD admin com validação e listagem pública com cache; políticas RLS revisadas.
- Calculadoras: precisão validada por testes e cenários documentados.
- IA: resposta single-turn consistente, com suporte a anexos e busca limitada.
- Frontend: autenticação, proteção de rotas, UX básico funcional.
- DevOps: deploy automatizado por serviço, migrations seguras, logs e rastreamento de erros ativos.

## 24. Plano de Evolução Pós-MVP

- Adicionar SSE por padrão ao AI e cancelar requisição.
- Introduzir filas (BullMQ/Redis) caso cálculos/IA demandem processamento assíncrono.
- Refinar design system (packages/ui) e documentação (Storybook).
- Expandir observabilidade com traces e métricas customizadas.
- Avaliar migração de DB para Railway se latência/performance exigir.