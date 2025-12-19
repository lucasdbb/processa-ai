# Processa AI Frontend

Frontend moderno da plataforma Processa AI construído com Next.js 15, React 19, TypeScript, Supabase, e shadcn/ui.

## 🚀 Stack Tecnológica

### Core
- **Next.js 15.5.9** - Framework React com App Router e Server Components
- **React 19.2.1** - Biblioteca UI com Server Components e React Compiler
- **TypeScript 5** - Tipagem estática e segurança de tipos
- **Tailwind CSS 4** - Framework CSS utility-first de última geração

### Autenticação e Dados
- **Supabase 2.87** - Backend-as-a-Service (Auth, Database, Storage)
- **@supabase/ssr 0.8** - Cliente Supabase otimizado para SSR/SSG
- **Autenticação via Middleware** - Proteção de rotas server-side

### State Management
- **Zustand 5.0** - State management minimalista e performático
  - **Por que Zustand?**
    - Apenas ~1KB minificado (vs Redux 15KB+)
    - API simples e intuitiva, sem boilerplate
    - Hooks nativos do React
    - DevTools integrados para debug
    - Persistência de estado built-in
    - TypeScript-first com inferência automática

### Formulários e Validação
- **react-hook-form 7.68** - Gerenciamento de formulários performático
- **Zod 4.1** - Schema validation com TypeScript de primeira classe
- **@hookform/resolvers 5.2** - Integração seamless entre RHF e Zod

### UI Components
- **shadcn/ui** - Componentes acessíveis e customizáveis (copy-paste)
- **Radix UI** - Primitivos de UI headless com acessibilidade WAI-ARIA
- **lucide-react 0.560** - Biblioteca de ícones modernos e otimizados
- **sonner 2.0** - Sistema de toast notifications elegante
- **next-themes 0.4** - Suporte a dark mode com transições suaves
- **vaul 1.1** - Bottom sheet/drawer components

### Markdown
- **@uiw/react-md-editor 4.0** - Editor de Markdown WYSIWYG
- **@uiw/react-markdown-preview 5.1** - Renderização de Markdown
- **marked 17.0** - Parser de Markdown rápido
- **dompurify 3.3** - Sanitização de HTML para segurança

## 📁 Estrutura de Diretórios

```
apps/frontend/
├── src/
│   ├── app/                          # Next.js 15 App Router
│   │   ├── _components/              # Componentes compartilhados entre páginas
│   │   ├── blog/                     # Rotas do blog
│   │   │   ├── [slug]/               # Post individual (SSG)
│   │   │   └── page.tsx              # Lista de posts (SSR)
│   │   ├── ia-juridica/              # Chat IA (protegido)
│   │   │   └── page.tsx
│   │   ├── calculadoras/             # Calculadoras (protegido)
│   │   │   └── page.tsx
│   │   ├── admin/                    # Dashboard admin (protegido + admin role)
│   │   │   └── page.tsx
│   │   ├── planos/                   # Página de planos
│   │   │   └── page.tsx
│   │   ├── sobre/                    # Página sobre
│   │   │   └── page.tsx
│   │   ├── layout.tsx                # Root layout com Header/Footer
│   │   ├── page.tsx                  # Landing page (SSG)
│   │   ├── loading.tsx               # Loading state global
│   │   └── globals.css               # Estilos globais + Tailwind
│   │
│   ├── components/                   # Componentes reutilizáveis
│   │   ├── ui/                       # shadcn/ui components (Radix UI)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   └── layout/                   # Componentes de layout
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── ...
│   │
│   ├── features/                     # Módulos por domínio (Clean Architecture)
│   │   ├── auth/
│   │   │   ├── components/           # LoginForm, RegisterForm, etc.
│   │   │   ├── hooks/                # useAuth, useUser
│   │   │   ├── schemas/              # loginSchema, registerSchema (Zod)
│   │   │   ├── services/             # authService (Supabase calls)
│   │   │   ├── store/                # authStore (Zustand)
│   │   │   └── types/                # AuthUser, Session, etc.
│   │   ├── blog/
│   │   │   ├── components/           # PostCard, PostList, etc.
│   │   │   ├── hooks/                # usePosts, usePost
│   │   │   ├── services/             # blogService
│   │   │   └── types/                # Post, Category
│   │   ├── ai-chat/
│   │   │   ├── components/           # ChatWindow, MessageList
│   │   │   └── services/             # chatService
│   │   ├── calculators/
│   │   │   ├── components/           # CalculatorForm
│   │   │   └── services/             # calculatorService
│   │   └── admin/
│   │       ├── components/           # PostEditor, AdminDashboard
│   │       └── services/             # adminService
│   │
│   ├── lib/                          # Bibliotecas e utilitários
│   │   ├── supabase/
│   │   │   ├── client.ts             # Cliente browser (createBrowserClient)
│   │   │   ├── server.ts             # Cliente server (createServerClient)
│   │   │   └── middleware.ts         # Cliente middleware
│   │   └── utils.ts                  # cn (clsx + tailwind-merge), formatters
│   │
│   ├── hooks/                        # Custom hooks globais
│   │   └── useMediaQuery.ts
│   │
│   ├── services/                     # Serviços compartilhados
│   │   └── api.ts
│   │
│   ├── stores/                       # Zustand stores globais
│   │   └── useAuthStore.ts
│   │
│   ├── config/                       # Configurações
│   │   └── site.ts                   # Metadados, URLs, etc.
│   │
│   └── middleware.ts                 # Next.js middleware (auth + redirects)
│
├── public/                           # Assets estáticos
│   ├── images/
│   └── ...
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── .env.local                        # Variáveis de ambiente
```

