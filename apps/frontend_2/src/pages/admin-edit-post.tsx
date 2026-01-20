import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Archive, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PostForm } from '@/components/forms/post-form'
import type { PostFormData } from '@/components/forms/post-form'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

type PostStatus = 'draft' | 'published' | 'archived'

type AdminPostDetail = {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  content: string
  cover_image_url?: string | null
  category_slug?: string | null
  tags?: string[]
  status: PostStatus
  published_at?: string | null
  created_at?: string | null
}

export default function AdminEditPostPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin, isLoading } = useUser()
  const navigate = useNavigate()
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [post, setPost] = useState<AdminPostDetail | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isActing, setIsActing] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/')
    }
  }, [isLoading, isAdmin, navigate])

  useEffect(() => {
    const load = async () => {
      if (!id) {
        navigate('/admin?tab=posts')
        return
      }

      setIsPageLoading(true)
      try {
        const res = await fetchWithCredentials(`${API_URL}/blog/admin/posts/${id}`)
        if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao carregar post'))
        const data = (await res.json()) as AdminPostDetail
        setPost(data)
      } catch (err) {
        setPost(null)
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar post')
        navigate('/admin?tab=posts')
      } finally {
        setIsPageLoading(false)
      }
    }

    if (!isLoading && isAdmin) {
      void load()
    }
  }, [id, isAdmin, isLoading, navigate])

  if (isLoading || isPageLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAdmin) {
    return null
  }

  const extractErrorMessage = async (response: Response, fallback: string) => {
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
  }

  const handleSubmit = async (data: PostFormData) => {
    if (!id) return
    if (!data.title.trim() || !data.content.trim()) {
      toast.error('Preencha pelo menos título e conteúdo')
      return
    }

    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        title: data.title.trim(),
        excerpt: data.excerpt.trim() || undefined,
        content: data.content.trim(),
        cover_image_url: data.cover_image_url.trim() || undefined,
        category: data.category.trim() || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
      }
      const res = await fetchWithCredentials(`${API_URL}/blog/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao salvar post'))
      toast.success('Post atualizado!')
      navigate('/admin?tab=posts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar post')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!isAdmin || !id) {
      toast.error('Apenas admin pode publicar')
      return
    }
    setIsActing(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/blog/posts/${id}/publish`, { method: 'PATCH' })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao publicar post'))
      toast.success('Post publicado!')
      navigate('/admin?tab=posts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar post')
    } finally {
      setIsActing(false)
    }
  }

  const handleArchive = async () => {
    if (!isAdmin || !id) {
      toast.error('Apenas admin pode arquivar')
      return
    }
    if (!confirm('Tem certeza que deseja arquivar este post?')) return
    setIsActing(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/blog/posts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao arquivar post'))
      toast.success('Post arquivado!')
      navigate('/admin?tab=posts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao arquivar post')
    } finally {
      setIsActing(false)
    }
  }

  return (
    <PostForm
      pageTitle="Editar Artigo"
      pageSubtitle={post?.slug ? `/${post.slug}` : undefined}
      initialData={{
        title: post?.title || '',
        excerpt: post?.excerpt || '',
        content: post?.content || '',
        cover_image_url: post?.cover_image_url || '',
        category: post?.category_slug || '',
        tags: post?.tags || [],
      }}
      onSubmit={handleSubmit}
      isSubmitting={isSaving}
      submitLabel="Salvar"
      headerActions={
        <>
          {isAdmin && post?.status !== 'published' ? (
            <button
              onClick={() => void handlePublish()}
              disabled={isActing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              <CheckCircle className="w-4 h-4" />
              Publicar
            </button>
          ) : null}

          {isAdmin ? (
            <button
              onClick={() => void handleArchive()}
              disabled={isActing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              <Archive className="w-4 h-4" />
              Arquivar
            </button>
          ) : null}
        </>
      }
    />
  )
}
