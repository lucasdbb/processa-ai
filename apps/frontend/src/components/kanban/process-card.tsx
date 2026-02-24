import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { type Process } from '@/services/processes-service'
import { Gavel, User } from 'lucide-react'

interface ProcessCardProps {
  process: Process
  isDragging?: boolean
}

export function ProcessCard({ process, isDragging }: ProcessCardProps) {
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
            {process.process_number}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px] h-5 px-1.5">
            {process.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2 space-y-2">
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
      </CardContent>
    </Card>
  )
}
