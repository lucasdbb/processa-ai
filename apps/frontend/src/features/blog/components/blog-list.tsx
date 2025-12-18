'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, User, Clock, Search } from 'lucide-react'
import type { BlogPost } from '../types'

type BlogCategory = {
  id: string
  name: string
}

const categories: BlogCategory[] = [
  { id: 'all', name: 'Todas' },
  { id: 'direito-trabalho', name: 'Direito do Trabalho' },
  { id: 'previdenciario', name: 'Previdenciário' },
  { id: 'calculos', name: 'Cálculos' },
  { id: 'jurisprudencia', name: 'Jurisprudência' },
  { id: 'legislacao', name: 'Legislação' },
]

interface BlogListProps {
  initialPosts: BlogPost[]
}

export function BlogList({ initialPosts }: BlogListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const estimateReadTime = (text?: string) => {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.round(words / 200) || 3)
    return `${minutes} min`
  }

  const filteredPosts = initialPosts.filter((post) => {
    const matchesSearch =
      !searchTerm ||
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const featuredPost = filteredPosts[0]
  const regularPosts = filteredPosts.slice(1)

  return (
    <>
      {/* Busca e Filtros */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row gap-4 p-2 bg-white rounded-2xl shadow-lg border border-gray-100 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar artigos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 text-base"
            />
          </div>
          <div className="w-px bg-gray-200 hidden md:block" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="md:w-64 px-4 py-3 bg-transparent border-none focus:ring-0 text-gray-900 text-base cursor-pointer hover:bg-gray-50 rounded-xl transition-colors"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Post em Destaque */}
      {featuredPost && (
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gray-200" />
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Destaque</h2>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="group relative bg-white rounded-[2rem] shadow-xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-500">
            <div className="md:flex">
              <div className="md:w-1/2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gray-900/10 group-hover:bg-gray-900/0 transition-colors z-10" />
                <div className="relative w-full h-64 md:h-full">
                  <Image
                    src={
                      featuredPost.cover_image_url ||
                      featuredPost.featured_image ||
                      'https://images.unsplash.com/photo-1554224154-26032fced8bd?w=800&h=500&fit=crop'
                    }
                    alt={`Imagem ilustrativa do artigo: ${featuredPost.title}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transform group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6">
                  {featuredPost.category && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-900 border border-gray-200">
                      {featuredPost.category}
                    </span>
                  )}
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1.5" />
                    {new Date(featuredPost.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1.5" />
                    {estimateReadTime(featuredPost.excerpt)}
                  </span>
                </div>

                <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight group-hover:text-gray-700 transition-colors">
                  {featuredPost.title}
                </h3>

                <p className="text-lg text-gray-500 mb-8 leading-relaxed">{featuredPost.excerpt}</p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold border border-gray-200">
                      <User className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {featuredPost.author?.name || 'Equipe Processa AI'}
                    </span>
                  </div>

                  <Link
                    href={`/blog/${featuredPost.slug}`}
                    className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/20 transform hover:-translate-y-0.5"
                  >
                    Ler Artigo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Posts */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Últimas Publicações{' '}
            <span className="text-gray-400 font-normal ml-2 text-lg">
              ({filteredPosts.length})
            </span>
          </h2>
        </div>

        {filteredPosts.length === 0 && (
          <div className="bg-gray-100 border border-gray-200 rounded-2xl p-12 text-center">
            <p className="text-gray-600 font-medium">
              Nenhum post encontrado. Ajuste seus filtros ou tente novamente.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {regularPosts.map((post) => (
            <article
              key={post.id}
              className="group flex flex-col bg-white rounded-[2rem] border border-gray-200 overflow-hidden hover:shadow-xl hover:border-gray-300 hover:scale-[1.02] transition-all duration-300"
            >
              <div className="relative h-56 overflow-hidden">
                <div className="absolute inset-0 bg-gray-900/0 group-hover:bg-gray-900/5 transition-colors z-10" />
                <Image
                  src={
                    post.cover_image_url ||
                    post.featured_image ||
                    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop'
                  }
                  alt={`Imagem ilustrativa do artigo: ${post.title}`}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover transform group-hover:scale-110 transition-transform duration-700"
                  loading="lazy"
                />
                {post.category && (
                  <span className="absolute top-4 left-4 z-20 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-sm text-gray-900 shadow-sm">
                    {post.category}
                  </span>
                )}
              </div>

              <div className="flex-1 p-8 flex flex-col">
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                  <span className="flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    {new Date(post.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    {estimateReadTime(post.excerpt)}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-gray-600 transition-colors line-clamp-2">
                  {post.title}
                </h3>

                <p className="text-gray-500 text-sm mb-6 line-clamp-3 leading-relaxed flex-grow">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                  <span className="flex items-center text-xs font-medium text-gray-900">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mr-2 border border-gray-200">
                      <User className="h-3 w-3 text-gray-500" />
                    </div>
                    {post.author?.name || 'Equipe'}
                  </span>

                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-sm font-bold text-gray-900 hover:text-gray-600 transition-colors"
                  >
                    Ler mais
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
