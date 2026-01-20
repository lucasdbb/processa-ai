import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

const CATEGORIES = [
  { name: 'Direito Trabalhista', slug: 'direito-trabalhista' },
  { name: 'Direito Previdenciário', slug: 'direito-previdenciario' },
  { name: 'Direito Civil', slug: 'direito-civil' },
  { name: 'Direito do Consumidor', slug: 'direito-do-consumidor' },
  { name: 'Direito Penal', slug: 'direito-penal' },
  { name: 'Direito Tributário', slug: 'direito-tributario' },
  { name: 'Direito Empresarial', slug: 'direito-empresarial' },
  { name: 'Direito Imobiliário', slug: 'direito-imobiliario' },
  { name: 'Direito de Família', slug: 'direito-de-familia' },
  { name: 'Direito Administrativo', slug: 'direito-administrativo' },
]

export default function AdminNewPostPage() {
  const { isAdmin, isLoading } = useUser()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isCoverPreviewHidden, setIsCoverPreviewHidden] = useState(false)

  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const previewHtml = useMemo(() => {
    if (!content.trim()) return ''
    return DOMPurify.sanitize(marked.parse(content) as string)
  }, [content])

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && content.trim().length > 0
  }, [content, title])

  const selectedCategory = useMemo(() => {
    return CATEGORIES.find((cat) => cat.slug === categorySlug)
  }, [categorySlug])

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

  const addTag = () => {
    const next = tagInput.trim()
    if (!next) return
    if (tags.includes(next)) {
      toast.error('Tag já adicionada')
      return
    }
    setTags((prev) => [...prev, next])
    setTagInput('')
  }

  const removeTag = (value: string) => {
    setTags((prev) => prev.filter((t) => t !== value))
  }

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
        setCoverImageUrl(base64String)
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

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Preencha pelo menos título e conteúdo')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        content: content.trim(),
        cover_image_url: coverImageUrl.trim() || undefined,
        category: categorySlug.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
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
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin?tab=posts" className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Voltar">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Novo Artigo</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                type="button"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : 'Salvar Rascunho'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Digite o título do artigo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resumo</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Breve descrição do artigo (opcional)"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagem de Capa</label>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
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
                  value={coverImageUrl.startsWith('data:') ? '' : coverImageUrl}
                  onChange={(e) => {
                    setCoverImageUrl(e.target.value)
                    setIsCoverPreviewHidden(false)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 h-10"
                  placeholder="Ou cole uma URL de imagem"
                />
              </div>

              {coverImageUrl && !isCoverPreviewHidden ? (
                <div className="relative">
                  <div className="relative w-full max-w-md h-48 rounded-lg border border-gray-200 overflow-hidden bg-white">
                    <img
                      src={coverImageUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                      onError={() => setIsCoverPreviewHidden(true)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl('')
                      setIsCoverPreviewHidden(false)
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : null}
            </div>

            <p className="mt-2 text-sm text-gray-500">Faça upload de uma imagem (max 5MB) ou cole uma URL</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <div className="space-y-2">
                <select
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white h-10"
                >
                  <option value="">Selecione uma categoria</option>
                  {CATEGORIES.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {selectedCategory ? (
                  <p className="text-xs text-gray-500">
                    Slug da categoria: <code className="bg-gray-100 px-1 rounded">{selectedCategory.slug}</code>
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      addTag()
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 h-10"
                    placeholder="Digite uma tag..."
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2 h-10"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs"
                      >
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conteúdo <span className="text-red-600">*</span>
            </label>
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="border-b border-gray-200 md:border-b-0 md:border-r border-gray-200">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full min-h-[500px] p-4 outline-none focus:outline-none font-mono text-sm"
                    placeholder="Escreva o conteúdo do artigo aqui..."
                    required
                  />
                </div>
                <div className="min-h-[500px] p-4 overflow-auto">
                  {previewHtml ? (
                    <div className="prose prose-lg prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  ) : (
                    <div className="text-sm text-gray-500">Nada para pré-visualizar.</div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 border-t border-gray-300 px-4 py-2 text-xs text-gray-600">
                <p>
                  <strong>Dica:</strong> A visualização é atualizada automaticamente.
                </p>
                <p>
                  <strong>Quebra de linha:</strong> Para criar um novo parágrafo, deixe uma linha em branco entre os textos.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
