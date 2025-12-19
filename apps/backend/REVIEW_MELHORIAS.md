# Revisão Técnica do Backend (FastAPI)

Este documento lista pontos de melhoria identificados no projeto `apps/backend`, com foco em **segurança**, **confiabilidade/performance**, **boas práticas** e **manutenibilidade**.

## Prioridade Alta (recomendado corrigir antes de produção)

### 1) Escalada de privilégio via `user_metadata.role` (risco crítico)

- O gatilho que cria `public.profiles` copia `role` de `auth.users.raw_user_meta_data`:
  - `apps/backend/supabase/migrations/20250102000001_initial_schema.sql:64-76`
  - `apps/backend/supabase/migrations/20250103000001_add_profile_fields.sql:18-33`
- Em Supabase, `user_metadata` é controlável pelo cliente. Isso abre brecha para alguém se registrar definindo `role='admin'` e ganhar permissão.
- Isso também aparece nas policies de admin por JWT:
  - `apps/backend/supabase/migrations/20250103000002_fix_rls_policies.sql:12-35`

Recomendação:
- Nunca basear autorização em `user_metadata` para papéis/permissões.
- Migrar a fonte de verdade do papel para um local que o usuário não consegue alterar:
  - Preferência: `app_metadata` (setável apenas via Admin API) e/ou tabela `profiles.role` atualizada apenas por rotas/admins.
- Ajustar o trigger para sempre criar `profiles.role = 'user'` e promover a admin por fluxo separado.
- Ajustar as RLS policies para usar `app_metadata` (ou uma função segura), não `user_metadata`.

### 2) Service role key usado como cliente global (impacto alto se houver bug)

- O cliente Supabase global é criado com `SUPABASE_SERVICE_ROLE_KEY`:
  - `apps/backend/src/shared/database.py:4-7`
- Impacto:
  - Todas as queries via backend rodam com privilégios máximos (bypass de RLS). Um bug de autorização vira vazamento/alteração de dados em escala.

Recomendação:
- Separar explicitamente:
  - Um cliente “service role” apenas para operações administrativas inevitáveis.
  - Um cliente “user-scoped” (usando o token do usuário) para operações normais, deixando RLS fazer o trabalho.
- Se o design for “RBAC no backend”, endurecer validações e auditoria (logs + testes) e habilitar RLS mesmo assim como “segunda barreira”.

### 3) CORS permissivo com `allow_credentials=True`

- CORS permite `allow_methods=["*"]` e `allow_headers=["*"]` com cookies:
  - `apps/backend/src/main.py:33-44`
- Impacto:
  - Qualquer origem indevidamente adicionada em `ALLOWED_ORIGINS` passa a conseguir fazer chamadas autenticadas via browser.

Recomendação:
- Restringir métodos e headers ao mínimo necessário (ex.: `GET,POST,PATCH,PUT,DELETE` e headers específicos).
- Garantir que `ALLOWED_ORIGINS` em produção seja uma allowlist curta e auditável.

### 4) Inconsistência de papéis: “author” no produto, “admin” na API

- O frontend permite acesso ao admin para `admin` e `author` (pela conversa do projeto), mas o backend bloqueia `author` em rotas admin:
  - `apps/backend/src/core/dependencies.py:72-99` (somente `admin`)
  - `apps/backend/src/features/blog/router.py:17-31` (admin-only)
  - `apps/backend/src/features/blog/service.py:314-320` (autor pode criar rascunho)

Recomendação:
- Definir claramente RBAC (ex.: `admin`, `author`, `user`) e padronizar:
  - Dependências `get_current_admin`/`get_current_author` com regras explícitas.
  - Rotas `/admin/*` e operações de blog coerentes com as permissões do frontend.

## Segurança (hardening recomendado)

### 5) Cookies de auth: refresh não usa cookie e não rotaciona tokens

- Login/registro setam cookies `access_token` e `refresh_token`:
  - `apps/backend/src/features/auth/router.py:26-54`
- O endpoint `/refresh` recebe `refresh_token` no corpo da requisição:
  - `apps/backend/src/features/auth/router.py:107-110`

Recomendação:
- Para browser, preferir refresh via cookie httpOnly (reduz risco de vazamento em logs e interceptadores).
- Rotacionar refresh tokens (quando suportado) e atualizar cookies no refresh.
- No logout, opcionalmente invalidar sessão/refresh token no Supabase (não apenas limpar cookies):
  - `apps/backend/src/features/auth/router.py:125-129`

### 6) Falhas silenciosas e logs frágeis (perde rastreabilidade)

- Uso de `print` em produção:
  - `apps/backend/src/features/auth/service.py:180`
  - `apps/backend/src/features/users/service.py:158`
- Muitos `except Exception` retornam erro genérico sem log contextual (ex.: `apps/backend/src/core/dependencies.py:65-69`).

