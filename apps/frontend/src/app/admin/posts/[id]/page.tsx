'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { adminService, type BlogPostDetail } from '@/features/blog/services/admin-service'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { toast } from 'sonner'
import { Eye, Archive } from 'lucide-react'
import { PostForm, PostFormData } from '@/components/forms/post-form'

export default function EditPostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string
  const { user, isLoading: isAuthLoading } = useAuthStore()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)
  const [post, setPost] = useState<BlogPostDetail | null>(null)

  // Timeout de segurança: se após 5 segundos ainda estiver carregando auth, redirecionar
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isAuthLoading && !user) {
        router.push('/admin')
      }
    }, 5000)
    return () => clearTimeout(timeout)
  }, [isAuthLoading, user, router])

  useEffect(() => {
    if (!isAuthLoading) {
      setHasCheckedAuth(true)
      if (!user || user.role !== 'admin') {
        router.push('/admin')
      }
    }
  }, [user, isAuthLoading, router])

  const loadPost = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await adminService.getPost(postId)
      setPost(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar post')
      router.push('/admin?tab=posts')
    } finally {
      setIsLoading(false)
    }
  }, [postId, router])

  useEffect(() => {
    if (hasCheckedAuth && user && user.role === 'admin' && postId) {
      loadPost()
    }
  }, [hasCheckedAuth, user, postId, loadPost])

  const handleSubmit = async (data: PostFormData) => {
    setIsSubmitting(true)
    try {
      await adminService.updatePost(postId, {
        title: data.title,
        excerpt: data.excerpt || undefined,
        content: data.content,
        cover_image_url: data.cover_image_url || undefined,
        category: data.category || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
      })
      toast.success('Post atualizado!')
      router.push('/admin?tab=posts')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar post')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePublish = async () => {
    if (!post) return
    try {
      await adminService.publishPost(postId)
      toast.success('Post publicado!')
      router.push('/admin?tab=posts')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao publicar post')
    }
  }

  const handleArchive = async () => {
    if (!post) return
    if (!confirm('Tem certeza que deseja arquivar este post?')) return
    try {
      await adminService.deletePost(postId)
      toast.success('Post arquivado!')
      router.push('/admin?tab=posts')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao arquivar post')
    }
  }

  if ((isAuthLoading && !hasCheckedAuth) || (hasCheckedAuth && isLoading)) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!user || user.role !== 'admin' || !post) {
    return null
  }

  const isPublished = post.published_at !== undefined && post.published_at !== null

  const headerActions = (
    <>
      {!isPublished && (
        <button
          onClick={handlePublish}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Eye className="w-4 h-4" />
          Publicar
        </button>
      )}
      <button
        onClick={handleArchive}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
      >
        <Archive className="w-4 h-4" />
        Arquivar
      </button>
    </>
  )

  const initialData: Partial<PostFormData> = {
    title: post.title,
    excerpt: post.excerpt || '',
    content: post.content,
    cover_image_url: post.cover_image_url || '',
    category: post.category_slug || '',
    tags: post.tags || [],
  }

  return (
    <PostForm
      pageTitle="Editar Artigo"
      pageSubtitle={`/${post.slug}`}
      initialData={initialData}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Salvar"
      headerActions={headerActions}
    />
  )
}
