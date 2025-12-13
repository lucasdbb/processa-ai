import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Newspaper } from 'lucide-react'

export default function BlogLoading() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero Skeleton */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-8">
            <Newspaper className="h-8 w-8 text-gray-900" />
          </div>
          <div className="h-12 bg-gray-200 rounded-xl w-96 mx-auto mb-4 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded-lg w-[500px] mx-auto animate-pulse" />
        </section>

        {/* Search and Filters Skeleton */}
        <div className="mb-12">
          <div className="h-16 bg-white rounded-2xl shadow-lg border border-gray-100 max-w-4xl mx-auto animate-pulse" />
        </div>

        {/* Featured Post Skeleton */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gray-200" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-200 overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/2 bg-gray-200 h-64 md:h-96 animate-pulse" />
              <div className="md:w-1/2 p-8 md:p-12 space-y-4">
                <div className="flex gap-4">
                  <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-10 bg-gray-200 rounded-lg w-3/4 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Grid Skeleton */}
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden">
              <div className="h-56 bg-gray-200 animate-pulse" />
              <div className="p-8 space-y-4">
                <div className="flex gap-4">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-6 bg-gray-200 rounded animate-pulse" />
                  <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
