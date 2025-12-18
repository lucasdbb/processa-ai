import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export default function BlogPostLoading() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Back Button Skeleton */}
        <div className="mb-8">
          <div className="flex items-center gap-2 w-32 h-10 bg-gray-200 rounded-xl animate-pulse" />
        </div>

        {/* Article Skeleton */}
        <article className="bg-white rounded-[2rem] shadow-xl border border-gray-200 overflow-hidden">
          {/* Featured Image Skeleton */}
          <div className="w-full h-96 bg-gray-200 animate-pulse" />

          {/* Content Skeleton */}
          <div className="p-8 md:p-12 space-y-6">
            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 pb-6 border-b border-gray-100">
              <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Title */}
            <div className="space-y-3">
              <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 bg-gray-200 rounded-lg w-3/4 animate-pulse" />
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 bg-gray-200 rounded w-2/3 animate-pulse" />
            </div>

            {/* Content Paragraphs */}
            <div className="pt-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
                </div>
              ))}
            </div>

            {/* Author */}
            <div className="pt-8 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}
