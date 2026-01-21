# Processa AI - Monorepo

Uma plataforma completa de tecnologia jurídica para cálculos trabalhistas, assistência com IA e blog especializado, desenvolvida com Vite + React 19 (frontend) e Python 3.13 + FastAPI (backend), utilizando Supabase.

## 🏗️ Estrutura do Monorepo

```
processa-ai/
├── apps/
│   ├── frontend/           # Frontend Vite 7 + React 19 + TypeScript
│   │   ├── src/            # Código fonte
│   │   ├── Dockerfile      # Container Vite
│   │   └── package.json
│   └── backend/            # Backend Python 3.13 + FastAPI
│       ├── src/            # Código fonte
│       ├── Dockerfile      # Container FastAPI
│       └── pyproject.toml
├── docker-compose.yml      # Orquestração de serviços (dev)
├── docker-compose.prod.yml # Override para produção
├── .env.example            # Exemplo de variáveis de ambiente
├── .dockerignore           # Arquivos ignorados no build Docker
└── package.json            # Workspace raiz (npm)
```

## 🚀 Funcionalidades

### Implementadas ✅
- **Blog Jurídico**: Sistema completo de blog com editor Markdown, categorias e admin dashboard
- **Autenticação Segura**: Login, registro e recuperação de senha via Supabase Auth
- **Newsletter**: Sistema de inscrição e gerenciamento de newsletter
- **Suporte**: Formulário de contato integrado
- **Interface Moderna**: Design responsivo com Next.js, Server Components e shadcn/ui
- **API Documentada**: FastAPI com documentação automática (Swagger/ReDoc)

### Em Desenvolvimento 🚧
- **Calculadoras Trabalhistas**: Cálculos precisos de rescisão e aposentadoria
- **Assistente IA**: Geração de textos jurídicos e análises com inteligência artificial

## 🛠️ Tecnologias

### Frontend (apps/frontend)
- **Framework**: Vite 7
- **UI Library**: React 19 + TypeScript 5.9
- **Routing**: React Router 7
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui (Radix UI primitives)
- **State**: Zustand 5.0
- **Forms**: react-hook-form + Zod
- **Auth**: Supabase JS (@supabase/supabase-js)
- **Icons**: lucide-react
- **Markdown**: @uiw/react-md-editor

### Backend (apps/backend)
- **Language**: Python 3.13
- **Framework**: FastAPI
- **Package Manager**: uv (ultra-fast)
- **Server**: Uvicorn (ASGI)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Validation**: Pydantic 2.10
- **Linter**: Ruff

