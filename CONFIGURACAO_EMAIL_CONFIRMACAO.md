# Configuração de Confirmação de E-mail

Este documento explica como configurar a confirmação de e-mail no Supabase para mostrar o modal de sucesso.

## O que foi implementado

1. **EmailConfirmedModal** - Modal centralizado que aparece quando o e-mail é confirmado
2. **EmailConfirmationHandler** - Componente que detecta o parâmetro `confirmed=true` na URL
3. **Integração com AuthCallback** - Redireciona para `/?confirmed=true` após confirmação

## Como funciona

1. Usuário se registra na aplicação
2. Supabase envia e-mail de confirmação com link
3. Usuário clica no link do e-mail
4. AuthCallback processa o callback e redireciona para `/?confirmed=true`
5. EmailConfirmationHandler detecta o parâmetro e abre o modal
6. Modal aparece no centro da tela com mensagem "E-mail Confirmado!"
7. Usuário fecha o modal clicando no botão "Fechar" ou no X
8. Parâmetro é removido da URL para não mostrar novamente ao recarregar

## Configuração no Supabase

### Passo 1: Acessar o Dashboard do Supabase

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para **Authentication** → **URL Configuration**

### Passo 2: Configurar Redirect URLs

Adicione as seguintes URLs à lista de **Redirect URLs** permitidas:

**Para desenvolvimento:**
```
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
http://localhost:5173/auth/callback
```

**Para produção:**
```
https://seu-dominio.com/auth/callback
```

### Passo 3: Configurar Site URL

Defina o **Site URL** como:

**Para desenvolvimento:**
```
http://localhost:3000
```
ou
```
http://localhost:3001
```
ou
```
http://localhost:5173
```

**Para produção:**
```
https://seu-dominio.com
```

### Passo 4: Configurar Template de E-mail (Opcional)

Você pode personalizar o template do e-mail de confirmação em:
**Authentication** → **Email Templates** → **Confirm signup**

O template padrão já funciona, mas você pode customizar a mensagem.

## Testando

1. Registre um novo usuário na aplicação
2. Verifique seu e-mail
3. Clique no link de confirmação
4. Você deve ser redirecionado para a aplicação
5. Um modal deve aparecer no centro da tela com a mensagem "E-mail Confirmado!"
6. Clique em "Fechar" para fechar o modal

## Arquivos Modificados

- `apps/frontend/src/features/auth/components/EmailConfirmedModal.tsx` - Novo modal
- `apps/frontend/src/features/auth/index.ts` - Exportação do modal
- `apps/frontend/src/App.tsx` - Adicionado handler e modal
- `apps/frontend/src/pages/AuthCallback.tsx` - Já existia, apenas verificado

## Observações

- O modal só aparece quando o usuário clica no link de confirmação do e-mail
- O modal não fecha automaticamente - o usuário deve fechar manualmente
- O parâmetro `confirmed=true` é removido da URL após abrir o modal
- O modal não aparecerá novamente ao recarregar a página (parâmetro foi removido)
