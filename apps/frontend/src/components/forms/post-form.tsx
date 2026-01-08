'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Save, Upload, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { CategorySelect } from '@/components/forms/category-select'

export interface PostFormData {
  title: string
  excerpt: string
  content: string
  cover_image_url: string
  category: string
  tags: string[]
}

interface PostFormProps {
  initialData?: Partial<PostFormData>
  onSubmit: (data: PostFormData) => Promise<void>
  isSubmitting?: boolean
  pageTitle: string
  pageSubtitle?: string
  headerActions?: React.ReactNode
  submitLabel?: string
}

export function PostForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  pageTitle,
  pageSubtitle,
  headerActions,
  submitLabel = 'Salvar',
}: PostFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isCoverPreviewHidden, setIsCoverPreviewHidden] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    cover_image_url: '',
    category: '',
  })
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Inicializa dados quando initialData muda
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        excerpt: initialData.excerpt || '',
        content: initialData.content || '',
        cover_image_url: initialData.cover_image_url || '',
        category: initialData.category || '',
      })
      setTags(initialData.tags || [])
    }
  }, [initialData])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida')
      return
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB')
      return
    }

    setIsUploadingImage(true)

    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setFormData((prev) => ({ ...prev, cover_image_url: base64String }))
        setIsCoverPreviewHidden(false)
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

    await onSubmit({
      ...formData,
      tags,
    })
  }

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
                <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
                {pageSubtitle && (
                  <p className="text-sm text-gray-500 mt-1">{pageSubtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Digite o título do artigo"
              required
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resumo
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Breve descrição do artigo (opcional)"
              rows={2}
            />
          </div>

          {/* Cover Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2 h-10"
                >
                  <Upload className="w-4 h-4" />
                  {isUploadingImage ? '...' : 'Upload'}
                </button>
                <input
                  type="url"
                  value={
                    formData.cover_image_url.startsWith('data:')
                      ? ''
                      : formData.cover_image_url
                  }
                  onChange={(e) => {
                    setFormData({ ...formData, cover_image_url: e.target.value })
                    setIsCoverPreviewHidden(false)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 h-10"
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
                      setFormData({ ...formData, cover_image_url: '' })
                      setIsCoverPreviewHidden(false)
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria
              </label>
              <div className="h-10">
                <CategorySelect
                  value={formData.category}
                  onChange={(value) => setFormData({ ...formData, category: value })}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 h-10"
                    placeholder="Digite uma tag..."
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2 h-10"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs"
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
            </div>
          </div>

          {/* Content (Markdown) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conteúdo <span className="text-red-600">*</span>
            </label>
            <MarkdownEditor
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              placeholder="Escreva o conteúdo do artigo aqui..."
            />
          </div>
        </form>
      </div>
    </div>
  )
}
