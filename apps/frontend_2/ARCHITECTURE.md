# Arquitetura Frontend v2 - Processa AI

Este documento detalha as decisões arquiteturais, padrões e melhores práticas implementadas no frontend v2.

## 📐 Decisões Arquiteturais

### 1. Next.js 15 com App Router

**Por que Next.js?**
- ✅ SSR (Server-Side Rendering) out-of-the-box
- ✅ SEO otimizado automaticamente
- ✅ Code splitting automático
- ✅ Image optimization integrada
- ✅ API Routes para BFF pattern (se necessário)
- ✅ File-based routing intuitivo

**Por que App Router (vs Pages Router)?**
- Server Components por padrão (melhor performance)
- Layouts compartilhados com melhor reuso
- Streaming e suspense nativos
- Melhor suporte a TypeScript
- Futuro do Next.js (Pages Router em manutenção)

### 2. Zustand para State Management

**Por que Zustand? (vs Redux, Context API, Jotai)**

| Critério | Zustand | Redux | Context API | Jotai |
|----------|---------|-------|-------------|-------|
| Bundle size | ~1KB | ~8KB | 0KB (built-in) | ~3KB |
| Boilerplate | Mínimo | Alto | Médio | Mínimo |
| DevTools | ✅ | ✅ | ❌ | ✅ |
| Persistência | ✅ Built-in | Precisa middleware | Manual | Precisa atoms |
| Curva de aprendizado | Baixa | Alta | Média | Média |
| TypeScript | Excelente | Bom | Bom | Excelente |

**Exemplo de uso:**

```typescript
// Store simples e tipado
const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        setUser: (user) => set({ user }),
      }),
      { name: 'auth-storage' }
    )
  )
)

// Hook customizado com lógica adicional
export function useAuth() {
  const { user, setUser } = useAuthStore()

  const login = async (credentials) => {
    const data = await authService.login(credentials)
    setUser(data.user)
  }

  return { user, login }
}
```

### 3. react-hook-form + Zod

**Por que esta combinação?**
- ✅ Performance: re-renders mínimos
- ✅ Type safety: validação tipada
- ✅ UX: validação on-change, on-blur
- ✅ DX: código limpo e declarativo

**Fluxo de validação:**

```typescript
// 1. Schema Zod (type-safe)
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6),
})

// 2. Type inference automática
type LoginData = z.infer<typeof loginSchema>

// 3. Form com validação integrada
const form = useForm<LoginData>({
  resolver: zodResolver(loginSchema),
})

// 4. Submit com dados validados
const onSubmit = (data: LoginData) => {
  // data é 100% válido aqui!
}
```

### 4. Supabase Auth com SSR

**Arquitetura de autenticação:**

```
┌─────────────────────────────────────────────────┐
│ Browser                                         │
│  ├─ Client Component (useAuth hook)            │
│  └─ Cookie (session token)                     │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ Next.js Middleware                              │
│  ├─ Verifica sessão em cada request            │
│  ├─ Refresh token automático                   │
│  └─ Redireciona se necessário                  │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ Server Components                               │
│  ├─ createClient() server-side                 │
│  ├─ Acesso direto ao user                      │
│  └─ Sem client-side hydration                  │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ Supabase                                        │
│  ├─ PostgreSQL (profiles, roles)               │
│  ├─ Auth (JWT tokens)                          │
│  └─ Storage (avatars, files)                   │
└─────────────────────────────────────────────────┘
```

**Vantagens desta arquitetura:**
- 🔒 Sessões seguras via httpOnly cookies
- 🚀 No client-side auth checks (mais rápido)
- 🔄 Refresh automático de tokens
- 🛡️ Proteção de rotas no middleware

### 5. Arquitetura por Features (Domain-Driven)

**Estrutura tradicional (BAD):**

```
src/
├── components/       # 100+ componentes misturados
├── hooks/            # Hooks de tudo
├── services/         # Services de tudo
└── utils/            # Utils de tudo
```

**Estrutura por features (GOOD):**

```
src/
├── features/
│   ├── auth/
│   │   ├── components/   # Só componentes de auth
│   │   ├── hooks/        # Só hooks de auth
│   │   ├── services/     # Só services de auth
│   │   └── types/        # Só types de auth
│   ├── blog/
│   └── ai-chat/
└── components/       # Apenas componentes COMPARTILHADOS
```

**Vantagens:**
- ✅ Código organizado por domínio de negócio
- ✅ Fácil encontrar código relacionado
- ✅ Facilita trabalho em equipe (menos conflitos)
- ✅ Delete uma pasta = delete uma feature
- ✅ Testabilidade isolada

## 🎨 Padrões de Código

### Server vs Client Components

**Regra de Ouro:**
> Use Server Components por padrão. Só use Client Components quando REALMENTE necessário.

**Quando usar Client Components:**

```typescript
'use client' // Obrigatório em:

// 1. Interatividade (hooks de estado)
const [isOpen, setIsOpen] = useState(false)

// 2. Browser APIs
useEffect(() => {
  localStorage.setItem('key', 'value')
}, [])

// 3. Event handlers
<button onClick={() => console.log('click')}>

// 4. Custom hooks
const { user } = useAuth()

// 5. Context providers
<AuthProvider>...</AuthProvider>
```

