import React, { useState } from 'react';
import { Calendar, User, Clock, Search, Tag } from 'lucide-react';

const BlogPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'Todas' },
    { id: 'trabalhista', name: 'Direito Trabalhista' },
    { id: 'previdenciario', name: 'Direito Previdenciário' },
    { id: 'civil', name: 'Direito Civil' },
    { id: 'penal', name: 'Direito Penal' },
    { id: 'tributario', name: 'Direito Tributário' }
  ];

  const blogPosts = [
    {
      id: 1,
      title: 'Nova Lei Trabalhista: Principais Mudanças para 2024',
      excerpt: 'Entenda as principais alterações na legislação trabalhista que entram em vigor este ano e como elas afetam empregadores e empregados.',
      author: 'Dr. João Silva',
      date: '2024-01-15',
      readTime: '5 min',
      category: 'trabalhista',
      image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop',
      tags: ['Lei', 'Trabalhista', '2024']
    },
    {
      id: 2,
      title: 'Reforma da Previdência: Guia Completo para Advogados',
      excerpt: 'Um guia detalhado sobre as mudanças na previdência social e como orientar seus clientes sobre os novos requisitos para aposentadoria.',
      author: 'Dra. Maria Santos',
      date: '2024-01-12',
      readTime: '8 min',
      category: 'previdenciario',
      image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=250&fit=crop',
      tags: ['Previdência', 'Aposentadoria', 'Reforma']
    },
    {
      id: 3,
      title: 'Inteligência Artificial no Direito: Oportunidades e Desafios',
      excerpt: 'Como a IA está transformando a prática jurídica e quais são as principais ferramentas disponíveis para advogados modernos.',
      author: 'Dr. Carlos Oliveira',
      date: '2024-01-10',
      readTime: '6 min',
      category: 'civil',
      image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop',
      tags: ['IA', 'Tecnologia', 'Inovação']
    },
    {
      id: 4,
      title: 'Cálculo de Rescisão: Passo a Passo Atualizado',
      excerpt: 'Tutorial completo sobre como calcular rescisões trabalhistas considerando todas as verbas e atualizações legais recentes.',
      author: 'Dra. Ana Costa',
      date: '2024-01-08',
      readTime: '10 min',
      category: 'trabalhista',
      image: 'https://images.unsplash.com/photo-1554224154-26032fced8bd?w=400&h=250&fit=crop',
      tags: ['Rescisão', 'Cálculo', 'Trabalhista']
    },
    {
      id: 5,
      title: 'Marco Civil da Internet: Atualizações e Implicações',
      excerpt: 'As recentes mudanças no Marco Civil da Internet e seus impactos na proteção de dados e privacidade digital.',
      author: 'Dr. Pedro Almeida',
      date: '2024-01-05',
      readTime: '7 min',
      category: 'civil',
      image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=250&fit=crop',
      tags: ['Internet', 'Privacidade', 'LGPD']
    },
    {
      id: 6,
      title: 'Tributação de Criptomoedas: Guia para Advogados',
      excerpt: 'Entenda as regras tributárias para criptomoedas no Brasil e como orientar clientes sobre declaração e pagamento de impostos.',
      author: 'Dra. Lucia Ferreira',
      date: '2024-01-03',
      readTime: '9 min',
      category: 'tributario',
      image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=250&fit=crop',
      tags: ['Criptomoedas', 'Tributação', 'Bitcoin']
    }
  ];

  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredPost = blogPosts[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-navy-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Blog Jurídico
            </h1>
            <p className="text-xl text-navy-100 max-w-2xl mx-auto">
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
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
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="w-full h-48 md:h-full object-cover"
                />
              </div>
              <div className="md:w-2/3 p-6">
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(featuredPost.date).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {featuredPost.readTime}
                  </span>
                  <span className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    {featuredPost.author}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {featuredPost.title}
                </h3>
                <p className="text-gray-600 mb-4">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    {featuredPost.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-navy-100 text-navy-800"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="btn-primary">
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
            Todos os Artigos ({filteredPosts.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map(post => (
              <article key={post.id} className="card hover:shadow-lg transition-shadow duration-300">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-48 object-cover rounded-t-lg -mt-6 -mx-6 mb-4"
                />
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(post.date).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {post.readTime}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    {post.author}
                  </span>
                  <button className="text-navy-700 hover:text-navy-800 font-medium text-sm">
                    Ler mais
                  </button>
                </div>
                <div className="flex space-x-2 mt-3">
                  {post.tags.slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-16">
          <div className="bg-navy-800 rounded-2xl p-8 text-center text-white">
            <h3 className="text-2xl font-bold mb-4">
              Receba as últimas notícias jurídicas
            </h3>
            <p className="text-navy-100 mb-6 max-w-2xl mx-auto">
              Assine nossa newsletter e seja o primeiro a saber sobre mudanças 
              na legislação, novos precedentes e análises jurídicas relevantes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Seu e-mail"
                className="flex-1 px-4 py-2 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gold-300"
              />
              <button className="bg-white text-navy-800 hover:bg-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors duration-200">
                Assinar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPage;