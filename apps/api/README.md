# Processa AI - API Backend

API serverless construída com Vercel Functions para autenticação e serviços do Processa AI.

## Estrutura do Projeto

```
apps/api/
├── api/                    # Diretório raiz das funções Vercel
│   ├── auth/              # Endpoints de autenticação
│   │   ├── login.ts       # POST /api/auth/login
│   │   ├── logout.ts      # POST /api/auth/logout
│   │   ├── me.ts          # GET /api/auth/me
│   │   ├── refresh.ts     # POST /api/auth/refresh
│   │   └── register.ts    # POST /api/auth/register
│   └── index.ts           # GET /api (health check)
├── lib/                   # Módulos compartilhados
│   ├── auth.ts            # Middlewares de autenticação e CORS
│   ├── env.ts             # Validação de variáveis de ambiente
│   ├── errors.ts          # Sistema de erros padronizados
│   ├── supabase.ts        # Clientes Supabase (admin e user)
│   └── validators.ts      # Validadores reutilizáveis
├── package.json
├── tsconfig.json
└── vercel.json            # Configuração do Vercel
```

**Importante:** Os arquivos em `api/` são funções serverless (endpoints). Os arquivos em `lib/` são módulos compartilhados importados com paths relativos `../../lib/nome.js`.

## Endpoints Disponíveis

### Health Check
- **GET /api** - Verifica o status da API e serviços

### Autenticação
- **POST /api/auth/register** - Criar nova conta
- **POST /api/auth/login** - Fazer login
- **GET /api/auth/me** - Obter dados do usuário autenticado (requer token)
- **POST /api/auth/refresh** - Renovar token de acesso
- **POST /api/auth/logout** - Fazer logout (requer token)

## Variáveis de Ambiente Necessárias

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
FRONTEND_URL=http://localhost:5173  # Pode ser múltiplos, separados por vírgula
NODE_ENV=production
```

## Recursos de Segurança

### Validação de Senha
As senhas devem atender aos seguintes requisitos:
- Mínimo 8 caracteres
- Pelo menos uma letra maiúscula
- Pelo menos uma letra minúscula
- Pelo menos um número

### CORS
- Configurado para aceitar múltiplos origins (via `FRONTEND_URL`)
- Suporte a credenciais
- Resposta automática a requisições OPTIONS

### Headers de Segurança
Aplicados automaticamente via `vercel.json`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Desenvolvimento local
npm run dev

# Type checking
npm run type-check

# Deploy para produção
npm run deploy
```

## Middlewares

### `withCors`
Adiciona headers CORS e trata requisições OPTIONS.

### `withAuth`
Valida Bearer token e popula `req.user` com dados do usuário autenticado.

### `compose`
Permite composição funcional de múltiplos middlewares:

```typescript
export default compose(withCors, withAuth)(handler);
```

## Estrutura de Imports

Como o projeto usa ES Modules (`"type": "module"` no package.json), todos os imports precisam incluir a extensão `.js`:

```typescript
// Em api/auth/login.ts
import { supabaseAdmin } from '../../lib/supabase.js';
import { withCors } from '../../lib/auth.js';
import { validateEmail } from '../../lib/validators.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';
```

## Troubleshooting

### Erro de módulo não encontrado
Certifique-se de que todos os imports:
1. Usam paths relativos corretos da localização do arquivo
2. Incluem a extensão `.js` (necessário para ESM no Node.js)

```typescript
// ✓ Correto em api/auth/login.ts
import { withCors } from '../../lib/auth.js';

// ✗ Incorreto - falta .js
import { withCors } from '../../lib/auth';

// ✗ Incorreto - path errado
import { withCors } from '../lib/auth.js';
```

### Erro de variáveis de ambiente
Certifique-se de configurar todas as variáveis necessárias:
- No dashboard da Vercel para produção
- Em arquivo `.env` para desenvolvimento local

### Build local falha mas funciona na Vercel
O Vercel usa o próprio bundler que pode resolver alguns paths automaticamente. Se funciona na Vercel mas não localmente com `npm run dev`, verifique as extensões `.js` nos imports.
