# 📚 API Gateway - Documentação e Testes

## 🧪 Postman Collection

Esta pasta contém a collection do Postman para testar todos os endpoints do API Gateway.

### 📦 Arquivos

- **API-Gateway.postman_collection.json** - Collection completa
- **API-Gateway.postman_environment.json** - Environment com variáveis

---

## 🚀 Como Usar

### 1. Importar no Postman

1. Abra o Postman
2. Clique em **Import**
3. Arraste os 2 arquivos JSON:
   - `API-Gateway.postman_collection.json`
   - `API-Gateway.postman_environment.json`
4. Clique em **Import**

### 2. Configurar Environment

1. No canto superior direito, selecione **Processa AI - Local**
2. Verifique se `base_url` está `http://localhost:4000`
3. As outras variáveis serão preenchidas automaticamente após login

### 3. Rodar Testes

#### Opção A: Collection Runner (Todos os Testes)

1. Clique com botão direito em **Processa AI - API Gateway**
2. Selecione **Run collection**
3. Clique em **Run**

#### Opção B: Requests Individuais

1. Expanda a collection
2. Execute os requests na ordem:
   - Health Check → Register → Login → Me → Logout

---

## 📋 Endpoints Disponíveis

### Health Check

- ✅ `GET /api/health` - Status do serviço
- ✅ `GET /` - Informações da API

### Authentication

- ✅ `POST /api/auth/register` - Criar usuário
- ✅ `POST /api/auth/login` - Fazer login (salva token automaticamente)
- ✅ `POST /api/auth/refresh` - Renovar access token
- ✅ `GET /api/auth/me` - Dados do usuário (usa token automaticamente)
- ✅ `POST /api/auth/logout` - Fazer logout (limpa tokens)

### Profile

- ✅ `GET /api/users/profile` - Perfil completo do usuário
- ✅ `PUT /api/users/profile` - Atualizar perfil (substitui todos os campos)
- ✅ `PATCH /api/users/profile` - Atualizar perfil (apenas campos enviados)
- ✅ `POST /api/users/profile/avatar` - Upload de avatar

### Admin (Requer role admin)

- 👑 `GET /api/users` - Listar todos os usuários (com paginação e filtros)
- 👑 `PATCH /api/users/:userId/role` - Atualizar role de um usuário

### Error Cases

- ❌ Login com email inválido
- ❌ Login com senha incorreta
- ❌ Registro duplicado
- ❌ Campos faltando
- ❌ Sem token
- ❌ Token inválido

**Total: 13 endpoints**

---

## 🎯 Fluxo Recomendado

```bash
# 1. Verificar se servidor está rodando
GET /api/health

# 2. Criar usuário de teste
POST /api/auth/register
{
  "email": "teste@processa-ai.com",
  "password": "senha12345",
  "name": "Usuário Teste",
  "documentType": "cpf",
  "documentNumber": "12345678900"
}

# 3. Fazer login (salva token automaticamente)
POST /api/auth/login
{
  "email": "teste@processa-ai.com",
  "password": "senha12345"
}

# 4. Buscar dados do usuário (usa token do environment)
GET /api/auth/me

# 5. Fazer logout (limpa tokens)
POST /api/auth/logout
```

---

## ⚙️ Variáveis de Environment

| Variável | Descrição | Preenchimento |
|----------|-----------|---------------|
| `base_url` | URL da API | Manual (default: localhost:4000) |
| `access_token` | JWT de acesso | Automático após login |
| `refresh_token` | Token de refresh | Automático após login |
| `user_id` | ID do usuário | Automático após login |
| `user_email` | Email do usuário | Automático após login |
| `user_role` | Role do usuário | Automático após login |

---

## 🌍 Ambientes

### Local Development
```
base_url: http://localhost:4000
```

### Staging
```
base_url: https://api-staging.processa-ai.com.br
```

### Production
```
base_url: https://api.processa-ai.com.br
```

Para trocar ambiente, basta criar um novo environment no Postman com a `base_url` correta.

---

## 🐛 Troubleshooting

### Servidor não responde
```bash
# Verificar se servidor está rodando
npm run dev --workspace=@processa-ai/api-gateway

# Deve aparecer:
# 🚀 API Gateway listening on port 4000
```

### Token expirado (401)
```
Faça login novamente:
POST /api/auth/login
```

### Erro de validação (400)
```
Verifique o corpo da requisição:
- Todos os campos obrigatórios presentes?
- JSON válido?
- Formato correto (email, CPF, etc)?
```

---

## 📚 Documentação Adicional

- **[API Gateway README](../README.md)** - Informações do serviço
- **[Migração Vercel → Express](../../../MIGRACAO_VERCEL_PARA_EXPRESS.md)** - Guia de migração
- **[Estrutura Definitiva](../../../ESTRUTURA_DEFINITIVA.md)** - Arquitetura completa

---

**Última atualização:** 2025-11-04
