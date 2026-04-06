import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { SEO } from '@/components/seo'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useUser } from '@/features/auth/hooks/use-user'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'

type Material = {
  slug: string
  title: string
  description?: string | null
  category: string
  mime_type: 'pdf' | 'xls' | 'xlsx' | 'xlsm' | 'docx' | 'csv'
}

const EXT_BY_MIME: Record<Material['mime_type'], string> = {
  pdf: 'pdf',
  xls: 'xls',
  xlsx: 'xlsx',
  xlsm: 'xlsm',
  docx: 'docx',
  csv: 'csv',
}

const ICON_BY_MIME: Record<Material['mime_type'], typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  xlsm: FileSpreadsheet,
  csv: FileSpreadsheet,
}

const toSafeFilename = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'material'

export default function MaterialsPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useUser()
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  const navigate = useNavigate()
  const location = useLocation()
  const isAppRoute = location.pathname.startsWith('/app/')

  const groupTitleClassName = isAppRoute
    ? 'text-lg font-semibold tracking-tight text-foreground'
    : 'text-2xl font-bold tracking-tight'

  const requestAuth = useCallback(() => {
    if (outletContext?.openRegisterModal) {
      outletContext.openRegisterModal()
      return
    }

    navigate(`/?redirect=${encodeURIComponent(location.pathname)}`, { replace: true })
  }, [location.pathname, navigate, outletContext])
  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [downloadingSlug, setDownloadingSlug] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await fetchWithCredentials(`${API_URL}/materials/list`, { method: 'GET' })
        if (!res.ok) throw new Error('Erro ao carregar materiais')
        const data = (await res.json()) as Material[]
        setMaterials(Array.isArray(data) ? data : [])
      } catch {
        setMaterials([])
        toast.error('Erro ao carregar materiais')
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>()
    for (const item of materials) {
      const key = item.category || 'Outros'
      const arr = map.get(key) || []
      arr.push(item)
      map.set(key, arr)
    }
    const groups = [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    for (const [, items] of groups) {
      items.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    }
    return groups
  }, [materials])

  const handleDownload = useCallback(
    async (item: Material) => {
      if (!isAuthenticated) {
        requestAuth()
        return
      }

      const slug = encodeURIComponent(item.slug)
      const url = `${API_URL}/materials/${slug}/download-url`

      setDownloadingSlug(item.slug)
      try {
        // Get the signed download URL from backend
        const res = await fetchWithCredentials(url, { method: 'GET' })
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            requestAuth()
            return
          }
          throw new Error('Falha ao obter URL de download')
        }

        const data = await res.json()
        const downloadUrl = data.download_url

        if (!downloadUrl) {
          throw new Error('URL de download inválida')
        }

        // Download file directly via anchor tag (no CORS issues)
        const element = document.createElement('a')
        const ext = EXT_BY_MIME[item.mime_type] || 'pdf'
        const baseName = toSafeFilename(item.title || item.slug)

        element.href = downloadUrl
        element.download = `${baseName}.${ext}`
        element.target = '_blank'
        element.rel = 'noopener noreferrer'
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)

        toast.success('Download iniciado!')
      } catch {
        toast.error('Erro ao baixar material. Tente novamente.')
      } finally {
        setDownloadingSlug(null)
      }
    },
    [isAuthenticated, requestAuth]
  )

  if (isAuthLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  const content = isLoading ? (
    <div className="py-12 flex justify-center">
      <LoadingSpinner size="lg" />
    </div>
  ) : materials.length === 0 ? (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-muted-foreground">Nenhum material disponível no momento.</p>
    </div>
  ) : (
    <div className="space-y-10">
      {grouped.map(([groupName, items]) => (
        <section key={groupName} className="space-y-4">
          <h2 className={groupTitleClassName}>{groupName}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const Icon = ICON_BY_MIME[item.mime_type] || FileText

              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => handleDownload(item)}
                  disabled={downloadingSlug === item.slug}
                  className="group text-left rounded-xl border border-border bg-card p-5 hover:bg-muted/30 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors disabled:opacity-60"
                  title={item.title}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-muted-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold truncate">{item.title}</h3>
                        <span className="inline-flex items-center gap-2 p-1 text-sm text-muted-foreground transition-all duration-200 group-hover:text-primary group-focus-visible:text-primary group-hover:scale-105">
                          {downloadingSlug === item.slug ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Download className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5 group-hover:scale-110" />
                          )}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )

  if (isAppRoute) {
    return (
      <div className="space-y-6">
        <SEO title="Materiais Jurídicos" noindex />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Materiais</h1>
          <p className="text-muted-foreground mt-1">
            Materiais complementares organizados por tema, com download direto.
          </p>
        </div>

        {content}
      </div>
    )
  }

  return (
    <div className="pt-24">
      <SEO title="Materiais Jurídicos" description="Biblioteca de materiais jurídicos gratuitos para advogados." ogUrl="https://processai.app.br/materiais" />
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
              Materiais Complementares
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Materiais de apoio organizados por tema, com download direto.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        {content}
      </div>
    </div>
  )
}
