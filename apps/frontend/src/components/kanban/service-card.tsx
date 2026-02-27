import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { type Service } from '@/services/services-service'
import { User, DollarSign } from 'lucide-react'

interface ServiceCardProps {
  service: Service
  isDragging?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  previdenciario: 'Previdenciário',
  trabalhista: 'Trabalhista',
  civel: 'Cível',
  tributario: 'Tributário',
  familiar: 'Familiar',
  empresarial: 'Empresarial',
  imobiliario: 'Imobiliário',
  administrativo: 'Administrativo',
  consultoria: 'Consultoria',
  outro: 'Outro',
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500',
}

export function ServiceCard({ service, isDragging }: ServiceCardProps) {
  const navigate = useNavigate()

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  if (isDragging) {
    return (
      <div className="opacity-50 h-[110px] rounded-xl border-2 border-primary bg-background" />
    )
  }

  const dotClass = STATUS_DOT[service.status] ?? STATUS_DOT['active']
  const categoryLabel = CATEGORY_LABELS[service.category] || service.category

  return (
    <div
      onClick={() => navigate(`/app/servicos/${service.id}`)}
      className={cn(
        'group cursor-pointer rounded-lg border border-border bg-card p-3 space-y-2',
        'hover:border-primary/50 hover:shadow-md transition-all duration-150',
      )}
    >
      {/* Nome + indicador de status */}
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', dotClass)} />
        <p className="text-sm font-semibold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {service.name}
        </p>
      </div>

      {/* Categoria */}
      <p className="text-xs text-muted-foreground truncate pl-3.5" title={categoryLabel}>
        {categoryLabel}
      </p>

      {/* Divisor */}
      <div className="border-t border-border" />

      {/* Rodapé: cliente e valor */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{service.client_name || 'Sem cliente'}</span>
        </div>
        {service.value !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatCurrency(service.value)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
