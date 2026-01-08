import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { BlogList } from '@/features/blog/components/blog-list'
import { postService } from '@/features/blog/services/post-service'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog Jurídico - Processa AI',
  description:
    'Mantenha-se atualizado com as últimas notícias, análises e insights do mundo jurídico brasileiro.',
}

// Revalidate every 5 minutes (SSR with ISR)
export const revalidate = 300

async function getBlogPosts() {
  try {
    const posts = await postService.getPosts({ published: true })
    return posts
  } catch (error) {
    console.error('Error fetching posts:', error)
    return []
  }
}

export default async function BlogPage() {
  const posts = await getBlogPosts()

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <Header />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-gray-100 to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 mt-8">
              Blog Jurídico
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed">
              Mantenha-se atualizado com as últimas notícias, análises e insights do mundo
              jurídico brasileiro.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <BlogList initialPosts={posts} />

        {/* Newsletter */}
        <div className="mt-20">
          <div className="bg-gray-900 rounded-[2.5rem] p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
            {/* Background Effects */}
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gray-800/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gray-800/30 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-6 tracking-tight">
                Receba as últimas notícias jurídicas
              </h3>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed font-light">
                Assine nossa newsletter e seja o primeiro a saber sobre mudanças na legislação,
                novos precedentes e análises jurídicas relevantes.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 max-w-1.5xl mx-auto">
                <input
                  type="email"
                  placeholder="Seu melhor e-mail"
                  className="flex-[2] px-6 py-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/20 transition-all"
                />
                <button className="bg-white text-gray-900 hover:bg-gray-50 font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg flex items-center justify-center gap-2 whitespace-nowrap">
                  Inscrever-se
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
