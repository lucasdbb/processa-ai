import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Edit,
  Eye,
  Search,
  RefreshCw,
  Archive,
  CheckCircle,
  RotateCcw,
} from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn, formatDate } from '@/lib/utils'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { toast } from 'sonner'

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

interface PostsTabProps {
  isAdmin: boolean
}

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

export default function PostsTab({ isAdmin }: PostsTabProps) {
  const [posts, setPosts] = useState<AdminPostListItem[]>([])
  const [isPostsLoading, setIsPostsLoading] = useState(false)
  const [postSearch, setPostSearch] = useState('')
  const [postStatusFilter, setPostStatusFilter] = useState<'all' | PostStatus>('all')
  const [archivePostId, setArchivePostId] = useState<string | null>(null)
  const [publishPostId, setPublishPostId] = useState<string | null>(null)
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false)

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
      setPosts([])
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar posts')
    } finally {
      setIsPostsLoading(false)
    }
  }, [extractErrorMessage])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

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

  const handlePublishPost = async (postId: string, notifySubscribers: boolean) => {
    if (!isAdmin) {
      toast.error('Apenas admin pode publicar posts')
      return
    }
    try {
      const res = await fetchWithCredentials(`${API_URL}/blog/posts/${postId}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify_subscribers: notifySubscribers }),
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao publicar post'))
      const message = notifySubscribers ? 'Post publicado e assinantes notificados!' : 'Post publicado!'
      toast.success(message)
      void loadPosts()
      setIsPublishDialogOpen(false)
      setPublishPostId(null)
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

  const openPublishDialog = (postId: string) => {
    setPublishPostId(postId)
    setIsPublishDialogOpen(true)
  }
  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase()
    const status = postStatusFilter
    return posts.filter((p) => {
      const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
      const matchesStatus = status === 'all' || p.status === status
      return matchesSearch && matchesStatus
    })
  }, [posts, postSearch, postStatusFilter])

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">Gerenciar Artigos</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadPosts} disabled={isPostsLoading}>
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
                                <Button variant="ghost" size="sm" onClick={() => openPublishDialog(post.id)}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              ) : null}

                              {isAdmin && post.status === 'archived' ? (
                                <Button variant="ghost" size="sm" onClick={() => handleRestorePost(post.id)}>
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

      {/* Publish Post Confirmation Dialog */}
      <DialogPrimitive.Root open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-[9998]" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[9999] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Publicar Post</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Deseja notificar os assinantes da newsletter sobre este novo post?
                </p>
              </div>
              <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
                <Cross2Icon className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </DialogPrimitive.Close>
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <Button
                onClick={() => publishPostId && handlePublishPost(publishPostId, true)}
                className="w-full"
              >
                Publicar e Notificar Assinantes
              </Button>
              <Button
                onClick={() => publishPostId && handlePublishPost(publishPostId, false)}
                variant="outline"
                className="w-full"
              >
                Publicar sem Notificar
              </Button>
              <Button
                onClick={() => {
                  setIsPublishDialogOpen(false)
                  setPublishPostId(null)
                }}
                variant="ghost"
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