## 📦 Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/processa-ai.git
cd processa-ai
```

### 2. Instale as dependências

**Frontend (Vite + React):**
```bash
cd apps/frontend
npm install
```

**Backend (Python):**
```bash
cd apps/backend
# Instalar uv (se não tiver)
pip install uv
# Sincronizar dependências
uv sync
```

### 3. Configure as variáveis de ambiente

**Frontend (.env.local):**
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

**Backend (.env):**
```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
```

### 4. Inicie o desenvolvimento

#### Opção A: Docker Compose (Recomendado) 🐳

**1. Configure as variáveis de ambiente:**
```bash
cp .env.example .env
# Edite o arquivo .env com suas credenciais do Supabase
```

**2. Inicie todos os serviços:**
```bash
docker-compose up
```

**3. Acesse a aplicação:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

**Comandos úteis:**
```bash
docker-compose up --build      # Rebuild e iniciar (necessário após mudanças no código)
docker-compose up -d           # Rodar em background
docker-compose down            # Parar todos os serviços
docker-compose logs -f         # Ver logs em tempo real
docker-compose logs frontend   # Ver logs do frontend
docker-compose logs backend    # Ver logs do backend
```

**⚠️ Observação:** Como não usamos volumes, você precisará fazer **rebuild** (`docker-compose up --build`) sempre que modificar o código.

#### Opção B: Desenvolvimento Local

**Frontend (porta 3000):**
```bash
cd apps/frontend
npm run dev
```

**Backend (porta 8000):**
```bash
cd apps/backend
uv run uvicorn src.main:app --reload
```

## 🔧 Comandos de Desenvolvimento

### Frontend
```bash
cd apps/frontend
npm run dev              # Servidor de desenvolvimento (porta 5173)
npm run build           # Build de produção
npm run preview         # Preview do build
npm run lint            # ESLint
```

### Backend
```bash
cd apps/backend
uv run uvicorn src.main:app --reload  # Servidor de desenvolvimento (porta 8000)
uv run pytest                         # Executar testes
uv run ruff check src/                # Verificar linting
uv run ruff format src/               # Formatar código
```

## 🌐 Ambientes de Desenvolvimento

### Frontend - Vite
- **URL**: http://localhost:5173
- **Hot Reload**: Automático (HMR ultrarrrápido)
- **Build Tool**: Vite com esbuild

### Backend - FastAPI
- **URL**: http://localhost:8000
- **Documentação Interativa**: http://localhost:8000/docs (Swagger UI)
- **Documentação Alternativa**: http://localhost:8000/redoc (ReDoc)
- **Hot Reload**: Automático com `--reload`

## 📱 Rotas da Aplicação

### Frontend (React Router)
- **`/`** - Landing page (público)
- **`/blog`** - Lista de posts do blog (público)
- **`/blog/:id`** - Post individual (público)
- **`/app/ia`** - Ferramentas de IA (requer autenticação)
- **`/app/calculadoras`** - Calculadoras trabalhistas (requer autenticação)
- **`/planos`** - Planos e preços (público)
- **`/sobre`** - Sobre a plataforma (público)
- **`/admin`** - Dashboard administrativo (requer role admin)

### Backend API (FastAPI)

**Autenticação (`/api/auth`)**
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Recuperar senha
- `POST /api/auth/reset-password` - Redefinir senha
- `POST /api/auth/logout` - Logout

**Usuários (`/api/users`)**
- `GET /api/users/profile` - Ver perfil do usuário
- `PUT /api/users/profile` - Atualizar perfil
- `GET /api/users` - Listar usuários (admin)

**Blog (`/api/blog`)**
- `GET /api/blog/posts` - Listar posts publicados
- `GET /api/blog/posts/{slug}` - Buscar post por slug
- `POST /api/blog/posts` - Criar novo post (admin)
- `PUT /api/blog/posts/{post_id}` - Atualizar post (admin)
- `DELETE /api/blog/posts/{post_id}` - Deletar post (admin)
- `GET /api/blog/categories` - Listar categorias

**Newsletter (`/api/newsletter`)**
- `POST /api/newsletter/subscribe` - Inscrever email
- `POST /api/newsletter/unsubscribe` - Cancelar inscrição

**Suporte (`/api/support`)**
- `POST /api/support/contact` - Enviar mensagem de contato

**Documentação completa:** http://localhost:8000/docs

## 🔐 Autenticação

Sistema robusto de autenticação com Supabase:

### Frontend (Direct Supabase JS)
- **Cliente Supabase JS** (`@supabase/supabase-js`)
- **Sessões via localStorage** com JWT
- **Route guards** (AuthGuard, AdminGuard) para proteção de rotas
- **Refresh automático** de sessão
- **Role-based access control** (client, author, admin)

### Backend (FastAPI + Supabase)
- **Endpoints de autenticação** disponíveis via API
- **JWT validation** com Supabase Auth
- **Protected routes** usando FastAPI dependencies
- **Pydantic schemas** para validação de dados

## 🐳 Docker

### Desenvolvimento com Docker Compose

O projeto inclui configuração Docker Compose para facilitar o desenvolvimento:

**Estrutura:**
- `docker-compose.yml` - Orquestração dos serviços
- `apps/frontend/Dockerfile` - Container Vite
- `apps/backend/Dockerfile` - Container FastAPI

**Benefícios:**
- ✅ Ambiente consistente entre desenvolvedores
- ✅ Isolamento de dependências
- ✅ Setup rápido com um único comando
- ✅ Fácil integração com CI/CD

**Requisitos:**
- Docker 20.10+
- Docker Compose 2.0+

**Produção:**
```bash
# Build das imagens
docker-compose build

# Rodar em modo produção
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## 🚀 Deploy

### Frontend (Vercel - Recomendado)
```bash
cd apps/frontend
npm run build
# Conectar ao Vercel via CLI ou Dashboard
vercel --prod
```

**Variáveis de ambiente (Vercel):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Backend (Railway/Render)

**Build Command:**
```bash
pip install uv && uv sync
```

**Start Command:**
```bash
uv run uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

**Variáveis de ambiente:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL`
- `ALLOWED_ORIGINS`

## 📊 Features em Desenvolvimento

### Calculadoras Trabalhistas 🚧
- **Rescisão Trabalhista**: Cálculo de verbas rescisórias com diferentes tipos de rescisão
- **Aposentadoria**: Cálculo de tempo de contribuição e projeções futuras
- **Relatórios**: Geração de relatórios detalhados em PDF

### Assistente IA 🚧
- **Geração de textos jurídicos** com IA (OpenAI/Anthropic)
- **Análise de documentos** e extração de informações
- **Sugestões personalizadas** baseadas em contexto
- **Interface conversacional** com histórico de chat

