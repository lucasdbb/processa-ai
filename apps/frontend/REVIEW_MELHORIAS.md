# Revisão Técnica do Frontend (Next.js)

Este documento lista pontos de melhoria identificados no projeto `apps/frontend`, com foco em **UX/UI**, **performance**, **segurança** e **boas práticas**.

## Prioridade Alta (recomendado corrigir antes de produção)

### 1) Build “verde” artificial (riscos reais indo para produção)

- Em `apps/frontend/next.config.ts:19-25` o projeto desativa validações essenciais:
  - `eslint.ignoreDuringBuilds: true`
  - `typescript.ignoreBuildErrors: true`
- Impacto: erros de lint e de tipos podem passar despercebidos e virar bug em runtime, inclusive em rotas críticas (ex.: auth e admin).
- Recomendações:
  - Reativar ambas as checagens e corrigir os erros reais.
  - Se existe um caso específico bloqueando o build (ex.: SSR/Radix), isolar o problema (rota/componente) em vez de desligar o alarme do projeto inteiro.

### 2) Política de imagens muito permissiva

- Em `apps/frontend/next.config.ts:10-16`, `images.remotePatterns` permite `hostname: '**'`.
- Impacto:
  - Superfície desnecessária para abuso (ex.: servir conteúdo de domínios arbitrários), além de piorar previsibilidade de cache e otimização.
- Recomendações:
  - Trocar por uma allowlist explícita dos hosts realmente usados.

### 3) Autorização no middleware faz roundtrip para o backend (latência no admin)

- Em `apps/frontend/src/lib/supabase/middleware.ts:26-55` o middleware chama `/api/auth/me` a cada request em rotas protegidas.
- Impacto:
  - Piora tempo de resposta percebido (principalmente no `/admin`), e fica sensível a instabilidade do backend.
  - O middleware do Next roda em ambiente “edge-like”; chamadas extras aqui geralmente custam caro no UX.
- Recomendações (ordem sugerida):
  - Minimizar chamadas: cachear o resultado (quando viável) ou reduzir a verificação para o mínimo necessário.
  - Preferir validar autorização **sem** roundtrip quando possível (ex.: cookie assinado com claims de role / sessão, com validação local).
  - Se roundtrip for inevitável, garantir timeouts curtos e fallback consistente.

### 4) Tokens no payload de login/register (exposição desnecessária)

- Em `apps/frontend/src/features/auth/services/auth-service.ts:23-38` e `:44-59`, o retorno tipado inclui `access_token` e `refresh_token`.
- Observação: o código afirma que usa **httpOnly cookies** (o que é bom), então expor tokens no JSON tende a ser redundante.
- Impacto:
  - Aumenta risco de vazamento via logs, devtools, interceptadores, analytics, erro de UI, etc.
- Recomendações:
  - Ajustar contrato: retornar apenas `user` (e/ou metadados não sensíveis) quando cookies httpOnly forem a fonte de verdade.
  - Se o backend precisa retornar token por algum motivo, delimitar claramente onde ele é usado e impedir persistência acidental.

## Segurança (hardening recomendado)

### 5) CSRF e cookies de sessão

- Como a autenticação é via cookies (incluindo `credentials: include` em `apps/frontend/src/lib/fetch.ts:18-24`), vale garantir uma estratégia explícita de CSRF.
- Recomendações:
  - Preferir cookies com `SameSite=Strict` quando possível; se `Lax` for necessário, combinar com CSRF token.
  - Para endpoints mutáveis (`POST/PATCH/DELETE`), exigir um header anti-CSRF (double submit cookie ou token de sessão).

### 6) Evitar utilitários que incentivem tokens em cookies JS

- `apps/frontend/src/lib/cookies.ts:1-44` expõe helpers de `document.cookie` e menciona “authentication tokens”.
- Impacto:
  - Se for usado para token sensível, vira alvo de XSS (perde o benefício do httpOnly).
