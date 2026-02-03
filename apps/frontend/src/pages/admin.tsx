import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Users,
  User,
  Crown,
  TrendingUp,
  FileText,
  LayoutDashboard,
  Shield,
  Search,
  RefreshCw,
  Archive,
  CheckCircle,
  RotateCcw,
  ArrowLeft,
  XCircle,
} from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUser } from '@/features/auth/hooks/use-user'
import { cn, formatDate } from '@/lib/utils'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { toast } from 'sonner'

type Tab = 'overview' | 'users' | 'posts' | 'materials'

type PostStatus = 'draft' | 'published' | 'archived'

interface AdminPostListItem {
  id: string
  slug: string
  title: string
  status: PostStatus
  created_at?: string
  published_at?: string
  author?: {
    id: string
    name?: string
  }
}

interface UserListItem {
  id: string
  email: string
  name: string
  role: 'client' | 'author' | 'admin'
  avatar_url?: string | null
  created_at: string
  confirmed_at?: string | null
}

type MaterialMimeType = 'pdf' | 'xls' | 'xlsx' | 'xlsm' | 'docx' | 'csv'

interface AdminMaterialListItem {
  id: string
  slug: string
  title: string
  description?: string | null
  category: string
  filename: string
  mime_type: MaterialMimeType
  is_published: boolean
  created_at: string
  updated_at: string
}

type MaterialModalMode = 'create' | 'edit'

const TABS_ADMIN: Tab[] = ['overview', 'users', 'posts', 'materials']
const TABS_AUTHOR: Tab[] = ['overview', 'posts']

const postStatusLabel: Record<PostStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
}

const postStatusBadgeClass: Record<PostStatus, string> = {
  published: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50',
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900/50',
  archived: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800',
}

const roleLabel: Record<UserListItem['role'], string> = {
  client: 'Cliente',
  author: 'Autor',
  admin: 'Admin',
}

const getRoleIcon = (role: UserListItem['role']) => {
  switch (role) {
    case 'admin':
      return <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
    case 'author':
      return <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    default:
      return <Users className="w-4 h-4 text-muted-foreground" />
  }
}

const getRoleBadgeClass = (role: UserListItem['role']) => {
  switch (role) {
    case 'admin':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50'
    case 'author':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50'
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800'
  }
}

const isTab = (value: string | null | undefined): value is Tab =>
  value === 'overview' || value === 'users' || value === 'posts' || value === 'materials'

type MaterialModalSubmitData = {
  title: string
  slug?: string
  group: string
  description?: string
  is_published: boolean
  mime_type: MaterialMimeType
  file: File | null
}

