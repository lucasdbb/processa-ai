import { useCallback, useEffect, useState } from 'react'
import { FileText, Search, Filter, Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

type DocumentType = 'ai_analysis' | 'calculation' | 'petition' | 'contract' | 'other'
type DocumentStatus = 'draft' | 'final' | 'archived'

type Document = {
  id: string
  name: string
  type: DocumentType
  status: DocumentStatus
  file_url: string | null
  file_size: number | null
  mime_type: string | null
  process_id: string | null
  client_id: string | null
  description: string | null
  created_at: string
  updated_at: string
}

type DocumentListResponse = {
  documents: Document[]
  total: number
}

type ClientOption = {
  id: string
  name: string
}

type ClientListResponse = {
  clients: ClientOption[]
  total: number
}

const TYPE_LABELS: Record<DocumentType, string> = {
  ai_analysis: 'Analise IA',
  calculation: 'Calculo',
  petition: 'Peticao',
  contract: 'Contrato',
  other: 'Outro',
}

const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Rascunho',
  final: 'Final',
  archived: 'Arquivado',
}

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'bg-yellow-500/10 text-yellow-600',
  final: 'bg-green-500/10 text-green-600',
  archived: 'bg-muted text-muted-foreground',
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DocumentosPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | ''>('')
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('')
  const [clientFilter, setClientFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [documents, setDocuments] = useState<Document[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const [clients, setClients] = useState<ClientOption[]>([])

  // Fetch clients for the filter dropdown
  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await fetchWithCredentials(`${API_URL}/office/clients?limit=100`)
        if (!res.ok) return
        const data = (await res.json()) as ClientListResponse
        setClients(data.clients)
      } catch {
        // Silently fail - filter just won't have client options
      }
    }

    void loadClients()
  }, [])

  const fetchDocuments = useCallback(async (searchQuery: string, type: string, status: string, clientId: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (type) params.set('type', type)
      if (status) params.set('status', status)
      if (clientId) params.set('client_id', clientId)
      params.set('limit', '50')
      params.set('offset', '0')

      const res = await fetchWithCredentials(`${API_URL}/office/documents?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar documentos')

      const data = (await res.json()) as DocumentListResponse
      setDocuments(data.documents)
      setTotal(data.total)
    } catch {
      setDocuments([])
      setTotal(0)
      toast.error('Erro ao carregar documentos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchDocuments(search, typeFilter, statusFilter, clientFilter)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, typeFilter, statusFilter, clientFilter, fetchDocuments])

  const hasActiveFilters = typeFilter || statusFilter || clientFilter

  const clearFilters = () => {
    setTypeFilter('')
    setStatusFilter('')
    setClientFilter('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Documentos</h1>
        <p className="text-muted-foreground mt-1">
          Documentos gerados pela IA e cálculos exportados.
        </p>
      </div>

      {/* Search and Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar documentos..."
            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium transition-colors',
            showFilters || hasActiveFilters
              ? 'bg-slate-900 text-white border-slate-900'
              : 'text-foreground hover:bg-muted'
          )}
        >
          <Filter className="h-4 w-4" />
          Filtrar
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-white" />
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as DocumentType | '')}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none text-foreground"
              >
                <option value="">Todos os tipos</option>
                {(Object.keys(TYPE_LABELS) as DocumentType[]).map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | '')}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none text-foreground"
              >
                <option value="">Todos os status</option>
                {(Object.keys(STATUS_LABELS) as DocumentStatus[]).map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cliente</label>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none text-foreground"
              >
                <option value="">Todos os clientes</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum documento encontrado</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {search || hasActiveFilters
              ? 'Tente buscar com outros termos ou altere os filtros.'
              : 'Seus documentos gerados pela IA e cálculos exportados em PDF aparecerão aqui.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 sm:p-5 hover:bg-accent/50 transition-all duration-200 border-l-2 border-transparent hover:border-primary"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-muted rounded-lg shrink-0">
                    <FileText className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">{doc.name}</h3>
                      <span className={cn(
                        'px-1.5 py-0.5 text-[10px] font-bold uppercase rounded',
                        STATUS_COLORS[doc.status]
                      )}>
                        {STATUS_LABELS[doc.status]}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                        {TYPE_LABELS[doc.type]}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {doc.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(doc.created_at)}
                      {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                    </p>
                  </div>
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0"
                      title="Baixar documento"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination placeholder */}
      {documents.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Mostrando {documents.length} de {total} documentos</span>
        </div>
      )}
    </div>
  )
}
