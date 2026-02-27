import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { type Process } from '@/services/processes-service'
import { Gavel, User } from 'lucide-react'

interface ProcessCardProps {
  process: Process
  isDragging?: boolean
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  pending: 'bg-amber-500',
  suspended: 'bg-orange-500',
  concluded: 'bg-blue-500',
  archived: 'bg-muted-foreground',
  cancelled: 'bg-red-500',
}

export function ProcessCard({ process, isDragging }: ProcessCardProps) {
  const navigate = useNavigate()

  if (isDragging) {
    return (
      <div className="opacity-50 h-[110px] rounded-xl border-2 border-primary bg-background" />
    )
  }

  const dotClass = STATUS_DOT[process.status] ?? STATUS_DOT['active']

  return (
    <div
      onClick={() => navigate(`/app/processos/${process.id}`)}
      className={cn(
        'group cursor-pointer rounded-lg border border-border bg-card p-3 space-y-2',
        'hover:border-primary/50 hover:shadow-md transition-all duration-150',
      )}
    >
      {/* Número + indicador de status */}
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', dotClass)} />
        <p className="font-mono text-sm font-semibold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {process.process_number}
        </p>
      </div>

      {/* Tipo do processo */}
      <p className="text-xs text-muted-foreground truncate pl-3.5" title={process.type}>
        {process.type}
      </p>

      {/* Divisor */}
      <div className="border-t border-border" />

      {/* Rodapé: cliente e vara */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{process.client_name || 'Sem cliente'}</span>
        </div>
        {process.court && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gavel className="h-3 w-3 shrink-0" />
            <span className="truncate">{process.court}</span>
          </div>
        )}
      </div>
    </div>
  )
}
