'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  Users,
  Shield,
  Crown,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
  User,
  FileText,
  LayoutDashboard,
  Edit,
  ArrowLeft,
} from 'lucide-react'
import { adminService } from '@/features/blog/services/admin-service'
import type { UserListItem, AdminPostListItem } from '@/features/blog/services/admin-service'
import type { User as AuthUser } from '@/features/auth/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useTheme } from 'next-themes'

interface AdminPanelProps {
  user: AuthUser
}

type Tab = 'overview' | 'users' | 'posts'

export function AdminPanel({ user }: AdminPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const roleFilterValues = ['all', 'user', 'author', 'admin', 'premium'] as const
  type RoleFilter = (typeof roleFilterValues)[number]
  const isRoleFilter = (value: string): value is RoleFilter =>
    (roleFilterValues as readonly string[]).includes(value)

  // Users State
  const [users, setUsers] = useState<UserListItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)

  // Posts State
  const [posts, setPosts] = useState<AdminPostListItem[]>([])
  const [postSearch, setPostSearch] = useState('')
  const [postStatusFilter, setPostStatusFilter] = useState<string>('all')

  const { resolvedTheme } = useTheme()
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const isDark = hasMounted && resolvedTheme === 'dark'

  // Stats State
  const [stats, setStats] = useState({
    total: 0,
    byRole: { user: 0, admin: 0, premium: 0 },
    verified: 0,
    unverified: 0,
    recentSignups: 0,
  })

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    loadData()
  }, [])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'overview' || tab === 'users' || tab === 'posts') {
      setActiveTab(tab as Tab)
    }
  }, [searchParams])

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const usersData = await adminService.listUsers(1, 100)
      setUsers(usersData.users)

      try {
        const postsData = await adminService.listPosts(1, 50, undefined, 'all')
        setPosts(postsData.items)
      } catch (e) {
        console.error('Failed to load posts:', e)
      }

      const usersArr = usersData.users
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      setStats({
        total: usersArr.length,
        byRole: {
          user: usersArr.filter((u) => u.role === 'user').length,
          admin: usersArr.filter((u) => u.role === 'admin').length,
          premium: usersArr.filter((u) => u.role === 'premium').length,
        },
        verified: usersArr.filter((u) => u.email_verified).length,
        unverified: usersArr.filter((u) => !u.email_verified).length,
        recentSignups: usersArr.filter((u) => new Date(u.created_at) > sevenDaysAgo).length,
      })
    } catch (err) {
      console.error('Error loading admin data:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleUpdate = async (
    userId: string,
    newRole: UserListItem['role']
  ) => {
    try {
      setIsUpdatingRole(true)
      await adminService.updateUserRole(userId, newRole)
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      setSelectedUser(null)
      toast.success('Role atualizada com sucesso!')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar role')
    } finally {
      setIsUpdatingRole(false)
    }
  }

  const handlePostAction = async (id: string, action: 'archive' | 'publish' | 'restore') => {
    try {
      if (action === 'publish') {
        await adminService.publishPost(id)
        setPosts(
          posts.map((p) =>
            p.id === id ? { ...p, status: 'published', published_at: new Date().toISOString() } : p
          )
        )
        toast.success('Post publicado com sucesso!')
      } else if (action === 'archive') {
        await adminService.deletePost(id)
        setPosts(posts.map((p) => (p.id === id ? { ...p, status: 'archived' } : p)))
        toast.success('Post arquivado com sucesso!')
      } else if (action === 'restore') {
        await adminService.restorePostToDraft(id)
        setPosts(
          posts.map((p) => (p.id === id ? { ...p, status: 'draft', published_at: undefined } : p))
        )
        toast.success('Post salvo como rascunho!')
      }
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar post')
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      searchQuery === '' ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const filteredPosts = posts.filter((p) => {
    const matchesSearch =
      postSearch === '' || p.title.toLowerCase().includes(postSearch.toLowerCase())
    const matchesStatus = postStatusFilter === 'all' || p.status === postStatusFilter
    return matchesSearch && matchesStatus
  })

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-red-600" />
      case 'author':
        return <User className="w-4 h-4 text-blue-600" />
      case 'premium':
        return <Crown className="w-4 h-4 text-yellow-600" />
      default:
        return <Users className="w-4 h-4 text-gray-600" />
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return isDark
          ? 'bg-red-900/30 text-red-300 border-red-900/50'
          : 'bg-red-100 text-red-800 border-red-200'
      case 'author':
        return isDark
          ? 'bg-blue-900/30 text-blue-300 border-blue-900/50'
          : 'bg-blue-100 text-blue-800 border-blue-200'
      case 'premium':
        return isDark
          ? 'bg-yellow-900/30 text-yellow-300 border-yellow-900/50'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return isDark
          ? 'bg-muted text-muted-foreground border-border'
          : 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return isDark
          ? 'bg-green-900/30 text-green-300 border-green-900/50'
          : 'bg-green-100 text-green-800 border-green-200'
      case 'draft':
        return isDark
          ? 'bg-yellow-900/30 text-yellow-300 border-yellow-900/50'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'archived':
        return isDark
          ? 'bg-muted text-muted-foreground border-border'
          : 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return isDark
          ? 'bg-muted text-muted-foreground border-border'
          : 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  return (
    <div className="min-h-screen bg-muted/40 flex font-sans text-foreground">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border hidden lg:flex flex-col fixed h-full">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-foreground" />
            Admin
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:bg-muted mb-4 border border-border hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Home
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'overview'
                ? 'bg-slate-900 text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'users' ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Users className="w-5 h-5" />
            Usuários
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'posts' ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <FileText className="w-5 h-5" />
            Artigos do Blog
          </button>
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-foreground truncate">{user.name || 'Admin'}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        <div className="p-8 max-w-7xl mx-auto">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Erro ao carregar dados</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Visão Geral do Sistema</h2>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Atualizar
                </button>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <section>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-4">Métricas de Usuários</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                          <Users className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Total</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">{stats.total}</p>
                      <p className="text-sm text-muted-foreground mt-1">Usuários cadastrados</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-yellow-900/30' : 'bg-yellow-100'}`}>
                          <Crown className={`w-6 h-6 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Premium</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">{stats.byRole.premium}</p>
                      <p className="text-sm text-muted-foreground mt-1">Assinantes ativos</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-100'}`}>
                          <TrendingUp className={`w-6 h-6 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                        </div>
                        <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          +7 dias
                        </span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">{stats.recentSignups}</p>
                      <p className="text-sm text-muted-foreground mt-1">Novos usuários</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-4">Métricas de Conteúdo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
                          <FileText className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Total</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">{posts.length}</p>
                      <p className="text-sm text-muted-foreground mt-1">Artigos criados</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-100'}`}>
                          <CheckCircle className={`w-6 h-6 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Publicados</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {posts.filter((p) => p.status === 'published').length}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Visíveis no blog</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-yellow-900/30' : 'bg-yellow-100'}`}>
                          <Edit className={`w-6 h-6 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Rascunhos</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {posts.filter((p) => p.status === 'draft').length}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Em edição</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Gerenciar Usuários</h2>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Atualizar
                </button>
              </div>

              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar usuários..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(isRoleFilter(e.target.value) ? e.target.value : 'all')}
                    className="pl-4 pr-10 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground min-w-[200px]"
                  >
                    <option value="all">Todas as roles</option>
                    <option value="user">Usuário</option>
                    <option value="author">Autor</option>
                    <option value="premium">Premium</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Usuário</th>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Role</th>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Data Cadastro</th>
                        <th className="px-6 py-3 text-right font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium overflow-hidden">
                                {u.avatar_url ? (
                                  <Image src={u.avatar_url} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                                ) : u.name ? (
                                  u.name.substring(0, 2).toUpperCase()
                                ) : (
                                  u.email.substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{u.name || 'Sem nome'}</p>
                                <div className="flex items-center gap-1">
                                  <p className="text-muted-foreground">{u.email}</p>
                                  {u.email_verified ? (
                                    <CheckCircle
                                      className={`w-3 h-3 ${isDark ? 'text-green-400' : 'text-green-600'}`}
                                    />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(u.role)}`}
                            >
                              {getRoleIcon(u.role)}
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {u.id !== user.id && (
                              <button
                                onClick={() => setSelectedUser(u)}
                                className="text-foreground hover:text-muted-foreground font-medium text-xs px-3 py-1 rounded-md border border-border hover:bg-muted"
                              >
                                Editar Role
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Gerenciar Artigos</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadData}
                    className="px-4 py-2 bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                  </button>
                  <button
                    onClick={() => router.push('/admin/posts/novo')}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Novo Artigo
                  </button>
                </div>
              </div>

              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar artigos..."
                      value={postSearch}
                      onChange={(e) => setPostSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                    />
                  </div>
                  <select
                    value={postStatusFilter}
                    onChange={(e) => setPostStatusFilter(e.target.value)}
                    className="pl-4 pr-10 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground min-w-[200px]"
                  >
                    <option value="all">Todos os status</option>
                    <option value="published">Publicados</option>
                    <option value="draft">Rascunhos</option>
                    <option value="archived">Arquivados</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Titulo</th>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Autor</th>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Data</th>
                        <th className="px-6 py-3 text-right font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPosts.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-medium text-foreground truncate max-w-xs" title={p.title}>
                              {p.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">/{p.slug}</p>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {p.author?.name || 'Desconhecido'}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(p.status)}`}
                            >
                              {p.status === 'draft'
                                ? 'Rascunho'
                                : p.status === 'published'
                                  ? 'Publicado'
                                  : 'Arquivado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {p.published_at
                              ? new Date(p.published_at).toLocaleDateString('pt-BR')
                              : p.created_at
                                ? new Date(p.created_at).toLocaleDateString('pt-BR')
                                : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => router.push(`/admin/posts/${p.id}`)}
                              className="text-foreground hover:text-muted-foreground font-medium text-xs px-3 py-1 rounded-md border border-border hover:bg-muted mr-2"
                            >
                              Editar
                            </button>
                            {p.status === 'draft' && (
                              <button
                                onClick={() => handlePostAction(p.id, 'publish')}
                                className={`text-green-600 hover:text-green-700 font-medium text-xs px-3 py-1 rounded-md border border-green-200 hover:bg-green-50 ${
                                  isDark ? 'border-green-900/50 hover:bg-green-900/30' : ''
                                }`}
                              >
                                Publicar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPosts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">Nenhum artigo encontrado.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* User Role Modal */}
          {selectedUser && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
                <h3 className="text-xl font-bold text-foreground mb-4">Alterar Role</h3>
                <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Usuário selecionado</p>
                  <p className="font-medium text-foreground">{selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <div className="space-y-2 mb-6">
                  {(['user', 'author', 'premium', 'admin'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleUpdate(selectedUser.id, role)}
                      disabled={isUpdatingRole || selectedUser.role === role}
                      className={cn(
                        'w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3',
                        selectedUser.role === role
                          ? 'border-primary bg-slate-900/10 text-primary'
                          : 'border-border hover:border-muted-foreground/20 hover:bg-muted/50 text-foreground'
                      )}
                    >
                      {getRoleIcon(role)}
                      <span className="capitalize flex-1 text-left">{role}</span>
                      {selectedUser.role === role && (
                        <CheckCircle className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-2 text-muted-foreground hover:bg-muted rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
