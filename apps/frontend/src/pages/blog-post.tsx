import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { Button } from '@/components/ui/button'
import MarkdownPreview from '@uiw/react-markdown-preview'
import '@uiw/react-markdown-preview/markdown.css'
import { useTheme } from 'next-themes'

interface Post {
  id: string
  slug: string
  title: string
  content: string
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
  authors?: Array<{
    id?: string
    name?: string
  }>
}

function normalizePost(payload: unknown): Post | null {
  if (!payload || typeof payload !== 'object') return null
  const value = payload as Record<string, unknown>
  if (typeof value.title !== 'string') return null
  if (typeof value.content !== 'string') return null
  if (typeof value.id !== 'string') return null
  if (typeof value.slug !== 'string') return null
  return value as unknown as Post
}

export default function BlogPostPage() {
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const loadPost = async () => {
      try {
        const response = await fetchWithCredentials(`${API_URL}/blog/posts/${id}`)
        if (!response.ok) {
          setPost(null)
          return
        }
        const payload: unknown = await response.json()
        setPost(normalizePost(payload))
      } catch (error) {
        console.error('Error loading post:', error)
        setPost(null)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) loadPost()
  }, [id])

  const estimateReadTime = (text?: string) => {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.round(words / 200) || 5)
    return `${minutes} min de leitura`
  }

  const dataColorMode = resolvedTheme === 'dark' ? 'dark' : 'light'

  if (isLoading) {
    return (
      <div className="pt-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-10 bg-muted rounded w-1/4" />
            <div className="h-12 bg-muted rounded w-3/4" />
            <div className="h-64 bg-muted rounded-2xl" />
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 text-center">
          <h1 className="text-2xl font-bold text-foreground">Artigo não encontrado</h1>
          <Link to="/blog" className="mt-4 inline-flex items-center text-primary hover:underline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao blog
          </Link>
        </div>
      </div>
    )
  }

  const dateValue = post.published_at || post.created_at
  const hasCover = Boolean(post.cover_image_url || post.featured_image)
  const authorName = post.author?.name || post.authors?.[0]?.name

  return (
    <main className="pt-24 pb-16 font-sans">
      <article className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            asChild
            className="hover:bg-muted hover:shadow-sm transition-all text-muted-foreground hover:text-foreground"
          >
            <Link to="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o blog
            </Link>
          </Button>
        </div>

        {hasCover ? (
          <div className="flex flex-col lg:flex-row gap-6 mb-8 pb-8 border-b border-border">
            <div className="lg:w-[80%]">
              <div className="relative w-full overflow-hidden rounded-2xl shadow-lg border border-border">
                <img
                  src={post.cover_image_url || post.featured_image || ''}
                  alt={post.title}
                  className="w-full h-auto max-h-[500px] object-cover"
                  loading="lazy"
                />

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 md:p-8">
                  {post.category && (
                    <div className="mb-3">
                      <span className="text-xs font-bold px-3 py-1 bg-background text-foreground border-none rounded-full inline-flex">
                        {post.category}
                      </span>
                    </div>
                  )}

                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight drop-shadow-md">
                    {post.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/90">
                    {dateValue && <span>{formatDate(dateValue)}</span>}
                    {dateValue && <span className="text-white/60">•</span>}
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{estimateReadTime(post.content)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-[20%] flex flex-col gap-6">
              {post.excerpt && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                    Resumo
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{post.excerpt}</p>
                </div>
              )}

              {post.tags && post.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {authorName && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                    Autor
                  </h3>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-foreground" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{authorName}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <header className="mb-10">
              {post.category && (
                <div className="mb-4">
                  <span className="text-xs font-bold px-3 py-1 bg-slate-900 text-white rounded-full inline-flex">
                    {post.category}
                  </span>
                </div>
              )}

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 leading-tight">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {dateValue && <span>{formatDate(dateValue)}</span>}
                {dateValue && <span className="text-muted-foreground/50">•</span>}
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{estimateReadTime(post.content)}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 pb-8 border-b border-border">
              {post.excerpt && (
                <div className="lg:col-span-2">
                  <p className="text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>
                </div>
              )}

              {post.tags && post.tags.length > 0 && (
                <div className={post.excerpt ? '' : 'lg:col-span-3'}>
                  <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1.5 text-sm rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {authorName && (
              <div className="mb-10 flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">Por</span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-foreground" />
                  </div>
                  <span className="font-semibold text-foreground">{authorName}</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mb-12">
          <MarkdownPreview
            source={post.content}
            className="prose prose-lg max-w-none dark:prose-invert !bg-transparent"
            wrapperElement={{ 'data-color-mode': dataColorMode }}
            style={{ backgroundColor: 'transparent' }}
          />
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <Button
            variant="outline"
            asChild
            className="w-full md:w-auto hover:bg-muted transition-all border-border text-muted-foreground hover:text-foreground"
          >
            <Link to="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o blog
            </Link>
          </Button>
        </div>
      </article>
    </main>
  )
}
