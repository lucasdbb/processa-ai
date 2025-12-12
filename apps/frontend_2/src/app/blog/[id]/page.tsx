import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Calendar, User, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { postService } from '@/features/blog/services/post-service'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

// Revalidate every 5 minutes (ISR)
export const revalidate = 300

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  try {
    const post = await postService.getPost(params.id)
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

export default async function BlogPostPage({ params }: { params: { id: string } }) {
  let post

  try {
    post = await postService.getPost(params.id)
  } catch (error) {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <article className="mx-auto max-w-4xl px-6 lg:px-8 py-12">
          <Link href="/blog">
            <Button variant="ghost" className="mb-8">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o blog
            </Button>
          </Link>

          <div className="mb-8">
            <Badge className="mb-4">{post.category}</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-4">
              {post.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {post.author && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{post.author.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(post.published_at || post.created_at)}</span>
              </div>
            </div>
          </div>

          {post.featured_image && (
            <div className="mb-8 aspect-video w-full overflow-hidden rounded-lg">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {post.tags && post.tags.length > 0 && (
            <div className="mt-8 pt-8 border-t">
              <h3 className="text-sm font-semibold mb-2">Tags:</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>

      <Footer />
    </div>
  )
}
