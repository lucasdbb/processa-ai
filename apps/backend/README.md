# Processa AI - Backend API

Backend API desenvolvido em Python + FastAPI para a plataforma Processa AI.

## 🚀 Tecnologias

- **Python 3.13**
- **FastAPI** - Framework web moderno e rápido
- **Uvicorn** - ASGI server
- **Pydantic** - Validação de dados
- **Supabase** - Database PostgreSQL e autenticação
- **uv** - Gerenciador de pacotes ultra-rápido
- **Ruff** - Linter e formatter extremamente rápido

## 📦 Instalação

### Usando uv (recomendado)

```bash
# Instalar uv (se ainda não tiver)
# Windows
pip install uv
# Linux/Mac
curl -LsSf https://astral.sh/uv/install.sh | sh

# Sincronizar dependências (cria venv automaticamente)
uv sync

# Instalar dependências de desenvolvimento
uv sync --extra dev
```

### Alternativa com pip

```bash
# Criar ambiente virtual
python -m venv .venv

# Ativar ambiente virtual
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

# Instalar dependências
pip install -e .
```

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env
```

Configure as variáveis no arquivo `.env`:

```env
# Supabase (obtenha no dashboard do seu projeto)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Frontend
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 2. Configurar Banco de Dados Supabase

**Opção A: Via Supabase Dashboard (Recomendado)**

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **+ New Query**
5. Copie e cole o conteúdo do arquivo `supabase/migrations/20250102000001_initial_schema.sql`
6. Clique em **Run** (ou pressione `Ctrl+Enter`)

**Opção B: Via Supabase CLI**

```bash
# Instalar Supabase CLI
npm install -g supabase

# Fazer login
supabase login

# Vincular ao projeto
supabase link --project-ref seu-project-ref

# Executar migrations
supabase db push
```

Veja mais detalhes em [supabase/migrations/README.md](supabase/migrations/README.md)

## 🏃 Executar

### Modo desenvolvimento

```bash
# Com uv (recomendado)
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Ou com uvicorn diretamente
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Ou diretamente com Python
uv run python -m src.main
```

### Modo produção

```bash
uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

A API estará disponível em: `http://localhost:8000`

Documentação interativa: `http://localhost:8000/docs`

## 📁 Estrutura do Projeto

```
apps/backend/
├── src/
│   ├── main.py              # Ponto de entrada da aplicação
│   ├── core/                # Configurações core
│   │   ├── config.py        # Settings da aplicação
│   │   ├── logging.py       # Configuração de logs
│   │   └── dependencies.py  # FastAPI dependencies (auth, etc.)
│   ├── api/                 # API router principal
│   │   └── router.py        # Agregador de rotas
│   ├── features/            # Módulos de features
│   │   ├── auth/            # Autenticação ✅
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── users/           # Gerenciamento de usuários ✅
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── blog/            # Blog (TODO)
│   │   ├── calculators/     # Calculadoras (TODO)
│   │   └── ai_chat/         # Chat IA (TODO)
│   └── shared/              # Código compartilhado
│       └── database.py      # Cliente Supabase
├── supabase/
│   └── migrations/          # SQL migrations
│       ├── README.md        # Documentação das migrations
│       └── 20250102000001_initial_schema.sql
├── tests/                   # Testes
├── .env.example            # Exemplo de variáveis de ambiente
├── .python-version         # Versão do Python (3.13)
├── pyproject.toml         # Dependências e configuração
└── README.md              # Este arquivo
```

## 🔌 Endpoints da API

### Autenticação (`/api/auth`)

- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Recuperar senha
- `POST /api/auth/reset-password` - Redefinir senha
- `POST /api/auth/logout` - Logout

### Usuários (`/api/users`)

- `GET /api/users/profile` - Ver perfil do usuário
- `PUT /api/users/profile` - Atualizar perfil
- `GET /api/users` - Listar usuários (admin)

### Health Check

- `GET /health` - Health check da API
- `GET /api/health` - Health check do API router

## 🧪 Testes

```bash
# Executar testes
uv run pytest

# Com coverage
uv run pytest --cov=src --cov-report=html

# Apenas testes específicos
uv run pytest tests/test_auth.py
```

## 🔧 Desenvolvimento

### Formatação de código com Ruff

```bash
# Formatar código
uv run ruff format src/

# Verificar linting
uv run ruff check src/

# Auto-fix problemas simples
uv run ruff check src/ --fix
```

### Adicionar novas dependências

```bash
# Adicionar dependência de produção
uv add fastapi

# Adicionar dependência de desenvolvimento
uv add --dev pytest

# Remover dependência
uv remove package-name
```

## 🚀 Deploy

### Railway / Render

**Build Command:**
```bash
pip install uv && uv sync
```

**Start Command:**
```bash
uv run uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

**Variáveis de Ambiente:**
- Configure todas as variáveis do `.env.example` no painel

### Docker (opcional)

```dockerfile
FROM python:3.13-slim

# Instalar uv
RUN pip install uv

WORKDIR /app

# Copiar arquivos de dependências
COPY pyproject.toml .
COPY .python-version .

# Instalar dependências
RUN uv sync --no-dev

# Copiar código fonte
COPY src/ ./src/

# Comando de start
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🗄️ Database Schema

O banco de dados utiliza Supabase (PostgreSQL) com as seguintes tabelas:

### Core Tables
- **profiles** - Perfis de usuários (criados automaticamente via trigger)
- **blog_categories** - Categorias do blog
- **blog_posts** - Posts do blog
- **calculator_history** - Histórico de cálculos
- **ai_chat_sessions** - Sessões de chat com IA
- **ai_chat_messages** - Mensagens do chat

### Features de Segurança
- ✅ **Row Level Security (RLS)** habilitado em todas as tabelas
- ✅ **Triggers automáticos** para criar perfil ao registrar usuário
- ✅ **Indexes** para otimização de performance
- ✅ **Foreign Keys** para integridade referencial

Veja detalhes completos em [supabase/migrations/README.md](supabase/migrations/README.md)

## 🔐 Autenticação

O backend utiliza **Supabase Auth** com JWT tokens:

### Flow de Autenticação
1. Frontend envia credenciais para `/api/auth/login`
2. Backend valida com Supabase Auth
3. Supabase retorna `access_token` e `refresh_token`
4. Frontend envia `access_token` no header `Authorization: Bearer <token>`
5. Backend valida token em rotas protegidas via `get_current_user` dependency

### Usar Autenticação nas Rotas

```python
from fastapi import APIRouter, Depends
from src.core.dependencies import get_current_user, get_current_admin

router = APIRouter()

# Rota protegida - qualquer usuário autenticado
@router.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    return {"user_id": user.id}

# Rota protegida - apenas admins
@router.post("/admin-only")
async def admin_route(user=Depends(get_current_admin)):
    return {"message": "Admin access"}
```

## 📝 Próximos Passos

### Features
- [ ] Implementar módulo de Blog (routers, services, schemas)
- [ ] Implementar módulo de Calculadoras (pension, employment_termination)
- [ ] Implementar módulo de AI Chat (integração com OpenAI/Anthropic)

### Melhorias
- [ ] Adicionar rate limiting (slowapi ou fastapi-limiter)
- [ ] Implementar cache com Redis
- [ ] Adicionar observability (logs estruturados, metrics, traces)
- [ ] Adicionar testes unitários e de integração
- [ ] Configurar CI/CD (GitHub Actions)
