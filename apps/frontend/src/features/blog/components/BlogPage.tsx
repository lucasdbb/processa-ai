import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, User, Clock, Search, Tag, Newspaper } from 'lucide-react';
import type { BlogCategory, BlogCategoryId } from '../types/blog';
import { useSearchParams } from 'react-router-dom';
import PostViewModal from './PostViewModal';

const BlogPage: React.FC = React.memo(() => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<BlogCategoryId>('all');
  const [posts, setPosts] = useState<Array<{ id: string; title: string; slug: string; excerpt?: string; cover_image_url?: string; category?: { id: string; name: string; slug: string }; author: { id: string; name?: string }; published_at?: string }>>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePost, setActivePost] = useState<{ id: string; title: string; slug: string; excerpt?: string; content: string; cover_image_url?: string; category?: { id: string; name: string; slug: string }; published_at?: string; authors: Array<{ id: string; name?: string }> } | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterError, setNewsletterError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const categories: BlogCategory[] = [
    { id: 'all', name: 'Todas' },
    { id: 'direito-trabalho', name: 'Direito do Trabalho' },
    { id: 'previdenciario', name: 'Previdenciário' },
    { id: 'calculos', name: 'Cálculos' },
    { id: 'jurisprudencia', name: 'Jurisprudência' },
    { id: 'legislacao', name: 'Legislação' }
  ];

  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    setPostsError('');
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('page_size', '12');
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (selectedCategory !== 'all') params.set('category_slug', selectedCategory);
      const res = await fetch(`/api/blog/posts?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao carregar artigos');
      const json = await res.json();
      setPosts(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setPostsError('Erro ao carregar artigos.');
      setPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [searchTerm, selectedCategory]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value as BlogCategoryId);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const estimateReadTime = (text?: string) => {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200) || 3);
    return `${minutes} min`;
  };

  const featuredPost = posts[0];

  const openPost = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao carregar artigo');
      const json = await res.json();
      setActivePost(json);
      setIsModalOpen(true);
    } catch (e) {
      setActivePost(null);
      setIsModalOpen(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setActivePost(null);
  }, []);


  useEffect(() => {
    const token = searchParams.get('newsletter_token');
    if (!token) return;
    const confirm = async () => {
      try {
        setNewsletterStatus('loading');
        const res = await fetch(`/api/newsletter/confirm?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Falha ao confirmar assinatura');
        setNewsletterStatus('success');
      } catch {
        setNewsletterError('Não foi possível confirmar sua assinatura.');
        setNewsletterStatus('error');
      } finally {
        searchParams.delete('newsletter_token');
        setSearchParams(searchParams, { replace: true });
      }
    };
    confirm();
  }, [searchParams, setSearchParams]);

  const handleSubscribe = useCallback(async () => {
    setNewsletterError('');
    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      setNewsletterError('Informe um e-mail válido.');
      return;
    }
    setNewsletterStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: newsletterEmail, consent: true }),
      });
      if (!res.ok) throw new Error('Falha ao assinar');
      setNewsletterStatus('success');
      setNewsletterEmail('');
    } catch {
      setNewsletterStatus('error');
      setNewsletterError('Erro ao enviar. Tente novamente.');
    }
  }, [newsletterEmail]);

  return (
    <div className="min-h-screen bg-warm-bg">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-900 text-white h-[260px] md:h-[300px] flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-6">
              <Newspaper className="h-7 w-7" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Blog Jurídico
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              Mantenha-se atualizado com as últimas notícias, análises e
              insights do mundo jurídico brasileiro.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Busca e Filtros */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar artigos..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="input-field pl-10"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="input-field md:w-64"
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Post em Destaque */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Artigo em Destaque</h2>
          <div className="card overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/3">
                <img
                  src={featuredPost?.cover_image_url || 'https://images.unsplash.com/photo-1554224154-26032fced8bd?w=400&h=250&fit=crop'}
                  alt={`Imagem ilustrativa do artigo: ${featuredPost?.title || ''}`}
                  className="w-full h-48 md:h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="md:w-2/3 p-6 flex flex-col">
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" aria-hidden="true" />
                    {featuredPost?.published_at ? new Date(featuredPost.published_at).toLocaleDateString('pt-BR') : ''}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" aria-hidden="true" />
                    {estimateReadTime(featuredPost?.excerpt)}
                  </span>
                  <span className="flex items-center">
                    <User className="h-4 w-4 mr-1" aria-hidden="true" />
                    {featuredPost?.author?.name || ''}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {featuredPost?.title || ''}
                </h3>
                <p className="text-gray-600 mb-4 flex-grow">
                  {featuredPost?.excerpt || ''}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex space-x-2">
                    {featuredPost?.category && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        <Tag className="h-3 w-3 mr-1" aria-hidden="true" />
                        {featuredPost.category.name}
                      </span>
                    )}
                  </div>
                  <button className="btn-primary" onClick={() => featuredPost && openPost(featuredPost.slug)}>
                    Ler Artigo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Posts */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Todos os Artigos ({posts.length})
          </h2>
          {isLoadingPosts && (
            <div className="text-gray-600 mb-6">Carregando artigos...</div>
          )}
          {!!postsError && (
            <div className="text-red-600 mb-6">{postsError}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <article key={post.id} className="card hover:shadow-lg transition-shadow duration-300">
                <img
                  src={post.cover_image_url || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop'}
                  alt={`Imagem ilustrativa do artigo: ${post.title}`}
                  className="w-full h-48 object-cover rounded-t-lg -mt-6 -mx-6 mb-4"
                  loading="lazy"
                />
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" aria-hidden="true" />
                    {post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR') : ''}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" aria-hidden="true" />
                    {estimateReadTime(post.excerpt)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 hover:text-primary-700 transition-colors">
                  {post.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-sm text-gray-600">
                    <User className="h-4 w-4 mr-1" aria-hidden="true" />
                    {post.author?.name || ''}
                  </span>
                  <button className="text-primary-700 hover:text-primary-800 font-medium text-sm" onClick={() => openPost(post.slug)}>
                    Ler mais
                  </button>
                </div>
                <div className="flex space-x-2 mt-3"></div>
              </article>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-16">
          <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-2xl p-8 text-center text-white shadow-xl">
            <h3 className="text-2xl font-bold mb-4">
              Receba as últimas notícias jurídicas
            </h3>
            <p className="text-primary-100 mb-6 max-w-2xl mx-auto">
              Assine nossa newsletter e seja o primeiro a saber sobre mudanças
              na legislação, novos precedentes e análises jurídicas relevantes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Seu e-mail"
                className="flex-1 px-4 py-2 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-secondary-300"
              />
              <button
                onClick={handleSubscribe}
                disabled={newsletterStatus === 'loading'}
                className="bg-white text-primary-800 hover:bg-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                {newsletterStatus === 'loading' && (
                  <span className="inline-block h-4 w-4 border-b-2 border-primary-800 rounded-full animate-spin" />
                )}
                Assinar
              </button>
            </div>
            {newsletterStatus === 'success' && (
              <p className="mt-3 text-sm text-secondary-200">Assinatura enviada. Verifique seu e‑mail para confirmar.</p>
            )}
            {newsletterStatus === 'error' && (
              <p className="mt-3 text-sm text-red-200">{newsletterError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Post View Modal */}
      <PostViewModal
        isOpen={isModalOpen}
        onClose={closeModal}
        post={activePost}
        categoryName={activePost?.category?.name}
      />
    </div>
  );
});

BlogPage.displayName = 'BlogPage';

export default BlogPage;
