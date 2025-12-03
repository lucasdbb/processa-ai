# Guia de Configuração - Processa AI Backend

Este guia detalha o processo completo de configuração do backend do Processa AI, desde a instalação até o primeiro deploy.

## 📋 Pré-requisitos

- **Python 3.13** instalado
- **uv** instalado (gerenciador de pacotes)
- Conta no **Supabase** (gratuita)
- **Git** instalado

## 🚀 Passo a Passo

### 1. Instalar Python 3.13

**Windows:**
```bash
# Via winget
winget install Python.Python.3.13

# Ou baixe em: https://www.python.org/downloads/
```

**Linux/Mac:**
```bash
# Via pyenv (recomendado)
curl https://pyenv.run | bash
pyenv install 3.13.0
pyenv global 3.13.0
```

### 2. Instalar uv

**Windows:**
```bash
pip install uv
```

**Linux/Mac:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 3. Clonar e Configurar o Projeto

```bash
# Clonar repositório
git clone <repo-url>
cd processa-ai/apps/backend

# Verificar versão do Python
python --version  # Deve ser 3.13.x

# Instalar dependências
uv sync --extra dev
```

### 4. Configurar Supabase

#### 4.1. Criar Projeto no Supabase

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Clique em **New Project**
3. Preencha:
   - **Name**: processa-ai
   - **Database Password**: [crie uma senha forte]
   - **Region**: South America (São Paulo) - recomendado para Brasil
4. Clique em **Create new project** e aguarde ~2 minutos

#### 4.2. Obter as Credenciais

1. No dashboard do projeto, vá em **Settings** → **API**
2. Copie as seguintes informações:
   - **Project URL** (SUPABASE_URL)
   - **anon public** (SUPABASE_ANON_KEY)
   - **service_role** (SUPABASE_SERVICE_ROLE_KEY)

⚠️ **IMPORTANTE**: Nunca commite a service_role key no Git!

#### 4.3. Executar Migrations

**Opção A: Via Dashboard (mais fácil)**

1. No dashboard, vá em **SQL Editor**
2. Clique em **+ New Query**
3. Abra o arquivo `apps/backend/supabase/migrations/20250102000001_initial_schema.sql`
4. Copie todo o conteúdo e cole no SQL Editor
5. Clique em **Run** (ou `Ctrl+Enter`)
6. Verifique se apareceu "Success. No rows returned"

**Opção B: Via CLI**

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Vincular projeto (copie o Project ID do dashboard)
supabase link --project-ref seu-project-id

# Executar migrations
supabase db push
```

#### 4.4. Verificar Tabelas Criadas

1. Vá em **Table Editor** no dashboard
2. Você deve ver as tabelas:
   - profiles
   - blog_categories
   - blog_posts
   - calculator_history
   - ai_chat_sessions
   - ai_chat_messages

### 5. Configurar Variáveis de Ambiente

Crie o arquivo `.env` na raiz de `apps/backend/`:

```bash
# Backend
cd apps/backend
cp .env.example .env
```

Edite o arquivo `.env` e preencha:

```env
# Supabase (copie do dashboard)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Frontend URL e CORS
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Ambiente
ENVIRONMENT=development
```

### 6. Executar o Backend

```bash
# Na pasta apps/backend/
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Se tudo deu certo, você verá:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
🚀 Starting Processa AI Backend API
Environment: development
INFO:     Application startup complete.
```

### 7. Testar a API

Acesse a documentação interativa:

```
http://localhost:8000/docs
```

Você verá a interface do Swagger UI com todos os endpoints disponíveis.

**Testar endpoint de health:**
```bash
curl http://localhost:8000/health
```

Deve retornar:
```json
{"status": "healthy"}
```

### 8. Testar Registro de Usuário

1. Vá em http://localhost:8000/docs
2. Expanda `POST /api/auth/register`
3. Clique em **Try it out**
4. Preencha o JSON:
```json
{
  "email": "teste@example.com",
  "password": "senha123456",
  "full_name": "Usuário Teste"
}
```
5. Clique em **Execute**

Se deu certo, você receberá um `access_token` e `refresh_token`.

### 9. Verificar Perfil Criado

1. Vá no Supabase Dashboard → **Table Editor** → **profiles**
2. Você deve ver o novo perfil criado automaticamente (via trigger)
3. Note que:
   - `id` é o mesmo do `auth.users`
   - `email`, `full_name`, `role` foram copiados
   - `created_at` foi preenchido automaticamente

## ✅ Verificação Final

Execute este checklist para garantir que tudo está funcionando:

- [ ] Python 3.13 instalado (`python --version`)
- [ ] uv instalado (`uv --version`)
- [ ] Projeto Supabase criado
- [ ] Migrations executadas com sucesso
- [ ] Arquivo `.env` configurado
- [ ] Backend rodando em http://localhost:8000
- [ ] Documentação acessível em http://localhost:8000/docs
- [ ] Endpoint de health retorna `{"status": "healthy"}`
- [ ] Registro de usuário funcionando
- [ ] Perfil criado automaticamente na tabela `profiles`

## 🐛 Troubleshooting

### Erro: "Python version mismatch"

**Problema**: uv não encontra Python 3.13

**Solução**:
```bash
# Verificar versão
python --version

# Se não for 3.13, instale e configure
pyenv install 3.13.0
pyenv local 3.13.0
```

### Erro: "Supabase connection failed"

**Problema**: Não consegue conectar ao Supabase

**Solução**:
1. Verifique se as credenciais no `.env` estão corretas
2. Teste a URL do Supabase no navegador
3. Verifique se o projeto está ativo no dashboard

### Erro: "Table 'profiles' does not exist"

**Problema**: Migrations não foram executadas

**Solução**:
1. Vá no SQL Editor do Supabase
2. Execute a migration `20250102000001_initial_schema.sql` novamente
3. Verifique se as tabelas apareceram no Table Editor

### Erro: "Import error" ou "Module not found"

**Problema**: Dependências não instaladas

**Solução**:
```bash
# Reinstalar dependências
uv sync --extra dev

# Se persistir, limpe o cache
rm -rf .venv
uv sync --extra dev
```

### Erro: "Port 8000 already in use"

**Problema**: Porta já está sendo usada

**Solução**:
```bash
# Use outra porta
uv run uvicorn src.main:app --reload --port 8001

# Ou mate o processo na porta 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Ou mate o processo na porta 8000 (Linux/Mac)
lsof -ti:8000 | xargs kill -9
```

## 📚 Próximos Passos

Após configurar o backend:

1. **Configure o Frontend**
   - Vá em `apps/frontend/`
   - Siga o README para configuração
   - Atualize a `VITE_API_URL` para apontar para o backend

2. **Teste a Integração**
   - Frontend → Backend → Supabase
   - Login/Register funcionando
   - Perfil sendo carregado

3. **Desenvolva Features**
   - Implemente módulo de Blog
   - Implemente Calculadoras
   - Implemente AI Chat

4. **Prepare para Deploy**
   - Configure Railway ou Render
   - Configure variáveis de ambiente
   - Teste em produção

## 🆘 Precisa de Ajuda?

- **Documentação Supabase**: https://supabase.com/docs
- **Documentação FastAPI**: https://fastapi.tiangolo.com
- **Documentação uv**: https://github.com/astral-sh/uv

---

**Sucesso! 🎉** Seu backend está rodando e pronto para desenvolvimento.
