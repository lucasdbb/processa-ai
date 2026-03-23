import DOMPurify from 'dompurify'
import { Download, X } from 'lucide-react'
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AnalysisResultModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  pdfUrl?: string
  htmlContent?: string
  onDownload?: () => void
}

export function AnalysisResultModal({
  isOpen,
  onClose,
  title,
  pdfUrl,
  htmlContent,
  onDownload
}: AnalysisResultModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/20 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-primary rounded-full" />
            <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">
              {title}
            </DialogTitle>
          </div>
          
          <div className="flex items-center gap-3">
            {onDownload && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onDownload}
                className="gap-2 h-9 px-4 font-medium hover:bg-primary/5 hover:text-primary border-primary/20"
              >
                <Download className="h-4 w-4" />
                Baixar PDF
              </Button>
            )}
            <DialogClose asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative bg-muted/5">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-none"
              title="Resultado da Análise"
            />
          ) : htmlContent ? (
            <div className="h-full overflow-y-auto p-8 bg-dot-pattern">
              <div 
                className="prose prose-slate dark:prose-invert max-w-3xl mx-auto bg-card p-10 rounded-xl shadow-lg border border-border/60"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Nenhum conteúdo disponível
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