## 🏗️ Arquitetura

### Frontend (Next.js)

**Princípios:**
- **Server Components por padrão**: Melhor performance e SEO
- **Feature-first architecture**: Código organizado por domínio
- **TypeScript strict**: Tipagem rigorosa em todo o código
- **Mobile-first**: Design responsivo desde o início
- **Accessibility-first**: WCAG 2.1 compliance

**Estrutura:**
```
apps/frontend/src/
├── app/              # Next.js App Router (file-based routing)
│   ├── blog/         # Rotas do blog
│   ├── admin/        # Dashboard admin
│   └── ...
├── components/       # Componentes reutilizáveis
│   ├── ui/           # shadcn/ui components
│   └── layout/       # Header, Footer
├── features/         # Módulos por domínio
│   ├── auth/         # Autenticação
│   ├── blog/         # Blog
│   └── ...
└── lib/             # Bibliotecas e utils
```

### Backend (FastAPI)

**Princípios:**
- **Feature-based modules**: Cada feature é um módulo independente
- **Async-first**: APIs assíncronas para melhor performance
- **Type-safe**: Pydantic para validação runtime
- **Auto-documented**: Swagger/ReDoc gerado automaticamente

**Estrutura:**
```
apps/backend/src/
├── main.py          # Entry point
├── core/            # Settings, logging, dependencies
├── features/        # Feature modules
│   ├── auth/        # router.py, schemas.py, service.py
│   ├── blog/
│   └── ...
└── shared/          # Código compartilhado (database, utils)
```

## 🎨 Design System

### Componentes UI (shadcn/ui)
- **Acessíveis**: Construídos sobre Radix UI com WAI-ARIA
- **Customizáveis**: Código próprio, não dependência NPM
- **Consistentes**: Design system unificado
- **Dark mode**: Suporte nativo via next-themes

### Estilização (Tailwind CSS 4)
- **Utility-first**: Classes utilitárias para rapidez
- **CSS Variables**: Temas customizáveis
- **Responsive**: Mobile-first breakpoints
- **Performance**: JIT compiler para builds otimizadas

## 🔒 Segurança

### Frontend
- **CSRF Protection**: Nativo no Next.js
- **XSS Prevention**: Sanitização com DOMPurify
- **Secure Cookies**: httpOnly, secure, sameSite
- **Environment Variables**: Variáveis sensíveis protegidas

### Backend
- **Input Validation**: Pydantic schemas em todas as rotas
- **SQL Injection**: Protegido via Supabase (PostgreSQL)
- **JWT Validation**: Tokens validados em rotas protegidas
- **CORS**: Configurado apenas para origens permitidas
- **Rate Limiting**: (planejado)

## ⚡ Performance

### Frontend (Next.js)
- **Server Components**: Renderização no servidor reduz JavaScript no cliente
- **Code Splitting**: Automático por rota
- **Image Optimization**: Next.js Image com formatos modernos (WebP, AVIF)
- **Font Optimization**: Subset automático de fontes
- **Route Prefetching**: Navegação instantânea

### Backend (FastAPI)
- **Async I/O**: Todas as operações de I/O são assíncronas
- **Connection Pooling**: Supabase gerencia pool de conexões
- **Response Compression**: Gzip habilitado
- **Caching**: (planejado com Redis)

## 🧪 Testes

### Backend
```bash
cd apps/backend
uv run pytest                    # Executar testes
uv run pytest --cov=src          # Com coverage
uv run pytest -v                 # Verbose
```

### Frontend
```bash
cd apps/frontend
npm run lint                     # ESLint
npm run type-check               # TypeScript check
# Testes unitários (planejado)
```

## 🤝 Contribuição

### Padrões de Código

**Frontend:**
- TypeScript strict mode
- ESLint com config Next.js
- Conventional Commits
- Components: Server Components por padrão

**Backend:**
- Python 3.13+
- Ruff para linting e formatting
- Type hints obrigatórios
- Docstrings em funções públicas

### Processo
1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adicionar nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📚 Documentação Adicional

- [Frontend README](apps/frontend/README.md) - Documentação detalhada do frontend
- [Backend README](apps/backend/README.md) - Documentação detalhada do backend
- [Docker Guide](DOCKER.md) - Guia completo de Docker e Docker Compose
- [CLAUDE.md](CLAUDE.md) - Guia para Claude Code (AI assistant)

## 📄 Licença

Este projeto está sob a licença MIT.

## 📞 Suporte

Para questões e suporte, utilize o formulário de contato na aplicação ou abra uma issue no GitHub.
