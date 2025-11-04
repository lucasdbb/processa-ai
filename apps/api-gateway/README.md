# API Gateway - Processa AI

API Gateway central que orquestra autenticação e roteamento para os microserviços.

## 🚀 Funcionalidades

- ✅ Autenticação (Login, Register, Logout)
- ✅ Validação de JWT tokens
- ✅ CORS configurado
- ✅ Rate limiting (futuro)
- ✅ Health checks
- ✅ Structured logging (Pino)
- ✅ Error handling padronizado

## 📦 Tecnologias

- **Node.js 20** + TypeScript
- **Express.js** - HTTP server
- **Supabase** - Auth + Database
- **Pino** - Logging
- **Helmet** - Security headers
- **Zod** - Validação de env vars

## 🧪 Testes

Collection do Postman disponível em **[docs/](./docs/)** com todos os endpoints documentados e prontos para testar.

## 🛠️ Desenvolvimento

```bash
# Instalar dependências (root do monorepo)
npm install

# Desenvolvimento com hot reload
npm run dev --workspace=@processa-ai/api-gateway

# Build
npm run build --workspace=@processa-ai/api-gateway

# Type check
npm run type-check --workspace=@processa-ai/api-gateway
```

## 🌐 Endpoints

### Autenticação

- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/logout` - Logout (requer auth)
- `GET /api/auth/me` - Dados do usuário (requer auth)

### Health Check

- `GET /api/health` - Status do serviço

## 📝 Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
FRONTEND_URL=http://localhost:5173
```

## 🐳 Docker

```bash
# Build
docker build -t processa-api-gateway -f apps/api-gateway/Dockerfile .

# Run
docker run -p 3000:3000 --env-file apps/api-gateway/.env processa-api-gateway
```

## 🏗️ Estrutura

```
src/
├── features/           # Features do gateway
│   └── auth/          # Autenticação
├── shared/            # Código compartilhado
│   ├── middleware/    # Middlewares Express
│   ├── errors/        # Classes de erro
│   └── utils/         # Utilitários
├── infrastructure/    # Infraestrutura
│   ├── supabase/      # Supabase clients
│   └── monitoring/    # Logging
├── config/            # Configurações
└── routes/            # Express routes
```

## 📚 Próximos Passos

- [ ] Adicionar rate limiting (Redis)
- [ ] Implementar proxy para blog-service
- [ ] Implementar proxy para ai-chat-service
- [ ] Implementar proxy para calculator-service
- [ ] Adicionar métricas (Prometheus)
- [ ] Testes unitários e integração
