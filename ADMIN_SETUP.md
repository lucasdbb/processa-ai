# 🛡️ Configuração do Painel Admin

## Quick Start

### 1. Aplicar Migrations no Supabase

Acesse **Supabase Dashboard → SQL Editor** e execute:

```sql
-- Migration 002: Adicionar role na tabela user_profiles
-- (Cole o conteúdo de supabase/migrations/002_add_role_to_user_profiles.sql)
```

### 2. Criar Primeiro Admin

```sql
-- Substituir 'seu-email@exemplo.com' pelo seu email
UPDATE auth.users
SET raw_user_meta_data =
  jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
WHERE email = 'seu-email@exemplo.com';

UPDATE user_profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com'
);
```

### 3. Acessar Painel

1. Faça login com a conta admin
2. Clique no menu do usuário (canto superior direito)
3. Selecione **"Painel Admin"**
4. Ou acesse: `http://localhost:5173/admin`

## ✅ O que foi criado

### Backend (API)
- ✅ `apps/api/api/auth/list-users.ts` - Lista usuários (admin only)
- ✅ `apps/api/api/auth/update-role.ts` - Atualiza role (admin only)
- ✅ `apps/api/lib/user-helper.ts` - Atualizado para incluir role

### Frontend (Web)
- ✅ `apps/web/src/pages/AdminPanel.tsx` - Painel admin completo
- ✅ `apps/web/src/services/admin.service.ts` - Service para API
- ✅ `apps/web/src/App.tsx` - Rota `/admin` protegida
- ✅ `apps/web/src/components/UserMenu.tsx` - Link para painel (só admins)

### Database
- ✅ `supabase/migrations/002_add_role_to_user_profiles.sql` - Adiciona campo role
- ✅ Trigger de sincronização automática auth.users ↔ user_profiles

### Documentação
- ✅ `docs/ROLE_MANAGEMENT.md` - Guia completo de roles
- ✅ `docs/ADMIN_PANEL.md` - Documentação do painel

## 🔐 Segurança

### Proteção em 3 Camadas

1. **Frontend**: Rota protegida com `<AdminRoute>`
2. **Backend**: Middleware valida role='admin'
3. **Database**: RLS policies protegem dados

### Validações

- ✅ Apenas admins podem acessar `/admin`
- ✅ Admin não pode alterar própria role
- ✅ Confirmação antes de mudar role
- ✅ Token JWT validado em todas as requisições

## 📊 Funcionalidades

### Dashboard
- Total de usuários
- Contagem por role (user, premium, admin)
- Novos cadastros (últimos 7 dias)

### Gerenciamento
- Lista completa de usuários
- Busca por nome ou email
- Filtro por role
- Alterar role de qualquer usuário
- Visualizar documento, status, data de cadastro

## 🧪 Testar

```bash
# 1. Criar conta admin (SQL acima)

# 2. Fazer deploy da API (se necessário)
cd apps/api
vercel --prod

# 3. Rodar frontend
cd apps/web
npm run dev

# 4. Acessar http://localhost:5173/admin
```

## 📝 Próximos Passos

1. ✅ Aplicar migration 002 no Supabase
2. ✅ Criar sua conta admin
3. ✅ Testar acesso ao painel
4. ✅ Testar alteração de role
5. 📖 Ler documentação completa em `docs/`

## 🆘 Ajuda

- **403 Forbidden**: Usuário não é admin → Execute SQL para tornar admin
- **Modal não abre**: Verificar console do navegador (F12)
- **Estatísticas não carregam**: Verificar se migration foi aplicada
- **Usuário não reflete mudança**: Precisa fazer logout/login

Para mais detalhes, veja:
- `docs/ADMIN_PANEL.md` - Documentação completa
- `docs/ROLE_MANAGEMENT.md` - Guia de roles
