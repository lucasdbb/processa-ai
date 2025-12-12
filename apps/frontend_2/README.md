# Processa AI Frontend v2

Frontend moderno construído com Next.js 15, React 19, TypeScript, Supabase, e shadcn/ui.

## 🚀 Stack Tecnológica

### Core
- **Next.js 15** - Framework React com App Router e Server Components
- **React 19** - Biblioteca UI com suporte a Server Components
- **TypeScript 5** - Tipagem estática e segurança de tipos
- **Tailwind CSS 4** - Framework CSS utility-first

### Autenticação e Dados
- **Supabase** - Backend-as-a-Service (Auth, Database, Storage)
- **@supabase/ssr** - Cliente Supabase otimizado para SSR

### State Management
- **Zustand** - State management leve e performático
  - **Por que Zustand?**
    - Apenas ~1KB minificado
    - API simples e intuitiva
    - Sem boilerplate (vs Redux)
    - Hooks nativos
    - DevTools integrados
    - Persistência de estado built-in

### Formulários e Validação
- **react-hook-form** - Gerenciamento de formulários performático
- **Zod** - Schema validation com TypeScript
- **@hookform/resolvers** - Integração react-hook-form + Zod

### UI Components
- **shadcn/ui** - Componentes acessíveis e customizáveis
- **Radix UI** - Primitivos de UI headless
- **lucide-react** - Ícones modernos
- **sonner** - Toast notifications elegantes

## 📁 Estrutura de Diretórios

```
src/
├── app/                          # Next.js App Router
│   ├── _components/              # Componentes específicos de páginas
│   ├── layout.tsx                # Layout raiz
│   ├── page.tsx                  # Página inicial
│   └── globals.css               # Estilos globais
│
├── components/                   # Componentes reutilizáveis
│   ├── ui/                       # shadcn/ui components
│   └── layout/                   # Componentes de layout (Header, Footer)
│
├── features/                     # Feature modules (domain-driven)
│   ├── auth/
│   │   ├── components/           # Componentes específicos de auth
│   │   ├── hooks/                # Custom hooks (useAuth, useUser)
│   │   ├── schemas/              # Schemas Zod de validação
│   │   ├── services/             # API calls e lógica de negócio
│   │   ├── store/                # Zustand store
│   │   └── types/                # TypeScript types
│   ├── blog/
│   ├── ai-chat/
│   └── calculators/
│
├── lib/                          # Bibliotecas e utilitários
│   ├── supabase/
│   │   ├── client.ts             # Cliente Supabase (browser)
│   │   ├── server.ts             # Cliente Supabase (server)
│   │   └── middleware.ts         # Middleware de autenticação
│   └── utils.ts                  # Funções utilitárias (cn, formatters)
│
└── middleware.ts                 # Next.js middleware (auth, redirects)
```

## 🏗️ Arquitetura e Princípios

### 1. Arquitetura Limpa por Domínio

Cada feature é organizada em seu próprio módulo com responsabilidades claras.

### 2. Server Components por Padrão

- **Server Components** para renderização estática e SSR
- **Client Components** (`'use client'`) apenas quando necessário

### 3. Autenticação Robusta

- Middleware para proteção de rotas
- Sessões via cookies (seguro e httpOnly)
- Refresh automático de sessão

### 4. Validação com Zod + React Hook Form

Todos os formulários usam validação tipada com Zod.

### 5. State Management com Zustand

Estado global gerenciado de forma simples e performática.

## 🚀 Como Começar

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 3. Rodar Desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 📦 Scripts Disponíveis

```bash
npm run dev              # Inicia dev server (porta 3000)
npm run build           # Build de produção
npm run start           # Serve build de produção
npm run lint            # ESLint
npm run type-check      # TypeScript check
```

## 🎯 Melhorias vs Versão Anterior

1. **Server-Side Rendering (SSR)** - SEO otimizado
2. **Arquitetura Limpa** - Código organizado por domínio
3. **Type Safety** - Validação runtime com Zod
4. **State Management Moderno** - Zustand
5. **Autenticação Robusta** - Middleware + cookies
6. **UI Consistente** - Design system shadcn/ui
7. **Performance** - Code splitting automático

## 📚 Recursos

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://docs.pmnd.rs/zustand)
- [Zod](https://zod.dev/)
