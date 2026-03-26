import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, Search, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

interface Post {
  id: string
  slug: string
  title: string
  content?: string
  excerpt?: string
  cover_image_url?: string
  featured_image?: string
  published_at?: string
  created_at?: string
  category?: string
  tags?: string[]
  author?: {
    id?: string
    name?: string
    avatar_url?: string
  }
}

type BlogCategory = {
  id: string
  name: string
}

type BlogCachePayload = {
  cachedAt: number
  posts: Post[]
}

const BLOG_CACHE_KEY = 'processa_blog_posts_cache_v1'
const BLOG_CACHE_MAX_AGE_MS = 5 * 60 * 1000

const categories: BlogCategory[] = [
  { id: 'all', name: 'Todas' },
  { id: 'direito-trabalho', name: 'Direito do Trabalho' },
  { id: 'previdenciario', name: 'Previdenciário' },
  { id: 'calculos', name: 'Cálculos' },
  { id: 'jurisprudencia', name: 'Jurisprudência' },
  { id: 'legislacao', name: 'Legislação' },
]

function normalizePosts(payload: unknown): Post[] {
  if (Array.isArray(payload)) return payload as Post[]
  if (!payload || typeof payload !== 'object') return []

  const value = payload as Record<string, unknown>
  const candidates = [value.items, value.posts, value.data]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Post[]
  }

  return []
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    const loadPosts = async () => {
      let hasValidCache = false

      try {
        const cachedRaw = window.sessionStorage.getItem(BLOG_CACHE_KEY)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as BlogCachePayload
          const isFresh =
            Number.isFinite(cached.cachedAt) &&
            Date.now() - cached.cachedAt <= BLOG_CACHE_MAX_AGE_MS
          if (isFresh && Array.isArray(cached.posts)) {
            setPosts(cached.posts)
            setIsLoading(false)
            hasValidCache = true
          }
        }
      } catch {
        // Ignore cache parse errors and continue with network request.
      }

      try {
        const response = await fetchWithCredentials(`${API_URL}/blog/posts?published=true`)
        if (!response.ok) {
          if (!hasValidCache) {
            setPosts([])
          }
          return
        }

        const payload: unknown = await response.json()
        const nextPosts = normalizePosts(payload)
        setPosts(nextPosts)

        try {
          const cachePayload: BlogCachePayload = {
            cachedAt: Date.now(),
            posts: nextPosts,
          }
          window.sessionStorage.setItem(BLOG_CACHE_KEY, JSON.stringify(cachePayload))
        } catch {
          // Ignore cache write errors.
        }
      } catch (error) {
        console.error('Error loading posts:', error)
        if (!hasValidCache) {
          setPosts([])
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadPosts()
  }, [])

  const estimateReadTime = (text?: string) => {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.round(words / 200) || 3)
    return `${minutes} min`
  }

  const filteredPosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return posts.filter((post) => {
      const matchesSearch =
        !term ||
        post.title.toLowerCase().includes(term) ||
        post.excerpt?.toLowerCase().includes(term)
      const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [posts, searchTerm, selectedCategory])

  const featuredPost = filteredPosts[0]
  const regularPosts = filteredPosts.slice(1)

  if (isLoading) {
    return (
      <div className="pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-10 bg-muted rounded w-1/3" />
            <div className="h-6 bg-muted rounded w-2/3" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-4">
                  <div className="h-48 bg-muted rounded-xl" />
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-3 sm:mb-4">
              Fique um passo à frente da legislação.
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              Análises diretas ao ponto sobre o que muda no direito brasileiro e como isso afeta seus casos.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <div className="mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 p-2 sm:p-3 bg-[hsl(var(--blog-surface)/var(--blog-surface-alpha))] rounded-xl sm:rounded-2xl shadow-lg border border-border max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 sm:h-5 w-4 sm:w-5" />
              <input
                type="text"
                placeholder="Buscar artigos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm sm:text-base text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="w-px bg-border hidden sm:block" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="sm:w-64 px-3 sm:px-4 py-2.5 sm:py-3 bg-transparent border border-border sm:border-none outline-none focus:outline-none focus:ring-0 text-sm sm:text-base text-foreground cursor-pointer hover:bg-muted/50 rounded-lg sm:rounded-xl transition-colors"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id} className="bg-popover text-popover-foreground">
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {featuredPost && (
          <div className="mb-12 sm:mb-16">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="h-px flex-1 bg-border" />
              <h2 className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Destaque
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="group relative bg-[hsl(var(--blog-surface)/var(--blog-surface-alpha))] rounded-2xl sm:rounded-3xl shadow-xl border border-border overflow-hidden hover:shadow-2xl transition-all duration-500">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-background/10 group-hover:bg-background/0 transition-colors z-10" />
                  <div className="relative w-full h-48 sm:h-56 md:h-full">
                    <img
                      src={
                        featuredPost.cover_image_url ||
                        featuredPost.featured_image ||
                        'https://images.unsplash.com/photo-1554224154-26032fced8bd?w=800&h=500&fit=crop'
                      }
                      alt={`Imagem ilustrativa do artigo: ${featuredPost.title}`}
                      className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="md:w-1/2 p-4 sm:p-6 md:p-8 lg:p-12 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                    {featuredPost.category && (
                      <span className="inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-muted text-foreground border border-border">
                        {featuredPost.category}
                      </span>
                    )}
                    {(featuredPost.published_at || featuredPost.created_at) && (
                      <span className="flex items-center">
                        <Calendar className="h-3 sm:h-4 w-3 sm:w-4 mr-1.5" />
                        {formatDate(featuredPost.published_at || featuredPost.created_at!)}
                      </span>
                    )}
                    <span className="flex items-center">
                      <Clock className="h-3 sm:h-4 w-3 sm:w-4 mr-1.5" />
                      {estimateReadTime(featuredPost.excerpt || featuredPost.content)}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2 sm:mb-4 leading-tight group-hover:text-muted-foreground transition-colors">
                    {featuredPost.title}
                  </h3>

                  {featuredPost.excerpt && (
                    <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-4 sm:mb-8 leading-relaxed">
                      {featuredPost.excerpt}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mt-auto pt-4 sm:pt-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 sm:w-10 h-8 sm:h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-bold border border-border flex-shrink-0">
                        <User className="h-4 sm:h-5 w-4 sm:w-5" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-foreground">
                        {featuredPost.author?.name || 'Equipe Processa AI'}
                      </span>
                    </div>

                    <Link
                      to={`/blog/${featuredPost.slug}`}
                      className="inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 bg-slate-900 text-white rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 transform hover:-translate-y-0.5 whitespace-nowrap"
                    >
                      Ler artigo completo
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Últimas Publicações
            </h2>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="bg-muted border border-border rounded-xl sm:rounded-2xl p-6 sm:p-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground font-medium">
                Nenhum post encontrado. Ajuste seus filtros ou tente novamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {regularPosts.map((post) => (
                <article
                  key={post.id}
                  className="group flex flex-col bg-[hsl(var(--blog-surface)/var(--blog-surface-alpha))] rounded-2xl sm:rounded-3xl border border-border overflow-hidden hover:shadow-xl hover:border-muted-foreground/50 hover:scale-[1.02] transition-all duration-300"
                >
                  <div className="relative h-40 sm:h-48 md:h-56 overflow-hidden">
                    <div className="absolute inset-0 bg-background/0 group-hover:bg-background/5 transition-colors z-10" />
                    <img
                      src={
                        post.cover_image_url ||
                        post.featured_image ||
                        'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop'
                      }
                      alt={`Imagem ilustrativa do artigo: ${post.title}`}
                      className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                      loading="lazy"
                    />
                    {post.category && (
                      <span className="absolute top-2 sm:top-4 left-2 sm:left-4 z-20 inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-background/90 backdrop-blur-sm text-foreground shadow-sm">
                        {post.category}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 p-4 sm:p-5 md:p-6 flex flex-col">
                    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-4">
                      {(post.published_at || post.created_at) && (
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(post.published_at || post.created_at!)}
                        </span>
                      )}
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {estimateReadTime(post.excerpt || post.content)}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3 group-hover:text-muted-foreground transition-colors line-clamp-2">
                      {post.title}
                    </h3>

                    {post.excerpt && (
                      <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-6 line-clamp-3 leading-relaxed flex-grow">
                        {post.excerpt}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-3 sm:pt-4 md:pt-6 border-t border-border gap-2 sm:gap-0">
                      <span className="flex items-center text-[10px] sm:text-xs font-medium text-foreground min-w-0">
                        <div className="w-5 sm:w-6 h-5 sm:h-6 bg-muted rounded-full flex items-center justify-center mr-1.5 sm:mr-2 border border-border flex-shrink-0">
                          <User className="h-2.5 sm:h-3 w-2.5 sm:w-3 text-muted-foreground" />
                        </div>
                        <span className="truncate">{post.author?.name || 'Equipe'}</span>
                      </span>

                      <Link
                        to={`/blog/${post.slug}`}
                        className="text-xs sm:text-sm font-bold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                      >
                        Continuar lendo
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 sm:mt-16 md:mt-20">
          <div className="bg-[hsl(var(--card)/var(--newsletter-card-alpha))] border border-border rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] p-6 sm:p-8 md:p-10 lg:p-12 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-slate-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-slate-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-4 tracking-tight">
                Direito muda todo dia. Não fique para trás.
              </h3>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 leading-relaxed font-light">
                Uma vez por semana, o que importa no direito brasileiro direto no seu e-mail.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-1.5xl mx-auto">
                <input
                  type="email"
                  placeholder="Seu melhor e-mail"
                  className="flex-[2] px-4 sm:px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl bg-background/50 border border-input text-sm sm:text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                />
                <button className="bg-slate-900 text-white hover:bg-slate-800 font-bold py-3 sm:py-4 px-4 sm:px-8 rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg flex items-center justify-center gap-2 whitespace-nowrap text-sm sm:text-base">
                  Quero receber
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
