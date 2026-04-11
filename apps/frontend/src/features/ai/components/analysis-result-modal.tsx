import DOMPurify from 'dompurify'
import { ChevronDown, Download, FileText, Lock, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBillingStore } from '@/stores/billing-store'

interface AnalysisResultModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  pdfUrl?: string
  htmlContent?: string
  onDownload?: () => void
  onDownloadDocx?: () => void
}

export function AnalysisResultModal({
  isOpen,
  onClose,
  title,
  pdfUrl,
  htmlContent,
  onDownload,
  onDownloadDocx
}: AnalysisResultModalProps) {
  const navigate = useNavigate()
  const canDownloadDocx = useBillingStore((state) => state.canDownloadDocx)
  const docxUnlocked = canDownloadDocx()
  const hasDocx = Boolean(onDownloadDocx)
  // Paid user but this specific job has no DOCX (pre-rollout job). Nothing to
  // upsell — just keep the item visually disabled.
  const docxDisabled = docxUnlocked && !hasDocx
  // Non-paid plan — always show the upgrade CTA even when the job has no DOCX,
  // because upgrading unlocks the feature for future jobs.
  const docxLocked = !docxUnlocked

  const handleDocxClick = () => {
    if (docxLocked) {
      onClose()
      navigate('/app/assinatura')
      return
    }
    if (hasDocx && onDownloadDocx) {
      onDownloadDocx()
    }
  }

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-9 px-4 font-medium hover:bg-primary/5 hover:text-primary border-primary/20"
                  >
                    <Download className="h-4 w-4" />
                    Exportar
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={onDownload}
                    className="gap-2 cursor-pointer py-2"
                  >
                    <FileText className="h-4 w-4 text-rose-500" />
                    <span className="font-medium">Exportar PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDocxClick}
                    disabled={docxDisabled}
                    className="gap-2 cursor-pointer py-2"
                  >
                    <FileText
                      className={
                        docxDisabled || docxLocked
                          ? 'h-4 w-4 text-muted-foreground'
                          : 'h-4 w-4 text-sky-600'
                      }
                    />
                    <span
                      className={
                        docxDisabled || docxLocked
                          ? 'font-medium text-muted-foreground'
                          : 'font-medium'
                      }
                    >
                      Exportar DOCX
                    </span>
                    {docxLocked && (
                      <span className="ml-auto flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <Lock className="h-2.5 w-2.5" />
                        Upgrade
                      </span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
