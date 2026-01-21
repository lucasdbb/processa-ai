import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PostForm } from '@/components/forms/post-form'
import type { PostFormData } from '@/components/forms/post-form'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

export default function AdminNewPostPage() {
  const { isAdmin, isLoading } = useUser()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/')
    }
  }, [isLoading, isAdmin, navigate])

  if (isLoading) {
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
    setIsSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        title: data.title.trim(),
        excerpt: data.excerpt.trim() || undefined,
        content: data.content.trim(),
        cover_image_url: data.cover_image_url.trim() || undefined,
        category: data.category.trim() || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
      }

      const res = await fetchWithCredentials(`${API_URL}/blog/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao criar post'))

      await res.json()
      toast.success('Post criado como rascunho!')
      navigate('/admin?tab=posts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar post')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PostForm
      pageTitle="Novo Artigo"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Salvar Rascunho"
    />
  )
}
