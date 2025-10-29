# Supabase Migrations - Processa AI

Este diretório contém as migrations do banco de dados para o projeto Processa AI.

## 📋 Como Aplicar as Migrations

### Opção 1: Via Dashboard do Supabase (Recomendado)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto: `processa-ai`
3. No menu lateral, clique em **SQL Editor**
4. Clique em **+ New Query**
5. Copie o conteúdo do arquivo de migration (`001_create_user_profiles.sql`)
6. Cole no editor SQL
7. Clique em **Run** (ou pressione `Ctrl+Enter`)
8. Aguarde a confirmação de sucesso

### Opção 2: Via Supabase CLI

```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Fazer login no Supabase
supabase login

# Linkar o projeto local com o projeto remoto
supabase link --project-ref SUPABASE_PROJECT_REF

# Aplicar a migration
supabase db push
```

## 📁 Migrations Disponíveis

### `001_create_user_profiles.sql`
**Data:** 2025-01-29
**Descrição:** Cria a tabela `user_profiles` para armazenar informações estendidas do perfil de usuário, incluindo CPF/CNPJ.

**O que esta migration faz:**
- ✅ Cria ENUM `document_type` (cpf, cnpj)
- ✅ Cria tabela `user_profiles` com:
  - `document_type`: Tipo de documento (CPF ou CNPJ)
  - `document_number`: Número do documento (UNIQUE)
  - `full_name`: Nome completo ou razão social
  - `phone`: Telefone
  - `avatar_url`: URL do avatar
- ✅ Adiciona validações de CPF (11 dígitos) e CNPJ (14 dígitos)
- ✅ Cria índices para performance
- ✅ Configura Row Level Security (RLS)
- ✅ Cria trigger automático para criar perfil ao cadastrar usuário
- ✅ Adiciona função `updated_at` automática

**Políticas de RLS criadas:**
- Usuários podem visualizar apenas seu próprio perfil
- Usuários podem inserir apenas seu próprio perfil
- Usuários podem atualizar apenas seu próprio perfil
- Usuários podem deletar apenas seu próprio perfil

## ⚠️ Importante

- **Backup:** Sempre faça backup do banco de dados antes de aplicar migrations em produção
- **Ordem:** Execute as migrations na ordem numérica (`001`, `002`, etc.)
- **Reversão:** Caso necessário, você pode reverter manualmente executando o SQL inverso

## 🔍 Verificação Pós-Migration

Para verificar se a migration foi aplicada corretamente, execute:

```sql
-- Verificar se a tabela foi criada
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'user_profiles';

-- Verificar estrutura da tabela
\d user_profiles

-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

-- Verificar triggers
SELECT * FROM information_schema.triggers WHERE event_object_table = 'user_profiles';
```

## 🐛 Troubleshooting

### Erro: "type document_type already exists"
Se você já executou a migration parcialmente, pode ser que o ENUM já exista. Execute:
```sql
DROP TYPE IF EXISTS document_type CASCADE;
```
E então execute a migration completa novamente.

### Erro: "relation user_profiles already exists"
A tabela já foi criada. Para recriar:
```sql
DROP TABLE IF EXISTS public.user_profiles CASCADE;
```
E então execute a migration novamente.

### Erro de permissão
Certifique-se de estar usando um usuário com privilégios adequados (geralmente o usuário `postgres` ou service_role).

## 📚 Próximos Passos

Após aplicar a migration:

1. ✅ Atualizar a API para suportar os novos campos
2. ✅ Testar o ProfileModal com os campos de CPF/CNPJ
3. ✅ Verificar se o trigger de criação automática está funcionando
4. ✅ Testar as validações de CPF e CNPJ

## 🔗 Links Úteis

- [Documentação do Supabase sobre Migrations](https://supabase.com/docs/guides/cli/managing-migrations)
- [Documentação de Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [SQL Editor do Supabase](https://app.supabase.com/project/_/sql)
