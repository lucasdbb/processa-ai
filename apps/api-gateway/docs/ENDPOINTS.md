# 📡 API Gateway - Endpoints Completos

## 🔐 Autenticação

### POST /api/auth/login
Faz login e retorna tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  },
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "v1...",
    "expires_at": 1234567890
  }
}
```

---

### POST /api/auth/register
Cria novo usuário.

**Request:**
```json
{
  "email": "novo@example.com",
  "password": "senha12345",
  "name": "João Silva",
  "documentType": "cpf",
  "documentNumber": "12345678900"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "novo@example.com",
    "email_confirmed": false
  },
  "message": "Usuário criado com sucesso"
}
```

---

### POST /api/auth/refresh
Renova access token usando refresh token.

**Request:**
```json
{
  "refresh_token": "v1.Mr5..."
}
```

**Response 200:**
```json
{
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "v1...",
    "expires_at": 1234567890
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

### POST /api/auth/logout
Faz logout (requer autenticação).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "message": "Logout realizado com sucesso"
}
```

---

### GET /api/auth/me
Retorna dados básicos do usuário autenticado.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

## 👤 Perfil do Usuário

### GET /api/users/profile
Retorna perfil completo do usuário autenticado.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "João Silva",
  "role": "user",
  "avatar": "https://...",
  "phone": "+55 11 99999-9999",
  "document_type": "cpf",
  "document_number": "123.456.789-00",
  "created_at": "2025-01-01T00:00:00Z",
  "email_verified": true,
  "last_sign_in": "2025-11-04T12:00:00Z"
}
```

---

### PUT /api/users/profile
### PATCH /api/users/profile
Atualiza perfil do usuário autenticado.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request:**
```json
{
  "name": "João Silva Santos",
  "phone": "+55 11 98888-8888",
  "avatar": "https://..."
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "João Silva Santos",
    "role": "user",
    "avatar": "https://...",
    "phone": "+55 11 98888-8888",
    "created_at": "2025-01-01T00:00:00Z",
    "email_verified": true
  },
  "message": "Perfil atualizado com sucesso"
}
```

---

### POST /api/users/profile/avatar
Upload de avatar (multipart/form-data).

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Request (Form Data):**
```
avatar: [file.jpg]
```

**Response 200:**
```json
{
  "avatar_url": "https://SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/public/avatars/uuid.jpg",
  "message": "Avatar uploaded successfully"
}
```

---

## 👑 Admin (Apenas Administradores)

### GET /api/users
Lista todos os usuários (admin only).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
- `page` (number, default: 1)
- `limit` (number, default: 50, max: 100)
- `role` (string, optional: "user" | "admin" | "premium")
- `search` (string, optional: busca por email ou nome)

**Response 200:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "João Silva",
      "role": "user",
      "avatar_url": null,
      "document_type": "cpf",
      "document_number": "123.456.789-00",
      "phone": "+55 11 99999-9999",
      "email_verified": true,
      "created_at": "2025-01-01T00:00:00Z",
      "last_sign_in_at": "2025-11-04T12:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 50
}
```

---

### PATCH /api/users/:userId/role
Atualiza role de um usuário (admin only).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request:**
```json
{
  "userId": "uuid-do-usuario",
  "role": "admin"
}
```

**Response 200:**
```json
{
  "message": "Role atualizada para 'admin' com sucesso",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

---

## 💚 Health Check

### GET /api/health
Verifica status do serviço.

**Response 200:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T12:00:00Z",
  "service": "api-gateway",
  "version": "1.0.0"
}
```

---

### GET /
Informações da API.

**Response 200:**
```json
{
  "message": "Processa AI - API Gateway",
  "version": "1.0.0",
  "status": "operational",
  "endpoints": {
    "health": "/api/health",
    "auth": "/api/auth/*"
  }
}
```

---

## 📊 Resumo de Endpoints

| Método | Endpoint | Auth | Admin | Descrição |
|--------|----------|------|-------|-----------|
| POST | `/api/auth/login` | ❌ | ❌ | Login |
| POST | `/api/auth/register` | ❌ | ❌ | Registro |
| POST | `/api/auth/refresh` | ❌ | ❌ | Refresh token |
| POST | `/api/auth/logout` | ✅ | ❌ | Logout |
| GET | `/api/auth/me` | ✅ | ❌ | Dados básicos do usuário |
| GET | `/api/users/profile` | ✅ | ❌ | Perfil completo |
| PUT | `/api/users/profile` | ✅ | ❌ | Atualizar perfil |
| PATCH | `/api/users/profile` | ✅ | ❌ | Atualizar perfil |
| POST | `/api/users/profile/avatar` | ✅ | ❌ | Upload avatar |
| GET | `/api/users` | ✅ | ✅ | Listar usuários |
| PATCH | `/api/users/:userId/role` | ✅ | ✅ | Atualizar role |
| GET | `/api/health` | ❌ | ❌ | Health check |
| GET | `/` | ❌ | ❌ | Info da API |

**Total: 13 endpoints**

---

## 🔒 Autenticação

Todos os endpoints que requerem autenticação (`Auth: ✅`) devem incluir o header:

```
Authorization: Bearer {access_token}
```

Endpoints que requerem `Admin: ✅` também verificam se `user.role === 'admin'`.

---

## ⚠️ Códigos de Erro Comuns

| Código | Status | Descrição |
|--------|--------|-----------|
| `UNAUTHORIZED` | 401 | Token ausente ou inválido |
| `FORBIDDEN` | 403 | Acesso negado (não é admin) |
| `VALIDATION_ERROR` | 400 | Campos inválidos ou faltando |
| `USER_NOT_FOUND` | 404 | Usuário não encontrado |
| `INTERNAL_ERROR` | 500 | Erro interno do servidor |

---

**Última atualização:** 2025-11-04
