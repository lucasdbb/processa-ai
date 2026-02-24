import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

export function ServiceCard({ service, isDragging }: ServiceCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  if (isDragging) {
    return (
      <div
        className={cn(
          'opacity-50 h-[150px] rounded-xl border-2 border-primary bg-background',
        )}
      />
    )
  }

  return (
    <Card className="cursor-grab hover:border-primary/50 hover:shadow-md transition-all">
      <CardHeader className="p-3 pb-0 space-y-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium leading-tight line-clamp-2">
            {service.name}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px] h-5 px-1.5">
            {CATEGORY_LABELS[service.category] || service.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2 space-y-2">
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
      </CardContent>
    </Card>
  )
}