## 🏗️ Arquitetura e Princípios

### 1. Arquitetura Limpa por Domínio (Feature-First)

Cada feature é organizada em seu próprio módulo com responsabilidades claras:
- **components/**: UI específica da feature
- **hooks/**: Lógica reutilizável da feature
- **services/**: Integração com APIs/Supabase
- **schemas/**: Validação de dados (Zod)
- **types/**: Tipos TypeScript
- **store/**: Estado global da feature (Zustand)

**Benefícios:**
- Código organizado por domínio de negócio
- Fácil localização de código relacionado
- Facilita testes unitários
- Reduz acoplamento entre features

### 2. Server Components por Padrão

- **Server Components** para renderização estática (SSG) e server-side (SSR)
- **Client Components** (`'use client'`) apenas quando necessário:
  - Interatividade (onClick, onChange)
  - Hooks de estado (useState, useEffect)
  - Browser APIs (localStorage, window)
  - Context Providers

**Benefícios:**
- Melhor performance (menos JavaScript no cliente)
- SEO otimizado
- Dados fetched no servidor (mais rápido e seguro)

### 3. Autenticação Robusta com Supabase SSR

- **Middleware** para proteção de rotas server-side
- **Sessões via cookies** (httpOnly, secure, sameSite)
- **Refresh automático** de sessão
- **Role-based access control** (user, admin)

**Fluxo de autenticação:**
1. Usuário faz login via Supabase Auth
2. Sessão armazenada em cookies
3. Middleware valida sessão em cada request
4. Rotas protegidas redirecionam para login se não autenticado

### 4. Validação Type-Safe com Zod + React Hook Form

Todos os formulários usam validação tipada e runtime:
```typescript
const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres")
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema)
});
```

### 5. State Management com Zustand

Estado global gerenciado de forma simples e performática:
```typescript
const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null })
}));
```

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

## 🎯 Melhorias vs Versão Anterior (Vite)

### Arquitetura
1. **Next.js App Router** vs React Router DOM - SSR/SSG nativo, melhor SEO
2. **Server Components** - Renderização no servidor, menos JS no cliente
3. **Middleware de autenticação** - Proteção server-side vs client-side
4. **Arquitetura por domínio** - Features organizadas vs estrutura genérica

### Performance
5. **Code splitting automático** - Next.js vs manual com Vite
6. **Image Optimization** - Next.js Image component com otimização automática
7. **Font Optimization** - Next.js Font com subset automático
8. **Route prefetching** - Navegação instantânea

### Developer Experience
9. **File-based routing** - Intuitivo vs configuração manual
10. **TypeScript melhorado** - Inferência automática de props
11. **Hot Module Replacement (HMR)** - Mais rápido e confiável
12. **Zustand** - State management simples vs Context API verboso

### UI/UX
13. **shadcn/ui** - Componentes acessíveis e customizáveis
14. **Dark mode** - Suporte nativo via next-themes
15. **Toast notifications** - Sistema elegante com sonner
16. **Formulários robustos** - react-hook-form + zod

### Segurança
17. **Cookies httpOnly** - Sessões mais seguras vs localStorage
18. **CSRF protection** - Nativo no Next.js
19. **Sanitização de HTML** - DOMPurify para conteúdo markdown

## 📚 Recursos

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://docs.pmnd.rs/zustand)
- [Zod](https://zod.dev/)
