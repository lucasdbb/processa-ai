# Painel de Administração

## 🛡️ Visão Geral

O Painel de Administração é uma interface segura para gerenciar usuários, roles e visualizar estatísticas do sistema. Somente usuários com role `admin` podem acessar esta área.

## 🔐 Segurança

### Proteção em Múltiplas Camadas

1. **Frontend (React Router)**
   - Componente `<AdminRoute>` verifica se usuário é admin
   - Redireciona para `/dashboard` se não for admin
   - Redireciona para `/` se não estiver autenticado

2. **Backend (API Endpoints)**
   - Middleware `withAuth` valida JWT token
   - Verifica `req.user.role === 'admin'`
   - Retorna `403 Forbidden` se não for admin

3. **Database (RLS Policies)**
   - Row Level Security protege acesso direto ao banco
   - Apenas admins podem modificar roles

## 🚀 Como Acessar

### Para Usuários Admin

1. Faça login com uma conta admin
2. Clique no menu do usuário (canto superior direito)
3. Selecione **"Painel Admin"**
4. Ou acesse diretamente: `https://seu-dominio.com/admin`

### Criar o Primeiro Admin

Se você ainda não tem uma conta admin, crie uma via SQL:

```sql
-- No Supabase Dashboard → SQL Editor
UPDATE auth.users
SET raw_user_meta_data =
  jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
WHERE email = 'seu-email@exemplo.com';

-- Sincronizar com user_profiles
UPDATE user_profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com'
);
```

## 📊 Funcionalidades

### 1. Dashboard de Estatísticas

Cards com métricas em tempo real:

- **Total de Usuários**: Número total de contas
- **Usuários Comuns**: Contas com role `user`
- **Usuários Premium**: Contas com role `premium`
- **Administradores**: Contas com role `admin`
- **Novos Usuários**: Cadastros nos últimos 7 dias

### 2. Lista de Usuários

Tabela completa com:

- ✅ Avatar e nome do usuário
- ✅ Email de contato
- ✅ Role atual (com badge colorido)
- ✅ Documento (CPF/CNPJ)
- ✅ Status de verificação de email
- ✅ Data de cadastro
- ✅ Ação para alterar role

### 3. Busca e Filtros

**Busca por texto:**
- Busca por email ou nome do usuário
- Filtro em tempo real

**Filtro por role:**
- Todas as roles
- Apenas usuários (`user`)
- Apenas premium (`premium`)
- Apenas admins (`admin`)

### 4. Gerenciamento de Roles

**Alterar Role de Usuário:**

1. Clique em **"Alterar Role"** na linha do usuário
2. Modal abre com opções:
   - 🔷 User (padrão)
   - 👑 Premium (acesso a recursos pagos)
   - 🛡️ Admin (acesso total)
3. Confirme a alteração
4. Usuário precisa fazer logout/login para nova role ter efeito

**Proteções:**
- ❌ Admin não pode alterar a própria role
- ❌ Confirmação antes de alterar
- ✅ Atualização em tempo real na tabela
- ✅ Sincronização automática com banco

## 🎨 Interface

### Código de Cores

**Badges de Role:**
- 🔵 **User**: Cinza (`bg-gray-100 text-gray-800`)
- 🟡 **Premium**: Amarelo (`bg-yellow-100 text-yellow-800`)
- 🔴 **Admin**: Vermelho (`bg-red-100 text-red-800`)

**Status de Email:**
- ✅ **Verificado**: Verde com ícone CheckCircle
- ⭕ **Não Verificado**: Cinza com ícone XCircle

### Responsividade

- ✅ Desktop: Tabela completa com todas as colunas
- ✅ Tablet: Layout ajustado, colunas essenciais
- ✅ Mobile: Cards empilhados (pode ser implementado)

## 📡 Endpoints da API

### 1. Listar Usuários

```http
GET /api/auth/list-users
Authorization: Bearer {admin_token}
```

**Query Parameters:**
- `page` (number): Página atual (default: 1)
- `limit` (number): Itens por página (default: 50, max: 100)
- `role` (string): Filtrar por role ('user', 'admin', 'premium')
- `search` (string): Buscar por email ou nome

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "usuario@exemplo.com",
      "name": "Nome do Usuário",
      "role": "user",
      "avatar_url": "https://...",
      "document_type": "cpf",
      "document_number": "12345678901",
      "phone": "11999999999",
      "email_verified": true,
      "created_at": "2025-01-29T00:00:00Z",
      "last_sign_in_at": "2025-01-29T12:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

### 2. Atualizar Role

