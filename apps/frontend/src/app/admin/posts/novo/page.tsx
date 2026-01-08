'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { adminService } from '@/features/blog/services/admin-service'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { toast } from 'sonner'
import { PostForm, PostFormData } from '@/components/forms/post-form'

export default function NewPostPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

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

  const handleSubmit = async (data: PostFormData) => {
    setIsSubmitting(true)

    try {
      await adminService.createPost({
        title: data.title,
        excerpt: data.excerpt || undefined,
        content: data.content,
        cover_image_url: data.cover_image_url || undefined,
        category: data.category || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
      })

      toast.success('Post criado como rascunho!')
      router.push('/admin?tab=posts')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar post')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mostrar loading apenas durante verificação inicial de auth
  if (isAuthLoading && !hasCheckedAuth) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!user || user.role !== 'admin') {
    return null
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
