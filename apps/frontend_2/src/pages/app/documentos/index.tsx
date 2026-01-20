import { FileText, Search, Filter } from 'lucide-react'

export default function DocumentosPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Documentos</h1>
        <p className="text-muted-foreground mt-1">
          Documentos gerados pela IA e cálculos exportados.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
          Filtrar
        </button>
      </div>

      {/* Empty State */}
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Nenhum documento encontrado</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Seus documentos gerados pela IA e cálculos exportados em PDF aparecerão aqui.
        </p>
      </div>
    </div>
  )
}