**Server Components (padrão):**

```typescript
// ✅ Fetch direto no componente
export default async function BlogPage() {
  const posts = await fetch('https://api.com/posts')
  return <PostList posts={posts} />
}

// ✅ Acesso ao banco sem API
export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  return <Profile user={user} />
}
```

### Composição de Componentes

**Pattern: Container/Presentational**

```typescript
// ❌ Componente fazendo tudo (BAD)
export function UserProfile() {
  const { user } = useAuth()
  const { data, loading } = useUserPosts(user.id)

  if (loading) return <Spinner />

  return (
    <div>
      <Avatar src={user.avatar} />
      <h1>{user.name}</h1>
      {data.map(post => <PostCard key={post.id} {...post} />)}
    </div>
  )
}

// ✅ Separado em responsabilidades (GOOD)
// Container (lógica)
'use client'
export function UserProfileContainer() {
  const { user } = useAuth()
  const { data, loading } = useUserPosts(user.id)

  if (loading) return <Spinner />
  return <UserProfileView user={user} posts={data} />
}

// Presentational (UI pura)
export function UserProfileView({ user, posts }) {
  return (
    <div>
      <UserHeader user={user} />
      <PostList posts={posts} />
    </div>
  )
}
```

### Error Boundaries

```typescript
// app/error.tsx (Next.js error boundary)
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Algo deu errado!</h2>
      <button onClick={reset}>Tentar novamente</button>
    </div>
  )
}
```

### Loading States

```typescript
// app/blog/loading.tsx (Automatic loading UI)
export default function Loading() {
  return <BlogSkeleton />
}

// Streaming com Suspense
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <SlowComponent />
    </Suspense>
  )
}
```

## 🔐 Segurança

### 1. XSS Protection

```typescript
// ✅ GOOD: Sanitize user content
import DOMPurify from 'isomorphic-dompurify'

const sanitized = DOMPurify.sanitize(userContent)
<div dangerouslySetInnerHTML={{ __html: sanitized }} />

// ❌ BAD: Direct HTML injection
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

### 2. CSRF Protection

```typescript
// Cookies com sameSite
cookies.set('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax', // Protege contra CSRF
})
```

### 3. Validação de Dados

```typescript
// ✅ SEMPRE validar no backend também
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

// Frontend validation (UX)
const form = useForm({ resolver: zodResolver(schema) })

// Backend validation (Security)
// No FastAPI: Pydantic valida automaticamente
```

## ⚡ Performance

### 1. Code Splitting

```typescript
// Lazy loading de rotas
const BlogPage = lazy(() => import('@/features/blog/pages/BlogPage'))

// Lazy loading de componentes pesados
const Editor = lazy(() => import('@/components/RichTextEditor'))

<Suspense fallback={<Spinner />}>
  <Editor />
</Suspense>
```

### 2. Image Optimization

```typescript
// ✅ Use Next.js Image
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero"
  width={800}
  height={600}
  priority // LCP optimization
  placeholder="blur"
/>

// ❌ Não use <img> tag diretamente
```

### 3. Memoization

```typescript
// useMemo para cálculos caros
const filteredPosts = useMemo(() => {
  return posts.filter(post => post.category === selected)
}, [posts, selected])

// useCallback para funções passadas como props
const handleSubmit = useCallback((data) => {
  submitForm(data)
}, [])

// React.memo para componentes puros
export const PostCard = React.memo(({ post }) => {
  return <Card>{post.title}</Card>
})
```

## 🧪 Testing Strategy (Futuro)

```
┌─────────────────────────────────────┐
│ Unit Tests (Vitest)                 │
│  ├─ Hooks                           │
│  ├─ Utils                           │
│  └─ Services                        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Integration Tests (Testing Library) │
│  ├─ Forms                           │
│  ├─ User flows                      │
│  └─ API mocks                       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ E2E Tests (Playwright)              │
│  ├─ Auth flow                       │
│  ├─ Critical paths                  │
│  └─ Cross-browser                   │
└─────────────────────────────────────┘
```

## 📦 Build & Deploy

### Build Otimizado

```bash
# Análise de bundle
npm run build
# Output:
# ✓ Route (app)                                Size     First Load JS
# ✓ ○ /                                        142 B          87.4 kB
# ✓ ○ /blog                                    8.2 kB         95.6 kB
```

### Deploy (Vercel/Docker)

```dockerfile
# Dockerfile otimizado
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --production
CMD ["npm", "start"]
```

## 🚀 Próximos Passos

- [ ] Implementar features restantes (Blog, AI Chat, Calculadoras)
- [ ] Adicionar testes (Vitest + Testing Library)
- [ ] Setup de CI/CD (GitHub Actions)
- [ ] Monitoramento de erros (Sentry)
- [ ] Analytics (Vercel Analytics ou Google Analytics)
- [ ] PWA support
- [ ] Internacionalização (i18n)

## 📚 Referências

- [Next.js Best Practices](https://nextjs.org/docs/app/building-your-application)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [shadcn/ui Philosophy](https://ui.shadcn.com/docs)
- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/typescript)
