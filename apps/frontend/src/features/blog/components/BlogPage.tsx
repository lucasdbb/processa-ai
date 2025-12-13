import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, User, Clock, Search, Newspaper } from 'lucide-react';
import type { BlogCategory, BlogCategoryId } from '../types/blog';
import { useSearchParams } from 'react-router-dom';
import PostViewModal from './PostViewModal';

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || '').trim();

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
      const res = await fetch(`${API_BASE_URL}/api/blog/posts?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao carregar artigos');
      const json = await res.json();
      setPosts(Array.isArray(json.items) ? json.items : []);
    } catch {
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
      const res = await fetch(`${API_BASE_URL}/api/blog/posts/${encodeURIComponent(slug)}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao carregar artigo');
      const json = await res.json();
      setActivePost(json);
      setIsModalOpen(true);
    } catch {
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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-gray-100 to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-8 animate-in fade-in zoom-in duration-500">
              <Newspaper className="h-8 w-8 text-gray-900" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Blog Jurídico
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              Mantenha-se atualizado com as últimas notícias, análises e
              insights do mundo jurídico brasileiro.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        {/* Busca e Filtros */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row gap-4 p-2 bg-white rounded-2xl shadow-lg border border-gray-100 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar artigos..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-12 pr-4 py-3 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 text-base"
              />
            </div>
            <div className="w-px bg-gray-200 hidden md:block" />
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="md:w-64 px-4 py-3 bg-transparent border-none focus:ring-0 text-gray-900 text-base cursor-pointer hover:bg-gray-50 rounded-xl transition-colors"
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
        {featuredPost && !isLoadingPosts && !postsError && (
          <div className="mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gray-200" />
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Destaque</h2>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            
            <div className="group relative bg-white rounded-[2rem] shadow-xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-500">
              <div className="md:flex">
                <div className="md:w-1/2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gray-900/10 group-hover:bg-gray-900/0 transition-colors z-10" />
                  <img
                    src={featuredPost.cover_image_url || 'https://images.unsplash.com/photo-1554224154-26032fced8bd?w=800&h=500&fit=crop'}
                    alt={`Imagem ilustrativa do artigo: ${featuredPost.title}`}
                    className="w-full h-64 md:h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                </div>
                <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6">
                    {featuredPost.category && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-900 border border-gray-200">
                        {featuredPost.category.name}
                      </span>
                    )}
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1.5" />
                      {featuredPost.published_at ? new Date(featuredPost.published_at).toLocaleDateString('pt-BR') : ''}
                    </span>
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1.5" />
                      {estimateReadTime(featuredPost.excerpt)}
                    </span>
                  </div>
                  
                  <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight group-hover:text-gray-700 transition-colors">
                    {featuredPost.title}
                  </h3>
                  
                  <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                    {featuredPost.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold border border-gray-200">
                        <User className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {featuredPost.author?.name || 'Equipe Processa AI'}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => openPost(featuredPost.slug)}
                      className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/20 transform hover:-translate-y-0.5"
                    >
                      Ler Artigo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Posts */}
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Últimas Publicações <span className="text-gray-400 font-normal ml-2 text-lg">({posts.length})</span>
            </h2>
          </div>

          {isLoadingPosts && (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
            </div>
          )}
          
          {!!postsError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
              <p className="text-red-600 font-medium">{postsError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.filter(p => p.id !== featuredPost?.id).map(post => (
              <article 
                key={post.id} 
                className="group flex flex-col bg-white rounded-[2rem] border border-gray-200 overflow-hidden hover:shadow-xl hover:border-gray-300 hover:scale-[1.02] transition-all duration-300"
              >
                <div className="relative h-56 overflow-hidden">
                  <div className="absolute inset-0 bg-gray-900/0 group-hover:bg-gray-900/5 transition-colors z-10" />
                  <img
                    src={post.cover_image_url || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop'}
                    alt={`Imagem ilustrativa do artigo: ${post.title}`}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                  />
                  {post.category && (
                    <span className="absolute top-4 left-4 z-20 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-sm text-gray-900 shadow-sm">
                      {post.category.name}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 p-8 flex flex-col">
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1.5" />
                      {post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR') : ''}
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
                    
                    <button 
                      onClick={() => openPost(post.slug)}
                      className="text-sm font-bold text-gray-900 hover:text-gray-600 transition-colors"
                    >
                      Ler mais
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-24 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-700">
          <div className="bg-gray-900 rounded-[2.5rem] p-8 md:p-16 text-center relative overflow-hidden shadow-2xl">
            {/* Background Effects */}
            <div className="absolute inset-0">
               <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gray-800/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
               <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gray-800/30 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-6 tracking-tight">
                Receba as últimas notícias jurídicas
              </h3>
              <p className="text-lg text-gray-400 mb-10 leading-relaxed font-light">
                Assine nossa newsletter e seja o primeiro a saber sobre mudanças
                na legislação, novos precedentes e análises jurídicas relevantes.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Seu melhor e-mail"
                  className="flex-1 px-6 py-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/20 transition-all"
                />
                <button
                  onClick={handleSubscribe}
                  disabled={newsletterStatus === 'loading'}
                  className="bg-white text-gray-900 hover:bg-gray-50 font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {newsletterStatus === 'loading' && (
                    <span className="inline-block h-4 w-4 border-b-2 border-gray-900 rounded-full animate-spin" />
                  )}
                  Inscrever-se
                </button>
              </div>
              
              {newsletterStatus === 'success' && (
                <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl inline-block">
                  <p className="text-sm text-green-400 font-medium">Assinatura enviada! Verifique seu e‑mail para confirmar.</p>
                </div>
              )}
              {newsletterStatus === 'error' && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl inline-block">
                  <p className="text-sm text-red-400 font-medium">{newsletterError}</p>
                </div>
              )}
            </div>
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
