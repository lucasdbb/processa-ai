# Guia de Migração - Frontend v1 para v2

Este guia detalha como migrar as features restantes do frontend antigo (Vite/React) para o novo (Next.js).

## ✅ Já Migrado

- [x] Configuração base (Next.js, TypeScript, Tailwind)
- [x] Supabase clients (server e client)
- [x] Middleware de autenticação
- [x] Sistema de auth completo (store, hooks, services, schemas)
- [x] Componentes de layout (Header, Footer, UserMenu)
- [x] Modal de Login/Register com validação
- [x] Página inicial (HomePage)
- [x] shadcn/ui components (Button, Input, Dialog, etc.)

## 🚧 Pendente de Migração

### 1. Blog Feature

**Arquivos a migrar:**
```
frontend/src/features/blog/
├── components/
│   ├── BlogPage.tsx          → frontend_2/src/app/blog/page.tsx
│   ├── AdminPanel.tsx        → frontend_2/src/app/admin/page.tsx
│   ├── CreatePostPage.tsx    → frontend_2/src/app/admin/posts/new/page.tsx
│   └── PostViewModal.tsx     → frontend_2/src/features/blog/components/
├── services/
│   └── admin.service.ts      → frontend_2/src/features/blog/services/
└── types/
    └── blog.ts               → frontend_2/src/features/blog/types/
```

**Passos:**

1. **Criar schemas Zod para posts:**

```typescript
// src/features/blog/schemas/post-schemas.ts
import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  excerpt: z.string().optional(),
  category: z.string().min(1, 'Categoria é obrigatória'),
  tags: z.array(z.string()).optional(),
  featured_image: z.string().url().optional(),
  published: z.boolean().default(false),
})

export type CreatePostData = z.infer<typeof createPostSchema>
```

2. **Criar serviço de posts:**

```typescript
// src/features/blog/services/post-service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL

export const postService = {
  async getPosts() {
    const response = await fetch(`${API_URL}/blog/posts`)
    return response.json()
  },

  async getPost(id: string) {
    const response = await fetch(`${API_URL}/blog/posts/${id}`)
    return response.json()
  },

  async createPost(data: CreatePostData) {
    const response = await fetch(`${API_URL}/blog/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    })
    return response.json()
  },

  // ... outros métodos
}
```

3. **Criar página de blog (Server Component):**

```typescript
// src/app/blog/page.tsx
import { postService } from '@/features/blog/services/post-service'
import { BlogList } from '@/features/blog/components/blog-list'

export default async function BlogPage() {
  const posts = await postService.getPosts()

  return (
    <div>
      <h1>Blog Jurídico</h1>
      <BlogList posts={posts} />
    </div>
  )
}
```

4. **Criar componentes interativos (Client Components):**

```typescript
// src/features/blog/components/post-card.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'

export function PostCard({ post }) {
  return (
    <Card>
      <Link href={`/blog/${post.id}`}>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
      </Link>
    </Card>
  )
}
```

### 2. AI Chat Feature

**Estrutura sugerida:**

```
src/
├── app/
│   └── ia-juridica/
│       └── page.tsx                 # Server Component (layout)
├── features/
│   └── ai-chat/
│       ├── components/
│       │   ├── chat-interface.tsx   # Client Component
│       │   ├── message-list.tsx
│       │   ├── message-input.tsx
│       │   └── chat-bubble.tsx
│       ├── hooks/
│       │   └── use-chat.ts          # Estado do chat
│       ├── services/
│       │   └── ai-service.ts        # API calls
│       └── types/
│           └── index.ts
```

**Implementação:**

1. **Hook de chat:**

```typescript
// src/features/ai-chat/hooks/use-chat.ts
'use client'

import { useState } from 'react'
import { aiService } from '../services/ai-service'

export function useChat() {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async (content: string) => {
    setIsLoading(true)
    setMessages(prev => [...prev, { role: 'user', content }])

    try {
      const response = await aiService.sendMessage(content)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } finally {
      setIsLoading(false)
    }
  }

  return { messages, sendMessage, isLoading }
}
```

2. **Componente de chat:**

```typescript
// src/features/ai-chat/components/chat-interface.tsx
'use client'

import { useChat } from '../hooks/use-chat'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'

