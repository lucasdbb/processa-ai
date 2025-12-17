import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { User, ArrowLeft, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { postService } from '@/features/blog/services/post-service'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'

// Revalidate every 5 minutes (ISR)
export const revalidate = 300

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  try {
    const { id } = await params
    const post = await postService.getPost(id)
    return {
      title: `${post.title} - Processa AI`,
      description: post.excerpt || post.title,
      openGraph: {
        title: post.title,
        description: post.excerpt || post.title,
        images: post.cover_image_url || post.featured_image ? [post.cover_image_url || post.featured_image!] : [],
        type: 'article',
        publishedTime: post.published_at || post.created_at,
        authors: post.author?.name ? [post.author.name] : [],
      },
    }
  } catch {
    return {
      title: 'Post não encontrado - Processa AI',
    }
  }
}

// Pre-generate static pages for the first 20 posts (optional)
export async function generateStaticParams() {
  try {
    const posts = await postService.getPosts({ published: true, limit: 20 })
    return posts.map((post) => ({
      id: post.id,
    }))
  } catch {
    return []
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  let post

  try {
    const { id } = await params
    post = await postService.getPost(id)
  } catch (error) {
    notFound()
  }

  const estimateReadTime = (text?: string) => {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.round(words / 200) || 5)
    return `${minutes} min de leitura`
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <Header />

      <main className="flex-1 pt-24 pb-16 font-sans">
        <article className="mx-auto max-w-6xl px-6 lg:px-8">
          {/* Botão Voltar */}
          <div className="mb-8">
            <Link href="/blog">
              <Button
                variant="ghost"
                className="hover:bg-white hover:shadow-sm transition-all"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o blog
              </Button>
            </Link>
          </div>
          {/* Layout com Imagem */}
          {(post.cover_image_url || post.featured_image) && (
            <>
              {/* Flex container: Imagem (80%) + Sidebar (20%) */}
              <div className="flex flex-col lg:flex-row gap-6 mb-8 pb-8 border-b border-gray-200">
                {/* Imagem com Overlay - 80% */}
                <div className="lg:w-[80%]">
                  <div className="relative w-full overflow-hidden rounded-2xl shadow-lg">
                    <img
                      src={post.cover_image_url || post.featured_image}
                      alt={post.title}
                      className="w-full h-auto max-h-[500px] object-cover"
                    />

                    {/* Overlay com Título e Metadados */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 md:p-8">
                      {/* Categoria */}
                      {post.category && (
                        <div className="mb-3">
                          <Badge className="text-xs font-bold px-3 py-1 bg-white text-gray-900">
                            {post.category}
                          </Badge>
                        </div>
                      )}

                      {/* Título */}
                      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
                        {post.title}
                      </h1>

                      {/* Metadados */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-white/90">
                        {post.published_at && (
                          <span>{formatDate(post.published_at || post.created_at)}</span>
                        )}
                        {post.published_at && (
                          <span className="text-white/60">•</span>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{estimateReadTime(post.content)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar: Resumo, Tags e Autor - 20% */}
                <div className="lg:w-[20%] flex flex-col gap-6">
                  {/* Resumo */}
                  {post.excerpt && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                        Resumo
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {post.excerpt}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="px-2 py-1 text-xs hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Autor */}
                  {post.authors && post.authors.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                        Autor
                      </h3>
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{post.authors[0].name}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Cabeçalho do Post (sem imagem) */}
          {!(post.cover_image_url || post.featured_image) && (
            <>
              <header className="mb-10">
                {/* Categoria */}
                {post.category && (
                  <div className="mb-4">
                    <Badge className="text-xs font-bold px-3 py-1">
                      {post.category}
                    </Badge>
                  </div>
                )}

                {/* Título */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 mb-4 leading-tight">
                  {post.title}
                </h1>

                {/* Metadados */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  {post.published_at && (
                    <span>{formatDate(post.published_at || post.created_at)}</span>
                  )}
                  {post.published_at && (
                    <span className="text-gray-300">•</span>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{estimateReadTime(post.content)}</span>
                  </div>
                </div>
              </header>

              {/* Resumo e Tags */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 pb-8 border-b border-gray-200">
                {post.excerpt && (
                  <div className="lg:col-span-2">
                    <p className="text-lg text-gray-700 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>
                )}

                {post.tags && post.tags.length > 0 && (
                  <div className={post.excerpt ? '' : 'lg:col-span-3'}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Autor após resumo e tags */}
              {post.authors && post.authors.length > 0 && (
                <div className="mb-10 flex items-center gap-2 text-gray-600">
                  <span className="text-sm">Por</span>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-gray-900">{post.authors[0].name}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Conteúdo em Markdown */}
          <div className="mb-12">
            <MarkdownPreview
              source={post.content}
              className="prose prose-lg prose-gray max-w-none"
            />
          </div>

          {/* Botão Voltar - Inferior */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <Link href="/blog">
              <Button
                variant="outline"
                className="w-full md:w-auto hover:bg-gray-100 transition-all"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o blog
              </Button>
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}
