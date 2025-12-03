# Supabase Migrations

Este diretório contém as migrations SQL para o banco de dados Supabase do Processa AI.

## 📋 Migrations Disponíveis

### `20250102000001_initial_schema.sql`
Migration inicial que cria toda a estrutura do banco de dados do zero:

**Tabelas criadas:**
- ✅ `public.profiles` - Perfis de usuários
- ✅ `public.blog_categories` - Categorias do blog
- ✅ `public.blog_posts` - Posts do blog
- ✅ `public.calculator_history` - Histórico de cálculos
- ✅ `public.ai_chat_sessions` - Sessões de chat com IA
- ✅ `public.ai_chat_messages` - Mensagens do chat com IA

**Features implementadas:**
- ✅ **Row Level Security (RLS)** em todas as tabelas
- ✅ **Triggers** para auto-criar perfil ao registrar usuário
- ✅ **Triggers** para auto-atualizar `updated_at`
- ✅ **Indexes** para otimização de performance
- ✅ **Foreign Keys** para integridade referencial
- ✅ **Check Constraints** para validação de dados
- ✅ **Seed data** com categorias padrão do blog

## 🚀 Como Executar as Migrations

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **+ New Query**
5. Copie e cole o conteúdo do arquivo `20250102000001_initial_schema.sql`
6. Clique em **Run** (ou pressione `Ctrl+Enter`)

### Opção 2: Via Supabase CLI

```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Fazer login
supabase login

# Vincular ao projeto (primeira vez)
supabase link --project-ref seu-project-ref

# Executar migrations
supabase db push

# Ou executar migration específica
psql -h db.seu-projeto.supabase.co -p 5432 -d postgres -U postgres -f supabase/migrations/20250102000001_initial_schema.sql
```

### Opção 3: Via psql direto

```bash
# Conectar ao banco
psql "postgresql://postgres:[YOUR-PASSWORD]@db.seu-projeto.supabase.co:5432/postgres"

# Executar migration
\i apps/backend/supabase/migrations/20250102000001_initial_schema.sql
```

## 🔒 Row Level Security (RLS)

Todas as tabelas possuem RLS habilitado para segurança:

### Profiles
- ✅ Usuários podem ver e editar apenas seu próprio perfil
- ✅ Admins podem ver todos os perfis

### Blog
- ✅ Todos podem ler posts publicados
- ✅ Apenas admins podem criar/editar/deletar posts e categorias

### Calculator History
- ✅ Usuários podem ver/criar/deletar apenas seu próprio histórico

### AI Chat
- ✅ Usuários podem ver/criar/editar/deletar apenas suas próprias sessões e mensagens

## 📊 Estrutura das Tabelas

### `public.profiles`
```sql
id            UUID PRIMARY KEY (FK auth.users)
email         TEXT NOT NULL UNIQUE
full_name     TEXT
avatar_url    TEXT
role          TEXT DEFAULT 'user' ('user' | 'admin')
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

### `public.blog_categories`
```sql
id            UUID PRIMARY KEY
name          TEXT NOT NULL UNIQUE
slug          TEXT NOT NULL UNIQUE
description   TEXT
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

### `public.blog_posts`
```sql
id               UUID PRIMARY KEY
title            TEXT NOT NULL
slug             TEXT NOT NULL UNIQUE
excerpt          TEXT
content          TEXT NOT NULL
cover_image_url  TEXT
category_id      UUID (FK blog_categories)
author_id        UUID NOT NULL (FK auth.users)
status           TEXT DEFAULT 'draft' ('draft' | 'published' | 'archived')
published_at     TIMESTAMPTZ
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

### `public.calculator_history`
```sql
id               UUID PRIMARY KEY
user_id          UUID NOT NULL (FK auth.users)
calculator_type  TEXT NOT NULL ('pension' | 'employment_termination')
inputs           JSONB NOT NULL
results          JSONB NOT NULL
created_at       TIMESTAMPTZ
```

### `public.ai_chat_sessions`
```sql
id          UUID PRIMARY KEY
user_id     UUID NOT NULL (FK auth.users)
title       TEXT DEFAULT 'Nova Conversa'
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### `public.ai_chat_messages`
```sql
id          UUID PRIMARY KEY
session_id  UUID NOT NULL (FK ai_chat_sessions)
role        TEXT NOT NULL ('user' | 'assistant' | 'system')
content     TEXT NOT NULL
created_at  TIMESTAMPTZ
```

## 🔄 Triggers Automáticos

### `handle_new_user()`
Trigger que cria automaticamente um perfil em `public.profiles` quando um novo usuário é criado em `auth.users`.

**Dados copiados:**
- `id` → do auth.users
- `email` → do auth.users
- `full_name` → do user_metadata
- `role` → do user_metadata (padrão: 'user')

### `handle_updated_at()`
Trigger que atualiza automaticamente o campo `updated_at` para NOW() sempre que um registro é atualizado.

**Tabelas afetadas:**
- profiles
- blog_categories
- blog_posts
- ai_chat_sessions

## ⚠️ Importante

1. **Backup**: Sempre faça backup antes de executar migrations em produção
2. **Ordem**: Execute as migrations na ordem cronológica (pelo timestamp no nome)
3. **Testes**: Teste em ambiente de desenvolvimento primeiro
4. **Service Role Key**: O backend usa Service Role Key, então RLS não se aplica ao backend (apenas via API direta)

## 📝 Próximas Migrations

Para criar novas migrations:

```bash
# Criar arquivo com timestamp
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql
```

**Convenção de nomenclatura:**
- Formato: `YYYYMMDDHHMMSS_description.sql`
- Exemplo: `20250102120000_add_user_preferences.sql`