```http
PATCH /api/auth/update-role
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "userId": "uuid-do-usuario",
  "role": "admin"
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

**Errors:**
- `401 Unauthorized`: Token inválido ou expirado
- `403 Forbidden`: Usuário não é admin
- `400 Bad Request`: Role inválida ou tentativa de mudar própria role
- `404 Not Found`: Usuário não encontrado

## 🔧 Arquitetura Técnica

### Frontend

**Componentes:**
- `AdminPanel.tsx`: Página principal do painel
- `AdminRoute`: Componente de proteção de rota

**Services:**
- `admin.service.ts`: Chamadas à API de administração
  - `listUsers()`: Lista usuários com filtros
  - `updateUserRole()`: Atualiza role do usuário
  - `getUserStats()`: Obtém estatísticas

**Estado:**
- `users`: Lista de usuários
- `stats`: Estatísticas do sistema
- `isLoading`: Estado de carregamento
- `selectedUser`: Usuário selecionado para edição

### Backend

**Endpoints:**
- `list-users.ts`: Lista todos os usuários (admin only)
- `update-role.ts`: Atualiza role de um usuário (admin only)

**Middleware:**
- `withAuth`: Valida JWT e injeta `req.user`
- `withCors`: Configura CORS

**Validações:**
- Role válida: 'user', 'admin', 'premium'
- Admin não pode alterar própria role
- Usuário alvo existe no sistema

## 🧪 Testando

### Teste Manual

1. **Criar conta admin:**
```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"admin"')
WHERE email = 'admin@teste.com';
```

2. **Acessar painel:**
- Login com conta admin
- Navegar para `/admin`
- Verificar se estatísticas carregam
- Buscar usuários
- Testar filtros
- Alterar role de um usuário

3. **Testar proteções:**
- Tentar acessar `/admin` com conta não-admin
- Verificar se redireciona para `/dashboard`
- Tentar acessar sem login
- Verificar se redireciona para `/`

### Teste de API (cURL)

```bash
# Login como admin
curl -X POST https://seu-dominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@teste.com","password":"senha123"}'

# Salvar o access_token da resposta

# Listar usuários
curl -X GET "https://seu-dominio.com/api/auth/list-users?page=1&limit=10" \
  -H "Authorization: Bearer SEU_TOKEN"

# Atualizar role
curl -X PATCH https://seu-dominio.com/api/auth/update-role \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"uuid-do-usuario","role":"premium"}'
```

## 🚨 Troubleshooting

### Painel não carrega (erro 403)

**Problema:** Usuário não é admin

**Solução:**
1. Verificar role no banco:
```sql
SELECT email, raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'seu-email@exemplo.com';
```

2. Se role não for 'admin', atualizar:
```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"admin"')
WHERE email = 'seu-email@exemplo.com';
```

3. Fazer logout e login novamente

### Estatísticas não aparecem

**Problema:** Erro ao buscar usuários

**Solução:**
1. Verificar console do navegador (F12)
2. Verificar se token está válido
3. Verificar logs da API
4. Verificar se migration 002 foi aplicada

### Não consigo alterar role

**Problema:** Tentando alterar própria role

**Solução:**
- Sistema bloqueia alteração da própria role por segurança
- Use outro admin ou SQL direto

### Usuário alterado não reflete mudanças

**Problema:** Role está em cache no JWT

**Solução:**
- Usuário afetado precisa fazer logout e login
- JWT antigo ainda tem role antiga
- Após novo login, novo JWT terá role atualizada

## 🔐 Boas Práticas de Segurança

### ✅ DO (Faça)

1. **Mantenha poucos admins**: Apenas pessoas confiáveis
2. **Use senhas fortes**: Para contas admin
3. **Ative 2FA**: (quando implementado)
4. **Audite alterações**: Monitore quem muda roles
5. **Teste em staging**: Antes de fazer mudanças em produção

### ❌ DON'T (Não Faça)

1. **Não compartilhe credenciais**: Cada admin deve ter sua conta
2. **Não remova último admin**: Sempre mantenha pelo menos um
3. **Não ignore erros 403**: Podem indicar tentativa de invasão
4. **Não faça alterações em massa**: Sem testar antes
5. **Não exponha o painel**: Mantenha URL `/admin` não indexada

## 📈 Melhorias Futuras

- [ ] Audit log de todas as alterações de role
- [ ] Exportar lista de usuários (CSV/Excel)
- [ ] Filtros avançados (por data, documento, etc.)
- [ ] Gráficos de crescimento de usuários
- [ ] Envio de email em massa
- [ ] Suspensão/ativação de contas
- [ ] Histórico de atividades do usuário
- [ ] Dashboard com métricas em tempo real
- [ ] Notificações para admins
- [ ] Permissões granulares (super-admin, moderador, etc.)

## 📚 Recursos Relacionados

- [ROLE_MANAGEMENT.md](./ROLE_MANAGEMENT.md) - Guia completo de roles
- [AdminPanel.tsx](../apps/web/src/pages/AdminPanel.tsx) - Código do painel
- [admin.service.ts](../apps/web/src/services/admin.service.ts) - Service de admin
- [list-users.ts](../apps/api/api/auth/list-users.ts) - Endpoint de listagem
- [update-role.ts](../apps/api/api/auth/update-role.ts) - Endpoint de atualização
