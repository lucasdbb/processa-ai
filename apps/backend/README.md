# Processa AI - Backend API

Esta é a API unificada da plataforma **Processa AI**, desenvolvida com **Python 3.13** e **FastAPI**. Ela serve como o coração do sistema, lidando com regras de negócio, banco de dados (via Supabase), autenticação, filas de processamento assíncrono (Redis) e integrações com IA.

## 🚀 Tecnologias e Arquitetura

*   **Framework:** FastAPI (ASGI)
*   **Linguagem:** Python 3.13
*   **Gerenciador de Pacotes:** `uv`
*   **Banco de Dados:** PostgreSQL (via Supabase) com `psycopg` 3 (assíncrono)
*   **Fila/Cache:** Redis (via `redis-py`)
*   **Validação:** Pydantic 2.x
*   **Migrações:** Alembic
*   **Linter/Formatter:** Ruff

A arquitetura do projeto segue o padrão **Feature-based**, onde o código é organizado por domínios de negócio (`features/`), garantindo alta coesão e baixo acoplamento.

## 📂 Estrutura de Diretórios

```
apps/backend/
├── migrations/          # Scripts de migração do banco de dados (Alembic)
├── src/
│   ├── api/             # Roteador principal (`api_router`) que unifica os endpoints
│   ├── core/            # Configurações globais, DB pool, logging, Supabase, Redis, Auth
│   ├── features/        # Módulos organizados por domínio
│   │   ├── ai/          # Integrações com LLMs, RAG, e filas de processamento
│   │   ├── billing/     # Sistema de créditos, assinaturas (Stripe) e webhooks
│   │   ├── calculators/ # Motores de cálculo trabalhista e previdenciário
│   │   ├── core/        # Perfis de usuário, blog, dashboard, suporte
│   │   ├── office/      # Gestão de processos, clientes, prazos, honorários
│   │   └── portal/      # API read-only para o Portal do Cliente
│   ├── templates/       # Templates de e-mail (HTML)
│   └── main.py          # Entry point da aplicação FastAPI
├── tests/               # Testes automatizados (pytest)
├── alembic.ini          # Configuração do Alembic
├── pyproject.toml       # Dependências e configurações do projeto (Ruff, pytest)
└── uv.lock              # Lockfile do uv
```

## ⚙️ Configuração Local

### 1. Pré-requisitos
*   Python 3.13+
*   [uv](https://docs.astral.sh/uv/) (Package manager)
*   PostgreSQL / Supabase
*   Redis (opcional, mas necessário para jobs de IA)

### 2. Instalação

```bash
cd apps/backend
uv sync
```

### 3. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do `backend/` baseado no `.env.example`:

```env
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000

# Supabase (Banco de Dados e Auth)
DATABASE_URL=postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Redis (Fila de jobs para o Worker)
REDIS_URL=redis://localhost:6379/0

# Outros serviços
STRIPE_SECRET_KEY=sk_test_...
BREVO_API_KEY=xkeysib-...
```

### 4. Executando a API

Para rodar o servidor de desenvolvimento com hot-reload:

```bash
uv run uvicorn src.main:app --reload
```

A API estará disponível em `http://localhost:8000`.
A documentação interativa (Swagger UI) pode ser acessada em `http://localhost:8000/docs`.

## 🛠️ Comandos Úteis

| Comando | Descrição |
|---|---|
| `uv run uvicorn src.main:app --reload` | Inicia o servidor de desenvolvimento |
| `uv run pytest` | Roda a suíte de testes |
| `uv run ruff check src/` | Verifica erros de linting |
| `uv run ruff format src/` | Formata o código automaticamente |
| `uv run alembic upgrade head` | Aplica as migrações mais recentes no banco |
| `uv run alembic revision -m "mensagem"` | Cria uma nova migração vazia |

## 🔒 Autenticação e Segurança

O backend utiliza o Supabase para gerenciar a identidade dos usuários. A autenticação é validada no backend via **Supabase JWT Auth Middleware**, que intercepta as requisições, verifica o token Bearer JWT enviado pelo frontend e anexa as informações do usuário logado no estado da requisição (ex: `request.state.user`).

As rotas são protegidas utilizando a dependência `get_current_user` do FastAPI.

## 📱 Verificação de Telefone por SMS (Créditos de Boas-Vindas)

O módulo de créditos inclui validação de telefone via SMS para reduzir abuso no resgate de créditos grátis.

**Endpoints (prefixo `/api/credits`):**
- `POST /send-phone-code`: envia código SMS de 6 dígitos para o telefone informado
- `POST /verify-phone-code`: valida o código recebido e marca o telefone como verificado
- `POST /claim-welcome`: concede créditos de boas-vindas somente com CPF válido e telefone já verificado

**Regras principais:**
- O telefone deve estar em formato BR válido (DDD + número)
- Há limite de tentativas para validação do código
- Telefones verificados não podem ser reutilizados por outra conta
- Ao validar com sucesso, o perfil registra o status de telefone verificado