- Recomendações:
  - Remover o utilitário se não for usado, ou restringir o escopo para cookies não sensíveis (preferências UI) e renomear para refletir isso.

### 7) Headers de segurança

- O projeto não configura headers de hardening no Next config (ex.: CSP, frame-ancestors, etc.).
- Recomendações:
  - Adicionar headers em `apps/frontend/next.config.ts` (via `headers()`), alinhados ao uso real do app.
  - Começar com `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, e uma CSP inicial (mesmo que permissiva) e ir apertando.

## UX/UI (melhorias pragmáticas)

### 8) Loading e estados intermediários (consistência)

- Existe `apps/frontend/src/app/loading.tsx`, e alguns `loading.tsx` por rota, mas o `/admin` tende a parecer “travado” se o middleware + dados demoram.
- Recomendações:
  - Garantir skeleton/spinner “acima da dobra” em rotas sensíveis (admin/blog post) para reduzir sensação de travamento.
  - Incluir estados vazios e de erro com ações claras (“tentar novamente”, “voltar”).

### 9) Acessibilidade (A11y)

- Como há uso de Radix/shadcn, a base é boa, mas vale fechar o ciclo:
  - “Skip link” para o conteúdo principal.
  - `aria-live` para toasts e carregamentos importantes.
  - Foco visível consistente (teclado).

### 10) Páginas padrão do App Router

- Não há `not-found.tsx` e `error.tsx` em `apps/frontend/src/app/`.
- Recomendações:
  - Criar `not-found.tsx` e `error.tsx` para garantir UX consistente e reduzir páginas “brancas” em erro.

## Performance (ganhos rápidos)

### 11) Estratégia de cache por domínio de dados

- `fetchWithCredentials` define `cache: 'no-store'` por padrão (`apps/frontend/src/lib/fetch.ts:18-24`).
- Isso é correto para **auth** e dados sensíveis, mas pode ser caro para dados públicos (ex.: blog).
- Recomendações:
  - Separar clientes/funções: um para auth (no-store) e outro para conteúdo público com `revalidate`/cache.

### 12) Reduzir dependências não utilizadas

- A pasta `apps/frontend/src/lib/supabase/*` parece não ser consumida fora dela (referências não encontradas além dos próprios arquivos).
- Recomendações:
  - Se a integração Supabase ainda não é usada, remover para reduzir complexidade.
  - Se é parte do roadmap, integrar de forma explícita (com exemplos/uso real) para justificar sua presença.

## Boas práticas (qualidade e evolução)

### 13) Padronizar tratamento de erros de API

- Em `apps/frontend/src/features/auth/services/auth-service.ts`, erros assumem `response.json()` (`:32-35`, `:53-56`).
- Impacto: se o backend responder HTML/texto (proxy, 502, timeout), isso pode virar erro secundário e esconder a causa.
- Recomendações:
  - Criar um helper único: parse seguro do erro + mensagens consistentes + mapeamento por status.
  - Evitar `console.error` direto (ex.: `apps/frontend/src/features/auth/services/auth-service.ts:91-92` e `apps/frontend/src/lib/supabase/middleware.ts:57-58`), preferindo uma camada de logging/telemetria.

### 14) Validar env vars com mensagens claras

- Supabase usa non-null assertion em `apps/frontend/src/lib/supabase/client.ts:8-11` e `server.ts:11-14`.
- Recomendações:
  - Criar validação central de env (falhar cedo com erro legível), evitando `!` espalhado.

## Sugestão de roadmap (sequência pragmática)

1. Reativar `eslint` e `typescript` no build e corrigir os erros.
2. Resolver gargalo do `/admin` reduzindo roundtrips no middleware.
3. Ajustar contrato de login/register para não expor tokens no JSON.
4. Implementar headers de segurança + estratégia anti-CSRF.
5. Padronizar erros/empty states e adicionar `error.tsx`/`not-found.tsx`.

