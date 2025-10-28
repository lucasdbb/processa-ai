# 🚀 Processa AI - API

Backend da aplicação Processa AI construído com TypeScript e Vercel Functions.

## 📁 Estrutura

```
apps/api/
├── src/                    # Código fonte das funções serverless
│   └── auth/              # Endpoints de autenticação
│       ├── login.ts       # POST /api/auth/login
│       ├── logout.ts      # POST /api/auth/logout
│       ├── me.ts          # GET /api/auth/me
│       ├── refresh.ts     # POST /api/auth/refresh
│       └── register.ts    # POST /api/auth/register
├── lib/                   # Utilitários e configurações
│   └── supabase.ts       # Cliente Supabase
├── middleware/            # Middlewares compartilhados
│   └── auth.ts           # Middleware de autenticação
├── types/                 # Tipos específicos da API
├── package.json          # Dependências da API
├── tsconfig.json         # Configuração TypeScript
└── vercel.json           # Configuração de deploy
```

## 🔗 Endpoints

### Autenticação (`/api/auth/*`)
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login de usuário
- `POST /api/auth/logout` - Logout de usuário
- `GET /api/auth/me` - Dados do usuário atual
- `POST /api/auth/refresh` - Refresh do token

## 🛠️ Desenvolvimento

```bash
# Instalar dependências
npm install

# Build da API
npm run build

# Type check
npm run type-check
```

## 🚀 Deploy

A API é deployada automaticamente como Vercel Functions. Cada arquivo em `src/` se torna um endpoint serverless.

### Configuração:
- **Runtime**: Node.js (@vercel/node)
- **Roteamento**: `/api/*` → `/src/*`
- **Environment**: Variáveis configuradas no Vercel Dashboard

## 🔐 Autenticação

Utiliza Supabase Auth com middleware personalizado para proteção de rotas.

## 📦 Dependências

- **@processa-ai/types** - Tipos compartilhados
- **@supabase/supabase-js** - Cliente Supabase
- **TypeScript** - Linguagem principal