export function ChatInterface() {
  const { messages, sendMessage, isLoading } = useChat()

  return (
    <div className="flex flex-col h-[600px]">
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
```

### 3. Calculators Feature

**Estrutura sugerida:**

```
src/
├── app/
│   └── calculadoras/
│       ├── page.tsx                      # Lista de calculadoras
│       ├── previdencia/
│       │   └── page.tsx
│       └── trabalhista/
│           └── page.tsx
├── features/
│   └── calculators/
│       ├── components/
│       │   ├── calculator-card.tsx
│       │   ├── pension-calculator.tsx
│       │   └── labor-calculator.tsx
│       ├── schemas/
│       │   └── calculator-schemas.ts    # Validações Zod
│       ├── services/
│       │   └── calculator-service.ts
│       └── types/
```

**Exemplo de calculadora:**

```typescript
// src/features/calculators/components/pension-calculator.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pensionSchema } from '../schemas/calculator-schemas'

export function PensionCalculator() {
  const form = useForm({
    resolver: zodResolver(pensionSchema),
  })

  const onSubmit = (data) => {
    // Cálculos aqui
    console.log(data)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('salary')} />
      <Input {...form.register('contributionTime')} />
      <Button type="submit">Calcular</Button>
    </form>
  )
}
```

### 4. Páginas Adicionais

**Páginas simples (Server Components):**

```typescript
// src/app/sobre/page.tsx
export default function AboutPage() {
  return (
    <div className="container mx-auto py-12">
      <h1>Sobre o Processa AI</h1>
      <p>Conteúdo estático...</p>
    </div>
  )
}

// src/app/planos/page.tsx
import { PricingCards } from '@/components/pricing-cards'

export default function PlansPage() {
  return (
    <div>
      <h1>Planos e Preços</h1>
      <PricingCards />
    </div>
  )
}
```

## 🛠️ Ferramentas de Migração

### 1. Conversão de useState para Zustand

**Antes (useState local):**
```typescript
function Component() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
}
```

**Depois (Zustand global):**
```typescript
// store
const useStore = create((set) => ({
  user: null,
  loading: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}))

// component
function Component() {
  const { user, loading } = useStore()
}
```

### 2. Conversão de Fetch para Service

**Antes:**
```typescript
const response = await fetch('/api/posts')
const data = await response.json()
```

**Depois:**
```typescript
// service
export const postService = {
  getPosts: () => fetch('/api/posts').then(r => r.json())
}

// component
const posts = await postService.getPosts()
```

### 3. Validação de Formulários

**Antes (validação manual):**
```typescript
if (!email) {
  setError('Email é obrigatório')
}
if (!email.includes('@')) {
  setError('Email inválido')
}
```

**Depois (Zod):**
```typescript
const schema = z.object({
  email: z.string().email('Email inválido')
})

const form = useForm({
  resolver: zodResolver(schema)
})
```

## 📋 Checklist de Migração

Para cada feature, siga este checklist:

- [ ] Criar tipos TypeScript em `types/`
- [ ] Criar schemas Zod em `schemas/`
- [ ] Migrar lógica de API para `services/`
- [ ] Criar Zustand store se necessário em `store/`
- [ ] Criar hooks customizados em `hooks/`
- [ ] Migrar componentes para `components/`
  - [ ] Marcar com `'use client'` se necessário
  - [ ] Converter para Server Component quando possível
- [ ] Criar páginas em `app/`
- [ ] Testar funcionalidade
- [ ] Atualizar documentação

## 🔍 Debugging Tips

### Hydration Errors

```
Error: Hydration failed because the initial UI does not match...
```

**Causa:** Server e Client renderizaram HTML diferente

**Solução:**
```typescript
// ❌ BAD: Acessa localStorage no Server Component
const theme = localStorage.getItem('theme')

// ✅ GOOD: useEffect para cliente
const [theme, setTheme] = useState(null)
useEffect(() => {
  setTheme(localStorage.getItem('theme'))
}, [])
```

### "use client" Required

```
Error: createContext only works in Client Components
```

**Solução:** Adicione `'use client'` no topo do arquivo

### Middleware Not Running

**Verifique:** `src/middleware.ts` existe e está exportando:
```typescript
export async function middleware(request: NextRequest) {
  // ...
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

## 🎯 Próximos Passos

1. **Migrar Blog Feature** (maior prioridade)
2. **Migrar AI Chat**
3. **Migrar Calculators**
4. **Criar páginas estáticas** (Sobre, Planos, etc.)
5. **Adicionar testes**
6. **Setup CI/CD**

## 📚 Recursos

- [Next.js Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Server vs Client Components](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
