# 🌐 Processa AI - Frontend

Frontend da aplicação Processa AI - plataforma de tecnologia jurídica com IA.

## 🚀 Tech Stack

- **React 19** - UI library
- **Vite** - Build tool
- **React Router DOM** - Routing
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **Supabase** - Auth & Database client
- **Lucide React** - Icons

## 📦 Deploy

### Railway (Produção - SEM NGINX)

O frontend usa **Nixpacks** do Railway com `serve` para servir arquivos estáticos.

**Arquivos importantes:**
- `nixpacks.toml` - Configura build e start
- `railway.json` - Config Railway (opcional)
- `package.json` - Script "serve" para produção

**Não usa:**
- ❌ Dockerfile
- ❌ nginx
- ❌ docker-entrypoint.sh

**Como deployar:**
1. Configure Root Directory: `apps/web`
2. Build Method: Nixpacks (automático)
3. Env vars:
   ```
   VITE_BACKEND_URL=https://seu-backend.railway.app
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. Deploy! ✅

Veja [DEPLOY_RAILWAY.md](../../DEPLOY_RAILWAY.md) para detalhes.

## 🛠️ Development

### Instalar dependências:
```bash
# No root do monorepo
npm install
```

### Rodar dev server:
```bash
npm run dev --workspace=@processa-ai/web
# ou
cd apps/web
npm run dev
```

Abre em http://localhost:5173

### Build para produção:
```bash
npm run build --workspace=@processa-ai/web
```

### Preview do build:
```bash
npm run preview --workspace=@processa-ai/web
```

### Servir build (como em produção):
```bash
npm run serve --workspace=@processa-ai/web
```

## 🔧 Configuração

### Environment Variables

Crie `.env` na pasta `apps/web`:

```bash
# Backend API
VITE_BACKEND_URL=http://localhost:8000

# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Environment
NODE_ENV=development
```

**IMPORTANTE:**
- Variáveis devem começar com `VITE_` para serem acessíveis no código
- São embedadas no build (não são runtime)
- Nunca coloque secrets (use ANON key, não SERVICE_ROLE)

## 📁 Estrutura

```
apps/web/
├── public/             # Assets estáticos
├── src/
│   ├── components/     # Componentes React
│   ├── pages/          # Páginas (routes)
│   ├── core/           # Lógica core (API client, auth)
│   ├── shared/         # Utilitários compartilhados
│   ├── App.tsx         # Componente raiz + rotas
│   ├── main.tsx        # Entry point
│   └── index.css       # Estilos globais + Tailwind
├── .env                # Env vars locais
├── .env.example        # Template de env vars
├── nixpacks.toml       # Config Railway (Nixpacks)
├── railway.json        # Config Railway (opcional)
├── vercel.json         # Config Vercel (se usar)
├── vite.config.ts      # Config Vite
├── tailwind.config.js  # Config Tailwind
└── package.json        # Dependencies e scripts
```

## 🔐 Autenticação

O frontend usa Supabase Auth + API Gateway:

1. **Login/Register:** Chama API Gateway `/api/auth/*`
2. **Tokens:** Armazena JWT retornado pela API
3. **Requests autenticados:** Adiciona header `Authorization: Bearer {token}`

## 🎨 Estilo

**Tailwind CSS** com theme customizado:

**Cores:**
- `primary-*` - Azul (#123365)
- `secondary-*` - Dourado (#a88e3e)

**Classes utilitárias customizadas:**
- `.btn-primary` - Botão primário
- `.btn-secondary` - Botão secundário
- `.card` - Card container
- `.input-field` - Input de formulário

## 🧪 Testing

```bash
# Lint
npm run lint --workspace=@processa-ai/web

# Type check
cd apps/web && npx tsc --noEmit
```

## 📝 Scripts

| Script | Descrição |
|--------|-----------|
| `dev` | Inicia dev server (Vite) |
| `build` | Build para produção |
| `preview` | Preview do build (Vite) |
| `serve` | Serve build com `serve` (Railway) |
| `lint` | Roda ESLint |

## 🐛 Troubleshooting

### Erro: "Cannot find module '@/...'"

**Causa:** Path aliases não configurados

**Solução:** Já configurado em `vite.config.ts` e `tsconfig.json`

### Erro: CORS blocked

**Causa:** API Gateway não aceita origem

**Solução:** Configure `FRONTEND_URL` no backend

### Build lento

**Causa:** Bundle size grande

**Solução:**
- Lazy load routes com `React.lazy()`
- Analyze bundle: `npm run build -- --mode analyze`

## 📚 Documentação

- [Deploy Railway](../../DEPLOY_RAILWAY.md)
- [Estratégia Deploy Monorepo](../../DEPLOY_ESTRATEGIA.md)

## 🤝 Contribuindo

1. Crie feature branch
2. Faça suas mudanças
3. Teste localmente
4. Commit e push
5. Crie PR

---

**Última atualização:** 2025-11-04
