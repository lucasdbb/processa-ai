# Gerenciamento de Roles (Permissões)

## Visão Geral

O sistema utiliza uma **abordagem híbrida** para gerenciar roles de usuários:

1. **`auth.users.user_metadata.role`** - Fonte principal (incluída no JWT)
2. **`user_profiles.role`** - Backup e auditoria (sincronizada automaticamente)

## Roles Disponíveis

```typescript
type UserRole = 'user' | 'admin' | 'premium';
```

### 📋 Descrição das Roles

| Role | Descrição | Permissões |
|------|-----------|------------|
| **user** | Usuário padrão | Acesso básico à plataforma |
| **admin** | Administrador | Acesso total, pode gerenciar usuários e roles |
| **premium** | Usuário premium | Acesso a funcionalidades pagas |

## Como Funciona

### 1. Novo Registro
- Todo novo usuário começa com `role: 'user'`
- Role é salva em:
  - `auth.users.user_metadata.role`
  - `user_profiles.role`

### 2. Sincronização Automática
- Quando `user_metadata` é atualizado, um **trigger** sincroniza automaticamente com `user_profiles`
- Garante consistência entre as duas fontes

### 3. Prioridade
```
user_metadata.role (JWT) → user_profiles.role (DB) → 'user' (default)
```

## Como Alterar a Role de um Usuário

### Método 1: Via API Endpoint (Recomendado)

**Endpoint:** `PATCH /api/auth/update-role`

**Requisitos:**
- Usuário autenticado deve ser **admin**
- Não pode alterar a própria role

**Request:**
```json
{
  "userId": "uuid-do-usuario",
  "role": "admin" // ou "user", "premium"
}
```

**Response:**
```json
{
  "message": "Role atualizada para 'admin' com sucesso",
  "user": {
    "id": "uuid-do-usuario",
    "email": "usuario@exemplo.com",
    "role": "admin"
  }
}
```

**Exemplo com cURL:**
```bash
curl -X PATCH https://processa-ai-auth.vercel.app/api/auth/update-role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -d '{
    "userId": "uuid-do-usuario",
    "role": "admin"
  }'
```

### Método 2: Diretamente no Supabase (Uso Temporário)

Para criar o primeiro admin ou em emergências:

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute:

```sql
-- Atualizar no auth.users (JWT)
UPDATE auth.users
SET raw_user_meta_data =
  jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
WHERE email = 'seu-email@exemplo.com';

-- Atualizar no user_profiles (backup)
UPDATE user_profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com'
);
```

## Verificação de Permissões

### No Backend (Middleware)

```typescript
import { AuthenticatedRequest } from '../../lib/auth.js';

// Verificar se é admin
if (req.user.role !== 'admin') {
  return res.status(403).json({
    error: 'Acesso negado',
    code: 'FORBIDDEN'
  });
}

// Verificar se é premium ou admin
if (!['premium', 'admin'].includes(req.user.role)) {
  return res.status(403).json({
    error: 'Esta funcionalidade requer assinatura premium',
    code: 'PREMIUM_REQUIRED'
  });
}
```

### No Frontend (React)

```typescript
import { User } from './types/auth';

// Verificar role
const isAdmin = (user: User) => user.role === 'admin';
const isPremium = (user: User) => ['premium', 'admin'].includes(user.role);

// Renderização condicional
{isAdmin(user) && (
  <button onClick={handleAdminAction}>
    Painel Admin
  </button>
)}

{isPremium(user) ? (
  <PremiumFeature />
) : (
  <UpgradeToPremiumBanner />
)}
```

### Com React Router (Rotas Protegidas)

```typescript
const AdminRoute = ({ children }: { children: React.ReactElement }) => {
  const user = useUser(); // seu hook de autenticação

  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Uso
<Route
  path="/admin"
  element={
    <AdminRoute>
      <AdminPanel />
    </AdminRoute>
  }
/>
```

## Migrações

### 1. Criar tabela user_profiles com role
```bash
# Aplicar migration
supabase migration up
```

Arquivo: `supabase/migrations/001_create_user_profiles.sql`

### 2. Adicionar campo role e triggers de sincronização
```bash
# Aplicar migration
supabase migration up
```

Arquivo: `supabase/migrations/002_add_role_to_user_profiles.sql`

**Features da Migration 002:**
- ✅ Adiciona campo `role` com ENUM
- ✅ Cria trigger de sincronização automática
- ✅ Faz backfill de roles existentes
- ✅ Cria índice para performance

## Boas Práticas

### ✅ DO (Faça)
1. **Use o endpoint `/update-role`** para alterar roles em produção
2. **Sempre verifique permissões no backend** (nunca confie só no frontend)
3. **Registre mudanças de role** em logs/auditoria
4. **Teste permissões** antes de deploy

### ❌ DON'T (Não Faça)
1. **Não permita que usuários mudem a própria role**
2. **Não use apenas verificação frontend** (pode ser burlada)
3. **Não remova o último admin** do sistema
4. **Não hardcode roles** em múltiplos lugares (use constantes/ENUMs)

## Troubleshooting

### Role não está sendo aplicada

1. **Verificar no banco:**
```sql
SELECT id, email, raw_user_meta_data->>'role' as metadata_role
FROM auth.users
WHERE email = 'seu-email@exemplo.com';

SELECT user_id, role
FROM user_profiles
WHERE user_id = 'uuid-do-usuario';
```

2. **Verificar no JWT:**
```typescript
// Decodificar token no frontend
const decodedToken = JSON.parse(atob(accessToken.split('.')[1]));
console.log('Role no JWT:', decodedToken.user_metadata?.role);
```

3. **Forçar novo login:**
- Roles são carregadas no JWT durante o login
- Após alterar role, usuário precisa fazer logout/login

### Trigger não está funcionando

```sql
-- Verificar se trigger existe
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_updated';

-- Recriar trigger se necessário
-- (executar novamente a migration 002)
```

## Segurança

### RLS (Row Level Security)

As policies RLS em `user_profiles` devem permitir:

```sql
-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins podem ver todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    auth.jwt()->>'role' = 'admin'
  );

-- Apenas admins podem atualizar roles
CREATE POLICY "Admins can update roles"
  ON user_profiles FOR UPDATE
  USING (
    auth.jwt()->>'role' = 'admin'
  );
```

## Roadmap Futuro

- [ ] Audit log de mudanças de role
- [ ] Roles customizadas (RBAC avançado)
- [ ] Permissões granulares por feature
- [ ] Interface admin para gerenciar roles
- [ ] Expiração automática de roles temporárias (ex: trial premium)
