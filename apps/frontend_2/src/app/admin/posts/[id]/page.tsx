'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { adminService, type BlogPostDetail } from '@/features/blog/services/admin-service'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { toast } from 'sonner'
import { ArrowLeft, Save, Eye, Archive, Upload, X, Plus } from 'lucide-react'
import Link from 'next/link'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { CategorySelect } from '@/components/forms/category-select'
import Image from 'next/image'

export default function EditPostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string

  const { user, isLoading: isAuthLoading } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [post, setPost] = useState<BlogPostDetail | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    cover_image_url: '',
    category: '',
  })
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isCoverPreviewHidden, setIsCoverPreviewHidden] = useState(false)

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
      setFormData({
        title: data.title,
        excerpt: data.excerpt || '',
        content: data.content,
        cover_image_url: data.cover_image_url || '',
        category: data.category_slug || '',
      })
      setTags(data.tags || [])
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB')
      return
    }

    setIsUploadingImage(true)

    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setIsCoverPreviewHidden(false)
        setFormData({ ...formData, cover_image_url: base64String })
        toast.success('Imagem carregada!')
      }
      reader.onerror = () => {
        toast.error('Erro ao ler arquivo')
      }
      reader.readAsDataURL(file)
    } catch {
      toast.error('Erro ao processar imagem')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim()
    if (!trimmedTag) return

    if (tags.includes(trimmedTag)) {
      toast.error('Tag já adicionada')
      return
    }

    setTags([...tags, trimmedTag])
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Título é obrigatório')
      return
    }

    if (!formData.content.trim()) {
      toast.error('Conteúdo é obrigatório')
      return
    }

    setIsSubmitting(true)

    try {
      await adminService.updatePost(postId, {
        title: formData.title,
        excerpt: formData.excerpt || undefined,
        content: formData.content,
        cover_image_url: formData.cover_image_url || undefined,
        category: formData.category || undefined,
        tags: tags.length > 0 ? tags : undefined,
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

    if (!confirm('Tem certeza que deseja arquivar este post?')) {
      return
    }

    try {
      await adminService.deletePost(postId)
      toast.success('Post arquivado!')
      router.push('/admin?tab=posts')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao arquivar post')
    }
  }

  // Mostrar loading apenas durante verificação inicial de auth ou carregamento do post
  if ((isAuthLoading && !hasCheckedAuth) || (hasCheckedAuth && isLoading)) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!user || user.role !== 'admin' || !post) {
    return null
  }

  const isPublished = post.published_at !== undefined && post.published_at !== null

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin?tab=posts"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Editar Artigo</h1>
                <p className="text-sm text-gray-500 mt-1">/{post.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-lg"
              placeholder="Digite o título do artigo"
              required
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resumo
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Breve descrição do artigo (opcional)"
              rows={3}
            />
          </div>

          {/* Cover Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imagem de Capa
            </label>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isUploadingImage ? 'Processando...' : 'Fazer Upload'}
                </button>
                <input
                  type="url"
                  value={formData.cover_image_url.startsWith('data:') ? '' : formData.cover_image_url}
                  onChange={(e) => {
                    setIsCoverPreviewHidden(false)
                    setFormData({ ...formData, cover_image_url: e.target.value })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Ou cole uma URL de imagem"
                />
              </div>
              {formData.cover_image_url && !isCoverPreviewHidden && (
                <div className="relative">
                  <div className="relative w-full max-w-md h-48 rounded-lg border border-gray-200 overflow-hidden">
                    <Image
                      src={formData.cover_image_url}
                      alt="Preview"
                      fill
                      sizes="(max-width: 768px) 100vw, 448px"
                      className="object-cover"
                      unoptimized
                      onError={() => setIsCoverPreviewHidden(true)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCoverPreviewHidden(false)
                      setFormData({ ...formData, cover_image_url: '' })
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Faça upload de uma imagem (max 5MB) ou cole uma URL
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <CategorySelect
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value })}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Digite uma tag e pressione Enter"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Adicione tags para facilitar a busca e organização dos artigos
            </p>
          </div>

          {/* Content (Markdown) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conteúdo <span className="text-red-600">*</span>
            </label>
            <MarkdownEditor
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              placeholder="Escreva o conteúdo do artigo aqui..."
            />
          </div>

          {/* Post Info */}
          <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
            <p>
              <strong>Status:</strong> {isPublished ? 'Publicado' : 'Rascunho'}
            </p>
            {post.published_at && (
              <p className="mt-1">
                <strong>Publicado em:</strong>{' '}
                {new Date(post.published_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            {post.authors && post.authors.length > 0 && (
              <p className="mt-1">
                <strong>Autor:</strong> {post.authors[0].name || 'Sem nome'}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
