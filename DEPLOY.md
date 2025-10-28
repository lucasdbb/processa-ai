# 🚀 Guia de Deploy - Processa AI Monorepo

Este guia explica como fazer o deploy do monorepo Processa AI na Vercel.

## 📋 Pré-requisitos

1. **Conta na Vercel** - [vercel.com](https://vercel.com)
2. **Vercel CLI instalado** - `npm i -g vercel`
3. **Variáveis de ambiente configuradas**
4. **Build funcionando localmente**

## 🏗️ Estratégias de Deploy

### Opção 1: Deploy Separado (Recomendado)

Deploy de cada app como projeto independente na Vercel.

#### Frontend (apps/web):
```bash
cd apps/web
vercel --prod
```

#### API (apps/api):
```bash
cd apps/api  
vercel --prod
```

**Vantagens:**
- ✅ Builds independentes e mais rápidos
- ✅ Configurações específicas por app
- ✅ Melhor isolamento de recursos
- ✅ Deploys independentes

### Opção 2: Deploy Unificado

Deploy de todo o monorepo como um único projeto Vercel.

#### Configuração:
- ✅ `vercel.json` na raiz (apenas para API)
- ✅ `.vercelignore` para otimizar upload
- ✅ Scripts de build configurados

#### Comandos:
```bash
# Deploy de preview
npm run deploy:preview

# Deploy de produção
npm run deploy
```

**Nota:** Esta opção é mais complexa e pode ter limitações.

## 🔧 Configuração das Variáveis de Ambiente

⚠️ **IMPORTANTE**: Configure as variáveis de ambiente diretamente no Vercel Dashboard, não use secrets no vercel.json.

### Como Configurar no Vercel Dashboard:

1. Acesse seu projeto no [Vercel Dashboard](https://vercel.com/dashboard)
2. Vá em **Settings** → **Environment Variables**
3. Adicione as seguintes variáveis:

#### Para o Frontend (apps/web):
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
VITE_API_URL=https://seu-projeto.vercel.app/api
```

#### Para a API (apps/api):
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anonima-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-aqui
FRONTEND_URL=https://seu-projeto.vercel.app
```

### Valores para cada Environment:
- **Production**: Use para deploy de produção
- **Preview**: Use para deploys de preview/staging
- **Development**: Use para desenvolvimento local (opcional)

### Exemplo de configuração via CLI:
```bash
# Via CLI (alternativo)
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_API_URL
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add FRONTEND_URL
```

## 📦 Processo de Build

### Build Order:
1. **Types Package** (`packages/types`) - Compilado primeiro
2. **Frontend** (`apps/web`) - Usa os types compilados
3. **API** (`apps/api`) - Usa os types compilados

### Build Command:
```bash
npm run vercel:build
```

Este comando:
1. Compila o package `@processa-ai/types`
2. Compila o frontend com Vite
3. Prepara as funções da API

## 🌐 Configuração de Domínio

### Domínios Sugeridos:
- **Frontend**: `processa-ai.vercel.app` ou domínio customizado
- **API**: Mesmo domínio com `/api/*` routes

### CORS Configuration:
A API está configurada para aceitar requests do frontend automaticamente via `FRONTEND_URL`.

## 🔄 Workflow de Deploy

### 1. Deploy de Preview (Desenvolvimento)
```bash
# Testa mudanças antes da produção
npm run deploy:preview
```

### 2. Deploy de Produção
```bash
# Deploy final para produção
npm run deploy
```

### 3. Deploy Automático (GitHub)
Configure no Vercel Dashboard para deploy automático em:
- **Preview**: Pull Requests
- **Produção**: Push para `main`

## 📊 Monitoramento

### Logs da API:
```bash
vercel logs [deployment-url]
```

### Métricas:
- Acesse o Vercel Dashboard
- Veja Analytics e Performance

## 🐛 Troubleshooting

### Erro de Build:
```bash
# Limpa cache e rebuilda
npm run clean
npm run build
```

### Erro de Types:
```bash
# Rebuilda apenas os types
npm run types:build
```

### Erro de CORS:
- Verifique se `FRONTEND_URL` está configurado corretamente
- Confirme que o middleware de CORS está ativo

### Erro de Supabase:
- Verifique as variáveis de ambiente
- Confirme as permissões RLS no Supabase

## 📁 Estrutura de Deploy

```
Vercel Project
├── Frontend (apps/web/dist) → Servido na raiz "/"
├── API (apps/api/src/*) → Servido em "/api/*"
└── Types (packages/types) → Compilado e usado pelos apps
```

## 🔐 Segurança

### Variáveis Sensíveis:
- ❌ Nunca commite `.env` files
- ✅ Use Vercel Environment Variables
- ✅ Configure diferentes envs para preview/produção

### CORS:
- ✅ Configurado automaticamente via `FRONTEND_URL`
- ✅ Middleware de autenticação ativo

## 📈 Performance

### Otimizações Ativas:
- ✅ Tree-shaking no Vite
- ✅ Code splitting automático
- ✅ Compressão de assets
- ✅ Edge Functions para API

### Métricas Esperadas:
- **First Load**: < 3s
- **API Response**: < 500ms
- **Lighthouse Score**: > 90

---

## 🚀 Quick Start

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Testar build local
npm run build

# 4. Deploy de preview
npm run deploy:preview

# 5. Deploy de produção
npm run deploy
```

Para mais detalhes, consulte a [documentação da Vercel](https://vercel.com/docs).