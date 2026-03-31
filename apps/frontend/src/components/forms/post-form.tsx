import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Upload, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { CategorySelect } from '@/components/forms/category-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/admin?tab=posts"
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">{pageTitle}</h1>
                {pageSubtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Título <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Digite o título do artigo"
                  required
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Resumo
                </label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className="w-full px-4 py-2.5 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Breve descrição do artigo (opcional)"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Cover Image Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Imagem de Capa
                </label>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="h-10"
                    >
                      <Upload className="w-4 h-4" />
                      {isUploadingImage ? 'Enviando...' : 'Upload'}
                    </Button>
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
                      className="flex-1 px-4 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring h-10"
                      placeholder="Ou cole uma URL de imagem"
                    />
                  </div>
                  {formData.cover_image_url && !isCoverPreviewHidden && (
                    <div className="relative">
                      <div className="relative w-full max-w-md h-48 rounded-lg border border-border overflow-hidden">
                        <img
                          src={formData.cover_image_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={() => setIsCoverPreviewHidden(true)}
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        onClick={() => {
                          setFormData({ ...formData, cover_image_url: '' })
                          setIsCoverPreviewHidden(false)
                        }}
                        className="absolute top-2 right-2 h-7 w-7"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Faça upload de uma imagem (max 5MB) ou cole uma URL
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
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
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tags</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagInputKeyDown}
                        className="flex-1 px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring h-10"
                        placeholder="Digite uma tag..."
                      />
                      <Button type="button" onClick={handleAddTag} className="h-10">
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground rounded-full text-xs"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:text-destructive"
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              {/* Content (Markdown) */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Conteúdo <span className="text-red-600">*</span>
                </label>
                <MarkdownEditor
                  value={formData.content}
                  onChange={(value) => setFormData({ ...formData, content: value })}
                  placeholder="Escreva o conteúdo do artigo aqui..."
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
