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
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

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
        {/* Botão Voltar - Fixo no topo */}
        <div className="sticky top-20 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 mb-8">
          <div className="mx-auto max-w-4xl px-6 lg:px-8 py-4">
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
        </div>

        <article className="mx-auto max-w-4xl px-6 lg:px-8">
          {/* Cabeçalho do Post */}
          <header className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Badge className="text-xs font-bold px-3 py-1">
                {post.category}
              </Badge>
              {post.published_at && (
                <span className="text-sm text-gray-500">
                  Publicado em {formatDate(post.published_at || post.created_at)}
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                {post.excerpt}
              </p>
            )}

            {/* Metadados do Autor */}
            <div className="flex items-center justify-between py-6 border-y border-gray-200">
              <div className="flex items-center gap-4">
                {post.author && (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold border-2 border-gray-300">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{post.author.name}</p>
                      <p className="text-sm text-gray-500">Autor</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Clock className="h-4 w-4" />
                <span className="text-sm">{estimateReadTime(post.content)}</span>
              </div>
            </div>
          </header>

          {/* Imagem em Destaque */}
          {(post.cover_image_url || post.featured_image) && (
            <div className="mb-12 aspect-video w-full overflow-hidden rounded-2xl shadow-xl">
              <img
                src={post.cover_image_url || post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Conteúdo em Markdown */}
          <div className="font-sans prose prose-lg prose-gray max-w-none mb-12
            prose-headings:font-bold prose-headings:text-gray-900
            prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-12
            prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-10
            prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-8
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-6
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-gray-900 prose-strong:font-bold
            prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6
            prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6
            prose-li:text-gray-700 prose-li:mb-2
            prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-gray-600
            prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:text-gray-900
            prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-6 prose-pre:rounded-xl prose-pre:overflow-x-auto
            prose-img:rounded-xl prose-img:shadow-lg
            prose-hr:border-gray-300 prose-hr:my-8
            bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
                Tags Relacionadas
              </h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="px-3 py-1 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

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