Recomendação:
- Trocar `print` por logging consistente (`apps/backend/src/core/logging.py:8-14`).
- Logar exceções com contexto (endpoint, user_id, correlation id) e sem vazar segredos.
- Evitar capturar `Exception` sem re-raise/log; diferenciar erro de autenticação vs erro interno.

### 7) RLS ausente em tabelas novas (support/newsletter)

- `support_requests` e `newsletter_subscriptions` são criadas sem `ENABLE ROW LEVEL SECURITY` e sem policies:
  - `apps/backend/supabase/migrations/20251203000001_create_support_requests.sql:1-16`
  - `apps/backend/supabase/migrations/20251203000002_create_newsletter_subscriptions.sql:1-16`

Recomendação:
- Habilitar RLS e criar policies mínimas (leitura/atualização por dono; admin para listar; inserção pública quando necessário).

## Performance e Confiabilidade

### 8) Cliente Supabase síncrono em endpoints `async` (risco de bloquear o event loop)

- Os services fazem chamadas `.execute()` em métodos `async` (ex.: `apps/backend/src/features/users/service.py:21-23`, `apps/backend/src/features/blog/service.py:46-47`).

Impacto:
- Sob carga, chamadas síncronas podem bloquear o loop e derrubar throughput/latência.

Recomendação:
- Migrar para I/O assíncrono (client async / httpx) ou encapsular o acesso síncrono com `anyio.to_thread.run_sync`.
- Adicionar timeout e retries controlados para chamadas externas.

### 9) Operações multi-passos sem transação (inconsistência possível)

- Blog: criar post, depois tags, depois authors, com vários `try/except` que silenciam falhas:
  - `apps/backend/src/features/blog/service.py:360-406`

Recomendação:
- Usar transação (quando possível via Supabase/Postgres) para garantir atomicidade.
- Se não for viável, pelo menos retornar ao cliente um estado consistente e registrar falhas para reprocesso.

### 10) Newsletter: fluxo de confirmar/cancelar conflita com o próprio token

- `confirm()` zera `confirmation_token` (`None`), mas `unsubscribe()` procura pelo mesmo token:
  - `apps/backend/src/features/newsletter/service.py:104-109`
  - `apps/backend/src/features/newsletter/service.py:143-156`

Recomendação:
- Separar tokens (ex.: `confirm_token` e `unsubscribe_token`) ou manter um token válido para cancelar.
- Tratar conflito de `unique index` com resposta adequada (409 / idempotência):
  - `apps/backend/supabase/migrations/20251203000002_create_newsletter_subscriptions.sql:15`
  - `apps/backend/src/features/newsletter/service.py:49-63`

## Boas práticas de API e Modelagem

### 11) Padronização de naming (camelCase vs snake_case)

- Schemas e payloads misturam `documentType`/`documentNumber`, `contactPreference`, `isClient`:
  - `apps/backend/src/features/users/schemas.py:34-36`
  - `apps/backend/src/features/support/schemas.py:12-15`

Recomendação:
- Padronizar contrato HTTP (ideal: snake_case em API Python) e, se necessário, aceitar aliases no Pydantic.
- Evita mapeamentos manuais e bugs de campo.

### 12) Validação insuficiente em blog (tamanho/formatos)

- `BlogPostCreate` não limita tamanho de `title/content` nem valida URLs:
  - `apps/backend/src/features/blog/schemas.py:6-14`

Recomendação:
- Adicionar constraints (min/max), validação de URL, e saneamento/normalização quando necessário.

### 13) Condição confusa no update de profile

- A checagem de “nenhum dado para atualizar” é difícil de ler e pode ter comportamento inesperado:
  - `apps/backend/src/features/users/service.py:86-90`

Recomendação:
- Simplificar para uma condição explícita (ex.: sem updates e `newsletter_opt_in is None`).

## Operação / Deploy

### 14) Docker build não fixa lockfile e entrypoint pouco idiomático

- O Dockerfile copia apenas `pyproject.toml` e não copia `uv.lock`:
  - `apps/backend/Dockerfile:10-14`
- `CMD` roda `python src/main.py`, que por sua vez chama `uvicorn.run`:
  - `apps/backend/Dockerfile:21`
  - `apps/backend/src/main.py:57-67`

Recomendação:
- Copiar `uv.lock` para builds reprodutíveis.
- Rodar `uvicorn` diretamente no container com configuração de workers/timeouts.

## Sugestão de roadmap (sequência pragmática)

1. Corrigir escalada de privilégio: remover `role` de `user_metadata` (trigger + policies + fluxo admin).
2. Separar cliente Supabase service-role vs user-scoped e reforçar autorização.
3. Endurecer CORS e alinhar RBAC (admin/author) com o frontend.
4. Eliminar `print`, melhorar logging e observabilidade (correlation id + logs de erro).
5. Tornar I/O realmente assíncrono (ou isolar sync), adicionar timeouts/retries.
6. Consertar fluxo da newsletter (tokens e idempotência) e aplicar RLS nas novas tabelas.