export default function AdminPage() {
  const { user, isAdmin, isAuthor, isLoading: authLoading } = useUser()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const allowedTabs = isAdmin ? TABS_ADMIN : TABS_AUTHOR
  const initialTabFromUrl = searchParams.get('tab')
  const initialTab: Tab = isTab(initialTabFromUrl) && allowedTabs.includes(initialTabFromUrl)
    ? initialTabFromUrl
    : allowedTabs[0]

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [error, setError] = useState<string | null>(null)

  const [posts, setPosts] = useState<AdminPostListItem[]>([])
  const [isPostsLoading, setIsPostsLoading] = useState(false)
  const [postSearch, setPostSearch] = useState('')
  const [postStatusFilter, setPostStatusFilter] = useState<'all' | PostStatus>('all')

  const [users, setUsers] = useState<UserListItem[]>([])
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserListItem['role']>('all')
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [selectedUserRole, setSelectedUserRole] = useState<UserListItem['role']>('client')
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)

  const [materials, setMaterials] = useState<AdminMaterialListItem[]>([])
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false)
  const [materialsSearch, setMaterialsSearch] = useState('')
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false)
  const [materialModalMode, setMaterialModalMode] = useState<MaterialModalMode>('create')
  const [materialModalInitial, setMaterialModalInitial] = useState<AdminMaterialListItem | null>(null)
  const [isSavingMaterial, setIsSavingMaterial] = useState(false)
  const [archivePostId, setArchivePostId] = useState<string | null>(null)
  const [deleteMaterialId, setDeleteMaterialId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAdmin && !isAuthor) {
      navigate('/')
    }
  }, [authLoading, isAdmin, isAuthor, navigate])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (isTab(tab) && allowedTabs.includes(tab)) {
      setActiveTab(tab)
      return
    }
    setActiveTab((current) => (allowedTabs.includes(current) ? current : allowedTabs[0]))
  }, [allowedTabs, searchParams])

  const setTab = (next: Tab) => {
    if (!allowedTabs.includes(next)) return
    setActiveTab(next)
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev)
      nextParams.set('tab', next)
      return nextParams
    })
  }

  const extractErrorMessage = useCallback(async (response: Response, fallback: string) => {
    try {
      const data: unknown = await response.json()
      if (data && typeof data === 'object' && 'detail' in data) {
        const detail = (data as { detail?: unknown }).detail
        if (typeof detail === 'string' && detail.trim()) return detail

        if (Array.isArray(detail)) {
          const messages = detail
            .map((item) => {
              if (!item || typeof item !== 'object') return null
              const loc = 'loc' in item ? (item as { loc?: unknown }).loc : undefined
              const msg = 'msg' in item ? (item as { msg?: unknown }).msg : undefined
              const locParts = Array.isArray(loc) ? loc : []
              const field = locParts
                .map((p) => (typeof p === 'string' || typeof p === 'number' ? String(p) : ''))
                .filter(Boolean)
                .at(-1)
              const messageText = typeof msg === 'string' ? msg : ''
              if (field && messageText) return `${field}: ${messageText}`
              if (messageText) return messageText
              return null
            })
            .filter((m): m is string => Boolean(m && m.trim()))

          if (messages.length > 0) return messages.join('; ')
        }
      }
    } catch {
      return fallback
    }
    return fallback
  }, [])

  const loadPosts = useCallback(async () => {
    setIsPostsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: '1',
        page_size: '100',
      })
      const res = await fetchWithCredentials(`${API_URL}/blog/admin/posts?${params.toString()}`)
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao carregar posts'))
      const payload = (await res.json()) as { items?: AdminPostListItem[] }
      setPosts(Array.isArray(payload.items) ? payload.items : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar posts'
      setPosts([])
      setError(message)
      toast.error(message)
    } finally {
      setIsPostsLoading(false)
    }
  }, [extractErrorMessage])

  const loadUsers = useCallback(async () => {
    setIsUsersLoading(true)
    setError(null)
    try {
      const res = await fetchWithCredentials(`${API_URL}/users?limit=100&offset=0`)
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao carregar usuários'))
      const data = (await res.json()) as unknown
      setUsers(Array.isArray(data) ? (data as UserListItem[]) : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar usuários'
      setUsers([])
      setError(message)
      toast.error(message)
    } finally {
      setIsUsersLoading(false)
    }
  }, [extractErrorMessage])

  const loadMaterials = useCallback(async () => {
    setIsMaterialsLoading(true)
    setError(null)
    try {
      const res = await fetchWithCredentials(`${API_URL}/materials/admin/list`)
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao carregar materiais'))
      const data = (await res.json()) as unknown
      setMaterials(Array.isArray(data) ? (data as AdminMaterialListItem[]) : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar materiais'
      setMaterials([])
      setError(message)
      toast.error(message)
    } finally {
      setIsMaterialsLoading(false)
    }
  }, [extractErrorMessage])

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin && !isAuthor) return
    void loadPosts()
    if (isAdmin) {
      void loadUsers()
      void loadMaterials()
    }
  }, [authLoading, isAdmin, isAuthor, loadMaterials, loadPosts, loadUsers])

  const handleArchivePost = async (postId: string) => {
    if (!isAdmin) {
      toast.error('Apenas admin pode arquivar posts')
      return
    }
    try {
      const res = await fetchWithCredentials(`${API_URL}/blog/posts/${postId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao arquivar post'))
      toast.success('Post arquivado!')
      void loadPosts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao arquivar post')
    } finally {
      setArchivePostId(null)
    }
  }

  const handlePublishPost = async (postId: string) => {
    if (!isAdmin) {
      toast.error('Apenas admin pode publicar posts')
      return
    }
    try {
      const res = await fetchWithCredentials(`${API_URL}/blog/posts/${postId}/publish`, {
        method: 'PATCH',
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao publicar post'))
      toast.success('Post publicado!')
      void loadPosts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar post')
    }
  }

  const handleRestorePost = async (postId: string) => {
    if (!isAdmin) {
      toast.error('Apenas admin pode restaurar posts')
      return
    }
    try {
      const res = await fetchWithCredentials(`${API_URL}/blog/posts/${postId}/restore`, {
        method: 'PATCH',
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao restaurar post'))
      toast.success('Post restaurado para rascunho!')
      void loadPosts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao restaurar post')
    }
  }

  const openRoleDialog = (u: UserListItem) => {
    setSelectedUser(u)
    setSelectedUserRole(u.role)
    setIsRoleDialogOpen(true)
  }

  const closeRoleDialog = () => {
    setIsRoleDialogOpen(false)
    setSelectedUser(null)
  }

  const handleUpdateRole = async () => {
    if (!selectedUser) return
    setIsUpdatingRole(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/users/update-role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, role: selectedUserRole }),
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao atualizar role'))
      toast.success('Role atualizada!')
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, role: selectedUserRole } : u)))
      closeRoleDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar role')
    } finally {
      setIsUpdatingRole(false)
    }
  }

  const openCreateMaterialModal = () => {
    setMaterialModalMode('create')
    setMaterialModalInitial(null)
    setIsMaterialModalOpen(true)
  }

  const openEditMaterialModal = (item: AdminMaterialListItem) => {
    setMaterialModalMode('edit')
    setMaterialModalInitial(item)
    setIsMaterialModalOpen(true)
  }

  const closeMaterialModal = () => {
    setIsMaterialModalOpen(false)
    setMaterialModalInitial(null)
  }

  const handleSubmitMaterial = async (data: MaterialModalSubmitData) => {
    if (!isAdmin) return
    setIsSavingMaterial(true)
    try {
      const formData = new FormData()
      formData.append('title', data.title)
      formData.append('category', data.group)
      if (data.slug) formData.append('slug', data.slug)
      formData.append('description', data.description ?? '')
      formData.append('is_published', String(data.is_published))
      formData.append('mime_type', data.mime_type)
      if (data.file) formData.append('file', data.file)

      const url = materialModalMode === 'create'
        ? `${API_URL}/materials/admin`
        : `${API_URL}/materials/admin/${materialModalInitial?.id}`

      const method = materialModalMode === 'create' ? 'POST' : 'PATCH'

      const res = await fetchWithCredentials(url, {
        method,
        body: formData,
      })

      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao salvar material'))
      toast.success(materialModalMode === 'create' ? 'Material criado!' : 'Material atualizado!')
      closeMaterialModal()
      void loadMaterials()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar material')
    } finally {
      setIsSavingMaterial(false)
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    if (!isAdmin) {
      toast.error('Apenas admin pode excluir materiais')
      return
    }
    try {
      const res = await fetchWithCredentials(`${API_URL}/materials/admin/${materialId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao excluir material'))
      toast.success('Material excluído!')
      if (materialModalInitial?.id === materialId) closeMaterialModal()
      setDeleteMaterialId(null)
      void loadMaterials()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir material')
    }
  }

  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase()
    const status = postStatusFilter
    return posts.filter((p) => {
      const title = (p.title || '').toLowerCase()
      const matchesSearch = !q || title.includes(q)
      const matchesStatus = status === 'all' || p.status === status
      return matchesSearch && matchesStatus
    })
  }, [postSearch, postStatusFilter, posts])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    const role = roleFilter
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      const matchesRole = role === 'all' || u.role === role
      return matchesSearch && matchesRole
    })
  }, [roleFilter, userSearch, users])

  const filteredMaterials = useMemo(() => {
    const q = materialsSearch.trim().toLowerCase()
    if (!q) return materials
    return materials.filter((m) => {
      return (
        m.title.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      )
    })
  }, [materials, materialsSearch])

  const materialGroupOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of materials) {
      if (m.category?.trim()) set.add(m.category.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [materials])

  if (authLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAdmin && !isAuthor) {
    return null
  }

  const usersCountByRole = (() => {
    const byRole: Record<string, number> = { user: 0, author: 0, premium: 0, admin: 0 }
    for (const u of users) byRole[u.role] = (byRole[u.role] || 0) + 1
    return byRole
  })()

  const recentUsersCount = (() => {
    if (users.length === 0) return 0
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return users.filter((u) => new Date(u.created_at) > sevenDaysAgo).length
  })()

  const reloadAll = () => {
    void loadPosts()
    if (isAdmin) {
      void loadUsers()
      void loadMaterials()
    }
  }

  const isReloading = isPostsLoading || (isAdmin && (isUsersLoading || isMaterialsLoading))

  return (
    <div className="min-h-screen bg-muted/40 flex font-sans text-foreground">
      <div className="w-64 bg-card border-r border-border hidden lg:flex flex-col fixed h-full">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-foreground" />
            Admin
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:bg-muted mb-4 border border-border hover:text-foreground"
            type="button"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Home
          </button>

          <button
            onClick={() => setTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            type="button"
          >
            <LayoutDashboard className="w-5 h-5" />
            Visão Geral
          </button>

          {isAdmin ? (
            <button
              onClick={() => setTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'users'
                  ? 'bg-slate-900 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
            >
              <Users className="w-5 h-5" />
              Usuários
            </button>
          ) : null}

          <button
            onClick={() => setTab('posts')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'posts'
                ? 'bg-slate-900 text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            type="button"
          >
            <FileText className="w-5 h-5" />
            Artigos do Blog
          </button>

          {isAdmin ? (
            <button
              onClick={() => setTab('materials')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'materials'
                  ? 'bg-slate-900 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
            >
              <FileText className="w-5 h-5" />
              Materiais
            </button>
          ) : null}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar className="h-8 w-8">
              {user?.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user?.name || user?.email || 'Avatar'} />
              ) : null}
              <AvatarFallback className="bg-slate-900 text-white text-sm font-medium">
                {(user?.name
                  ? user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : user?.email
                    ? user.email.slice(0, 2).toUpperCase()
                    : 'A')}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-foreground truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 lg:ml-64">
        <div className="p-8 max-w-7xl mx-auto">
          {error ? (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Erro ao carregar dados</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          ) : null}

          <div className="lg:hidden mb-6 flex flex-wrap gap-2">
            <Button variant={activeTab === 'overview' ? 'default' : 'outline'} onClick={() => setTab('overview')}>
              <LayoutDashboard className="h-4 w-4" />
              Visão geral
            </Button>
            {isAdmin ? (
              <Button variant={activeTab === 'users' ? 'default' : 'outline'} onClick={() => setTab('users')}>
                <Users className="h-4 w-4" />
                Usuários
              </Button>
            ) : null}
            <Button variant={activeTab === 'posts' ? 'default' : 'outline'} onClick={() => setTab('posts')}>
              <FileText className="h-4 w-4" />
              Posts
            </Button>
            {isAdmin ? (
              <Button variant={activeTab === 'materials' ? 'default' : 'outline'} onClick={() => setTab('materials')}>
                <FileText className="h-4 w-4" />
                Materiais
              </Button>
            ) : null}
          </div>

          {activeTab === 'overview' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Visão Geral</h2>
                <Button variant="outline" onClick={reloadAll} disabled={isReloading}>
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {isAdmin ? (
                  <section>
                    <h3 className="text-lg font-semibold text-muted-foreground mb-4">Métricas de Usuários</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Total</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">{users.length}</p>
                        <p className="text-sm text-muted-foreground mt-1">Usuários cadastrados</p>
                      </div>

                      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                            <Crown className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Premium</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">{usersCountByRole.premium || 0}</p>
                        <p className="text-sm text-muted-foreground mt-1">Assinantes ativos</p>
                      </div>

                      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">+7 dias</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">{recentUsersCount}</p>
                        <p className="text-sm text-muted-foreground mt-1">Novos usuários</p>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-4">Métricas de Conteúdo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                          <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Total</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">{posts.length}</p>
                      <p className="text-sm text-muted-foreground mt-1">Artigos criados</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Publicados</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">{posts.filter((p) => p.status === 'published').length}</p>
                      <p className="text-sm text-muted-foreground mt-1">Visíveis no blog</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                          <Edit className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Rascunhos</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">{posts.filter((p) => p.status === 'draft').length}</p>
                      <p className="text-sm text-muted-foreground mt-1">Em edição</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {isAdmin && activeTab === 'users' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Gerenciar Usuários</h2>
                <Button variant="outline" onClick={() => void loadUsers()} disabled={isUsersLoading}>
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              </div>

              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Buscar usuários..."
                        className="pl-9"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                      <SelectTrigger className="md:w-[200px]">
                        <SelectValue placeholder="Todas as roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as roles</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="author">Autor</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isUsersLoading ? (
                    <div className="py-12 flex justify-center">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Usuário</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Role</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Cadastro</th>
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
                                      <img
                                        src={u.avatar_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
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
                                      {u.confirmed_at ? (
                                        <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                                      ) : (
                                        <XCircle className="w-3 h-3 text-muted-foreground" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                                    getRoleBadgeClass(u.role)
                                  )}
                                >
                                  {getRoleIcon(u.role)}
                                  {roleLabel[u.role] || u.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                              <td className="px-6 py-4 text-right">
                                <Button variant="outline" size="sm" onClick={() => openRoleDialog(u)} disabled={u.id === user?.id}>
                                  Editar Role
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredUsers.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground">Nenhum usuário encontrado.</div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Dialog
                open={isRoleDialogOpen}
                onOpenChange={(open) => (open ? setIsRoleDialogOpen(true) : closeRoleDialog())}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar role</DialogTitle>
                    <DialogDescription>
                      {selectedUser ? `Atualize a role de ${selectedUser.email}.` : null}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Select
                      value={selectedUserRole}
                      onValueChange={(v) => setSelectedUserRole(v as UserListItem['role'])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="author">Autor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeRoleDialog}>
                      Cancelar
                    </Button>
                    <Button onClick={() => void handleUpdateRole()} disabled={isUpdatingRole}>
                      {isUpdatingRole ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : null}

          {activeTab === 'posts' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Gerenciar Artigos</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => void loadPosts()} disabled={isPostsLoading}>
                    <RefreshCw className="h-4 w-4" />
                    Atualizar
                  </Button>
                  <Button asChild>
                    <Link to="/admin/posts/novo">
                      <Plus className="h-4 w-4" />
                      Novo Artigo
                    </Link>
                  </Button>
                </div>
              </div>

              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={postSearch}
                        onChange={(e) => setPostSearch(e.target.value)}
                        placeholder="Buscar artigos..."
                        className="pl-9"
                      />
                    </div>
                    <Select
                      value={postStatusFilter}
                      onValueChange={(v) => setPostStatusFilter(v as typeof postStatusFilter)}
                    >
                      <SelectTrigger className="md:w-[200px]">
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="published">Publicados</SelectItem>
                        <SelectItem value="draft">Rascunhos</SelectItem>
                        <SelectItem value="archived">Arquivados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isPostsLoading ? (
                    <div className="py-12 flex justify-center">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Título</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Autor</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Data</th>
                            <th className="px-6 py-3 text-right font-medium text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredPosts.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                Nenhum post encontrado.
                              </td>
                            </tr>
                          ) : (
                            filteredPosts.map((post) => (
                              <tr key={post.id} className="hover:bg-muted/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground">{post.title}</span>
                                    <span className="text-xs text-muted-foreground">{post.slug}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">{post.author?.name || 'Desconhecido'}</td>
                                <td className="px-6 py-4">
                                  <span
                                    className={cn(
                                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                                      postStatusBadgeClass[post.status]
                                    )}
                                  >
                                    {postStatusLabel[post.status]}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                  {post.published_at ? formatDate(post.published_at) : post.created_at ? formatDate(post.created_at) : '-'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {post.status === 'published' ? (
                                      <Button variant="ghost" size="sm" asChild>
                                        <Link to={`/blog/${post.slug}`} target="_blank">
                                          <Eye className="h-4 w-4" />
                                        </Link>
                                      </Button>
                                    ) : null}

                                    <Button variant="ghost" size="sm" asChild>
                                      <Link to={`/admin/posts/${post.id}`}>
                                        <Edit className="h-4 w-4" />
                                      </Link>
                                    </Button>

                                    {isAdmin && post.status === 'draft' ? (
                                      <Button variant="ghost" size="sm" onClick={() => void handlePublishPost(post.id)}>
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                    ) : null}

                                    {isAdmin && post.status === 'archived' ? (
                                      <Button variant="ghost" size="sm" onClick={() => void handleRestorePost(post.id)}>
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                    ) : null}

                                    {isAdmin && post.status !== 'archived' ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setArchivePostId(post.id)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Archive className="h-4 w-4" />
                                      </Button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {isAdmin && activeTab === 'materials' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Gerenciar Materiais</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => void loadMaterials()} disabled={isMaterialsLoading}>
                    <RefreshCw className="h-4 w-4" />
                    Atualizar
                  </Button>
                  <Button onClick={openCreateMaterialModal}>
                    <Plus className="h-4 w-4" />
                    Novo material
                  </Button>
                </div>
              </div>

              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={materialsSearch}
                        onChange={(e) => setMaterialsSearch(e.target.value)}
                        placeholder="Buscar materiais..."
                        className="pl-9"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isMaterialsLoading ? (
                    <div className="py-12 flex justify-center">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Material</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Grupo</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="px-6 py-3 text-right font-medium text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredMaterials.map((m) => (
                            <tr key={m.id} className="hover:bg-muted/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground">{m.title}</span>
                                  <span className="text-xs text-muted-foreground">{m.slug}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">{m.category}</td>
                              <td className="px-6 py-4">
                                <span
                                  className={cn(
                                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                                    m.is_published
                                      ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50'
                                      : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800'
                                  )}
                                >
                                  {m.is_published ? 'Publicado' : 'Rascunho'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => openEditMaterialModal(m)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteMaterialId(m.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredMaterials.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground">Nenhum material encontrado.</div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              {isMaterialModalOpen ? (
                <MaterialModal
                  key={`${materialModalMode}-${materialModalInitial?.id ?? 'new'}`}
                  open={isMaterialModalOpen}
                  mode={materialModalMode}
                  initial={materialModalInitial}
                  groupOptions={materialGroupOptions}
                  isSaving={isSavingMaterial}
                  onOpenChange={(open) => {
                    if (!open) closeMaterialModal()
                    else setIsMaterialModalOpen(true)
                  }}
                  onSubmit={handleSubmitMaterial}
                />
              ) : null}
            </div>
          ) : null}

        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={!!archivePostId}
        onClose={() => setArchivePostId(null)}
        onConfirm={() => archivePostId && handleArchivePost(archivePostId)}
        title="Arquivar post?"
        description="Este post será arquivado e não ficará mais visível publicamente. Você pode restaurá-lo depois."
        confirmText="Arquivar"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!deleteMaterialId}
        onClose={() => setDeleteMaterialId(null)}
        onConfirm={() => deleteMaterialId && handleDeleteMaterial(deleteMaterialId)}
        title="Excluir material?"
        description="Esta ação é permanente e não pode ser desfeita. O arquivo será removido do servidor."
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  )
}

function MaterialModal({
  open,
  mode,
  initial,
  groupOptions,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  mode: MaterialModalMode
  initial: AdminMaterialListItem | null
  groupOptions: string[]
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: MaterialModalSubmitData) => void
}) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(() => (mode === 'edit' && initial ? initial.title : ''))
  const [slug, setSlug] = useState(() => (mode === 'edit' && initial ? initial.slug : ''))
  const [group, setGroup] = useState(() => (mode === 'edit' && initial ? initial.category : ''))
  const [description, setDescription] = useState(() =>
    mode === 'edit' && initial ? initial.description || '' : ''
  )
  const [isPublished, setIsPublished] = useState(() => (mode === 'edit' && initial ? initial.is_published : true))
  const [mimeType, setMimeType] = useState<MaterialMimeType>(() =>
    mode === 'edit' && initial ? initial.mime_type : 'pdf'
  )
  const [file, setFile] = useState<File | null>(null)

  const acceptByMime: Record<MaterialMimeType, string> = {
    pdf: 'application/pdf,.pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx',
    xls: 'application/vnd.ms-excel,.xls',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx',
    xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12,.xlsm',
    csv: 'text/csv,.csv',
  }

  const clearSelectedFile = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const openCurrentFile = () => {
    if (!initial?.slug) return
    const slug = encodeURIComponent(initial.slug)
    window.open(`${API_URL}/materials/${slug}/download`, '_blank', 'noopener,noreferrer')
  }

  const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    const base = 1024
    const index = Math.min(Math.floor(Math.log(value) / Math.log(base)), units.length - 1)
    const size = value / Math.pow(base, index)
    const digits = index === 0 ? 0 : size >= 10 ? 1 : 2
    return `${size.toFixed(digits)} ${units[index]}`
  }

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => titleInputRef.current?.focus())
  }, [open])

  const handlePrimary = () => {
    const nextTitle = title.trim()
    const nextGroup = group.trim()
    const nextSlug = slug.trim()

    if (!nextTitle) {
      toast.error('Título é obrigatório')
      return
    }

    if (!nextGroup) {
      toast.error('Grupo é obrigatório')
      return
    }

    if (mode === 'edit' && !nextSlug) {
      toast.error('Slug é obrigatório')
      return
    }

    if (mode === 'create' && !file) {
      toast.error('Arquivo é obrigatório')
      return
    }

    onSubmit({
      title: nextTitle,
      slug: nextSlug ? nextSlug : undefined,
      group: nextGroup,
      description: description.trim() || undefined,
      is_published: isPublished,
      mime_type: mimeType,
      file,
    })
  }

  const titleText = mode === 'create' ? 'Novo material' : 'Editar material'
  const primaryText = mode === 'create' ? 'Criar' : 'Salvar'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-card p-6 font-sans shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight text-foreground">
                {titleText}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground mt-1">
                {mode === 'create'
                  ? 'Faça upload e configure título, grupo e visibilidade.'
                  : initial
                    ? `/${initial.slug}`
                    : ''}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              disabled={isSaving}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Cross2Icon className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Título</label>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {mode === 'create' ? 'Slug (opcional)' : 'Slug'}
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Grupo</label>
              <input
                type="text"
                list="material-group-options"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
              <datalist id="material-group-options">
                {groupOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Tipo</label>
              <select
                value={mimeType}
                onChange={(e) => setMimeType(e.target.value as MaterialMimeType)}
                className="mt-1 w-full pl-4 pr-10 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              >
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
                <option value="xls">XLS</option>
                <option value="xlsx">XLSX</option>
                <option value="xlsm">XLSM</option>
                <option value="csv">CSV</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Descrição (opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">
                {mode === 'create' ? 'Arquivo' : 'Substituir arquivo (opcional)'}
              </label>
              <div className="mt-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptByMime[mimeType]}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-dashed border-border bg-background/60 p-4 text-left transition-colors hover:bg-muted/30 disabled:opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file?.name || initial?.filename || 'Selecionar arquivo'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {file
                          ? `Novo arquivo selecionado${file.size ? ` • ${formatBytes(file.size)}` : ''}`
                          : mode === 'edit' && initial?.filename
                            ? 'Arquivo atual'
                            : 'PDF, DOCX, XLS, XLSX, XLSM ou CSV'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {mode === 'create'
                        ? 'Selecionar'
                        : initial?.filename
                          ? 'Trocar'
                          : 'Selecionar'}
                    </span>
                  </div>
                </button>

                <div className="flex items-center justify-between gap-2">
                  {mode === 'edit' && initial?.filename ? (
                    <button
                      type="button"
                      onClick={openCurrentFile}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-60"
                    >
                      Abrir arquivo atual
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">&nbsp;</span>
                  )}

                  {file ? (
                    <button
                      type="button"
                      onClick={clearSelectedFile}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                    >
                      Remover seleção
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="material-modal-published"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="material-modal-published" className="text-sm text-foreground">
                Publicado
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close
              disabled={isSaving}
              className="px-4 py-2 bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg"
            >
              Cancelar
            </DialogPrimitive.Close>
            <button
              onClick={handlePrimary}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              {isSaving ? 'Salvando...' : primaryText}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
