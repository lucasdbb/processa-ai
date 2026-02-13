import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, MessageSquarePlus, Bug, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { feedbackService } from '@/services/feedback-service'
import { cn } from '@/lib/utils'

interface FeedbackFormDialogProps {
  isOpen: boolean
  onClose: () => void
}

type FeedbackType = 'suggestion' | 'bug' | 'other'

export function FeedbackFormDialog({ isOpen, onClose }: FeedbackFormDialogProps) {
  const [type, setType] = useState<FeedbackType>('suggestion')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      toast.error('Por favor, descreva sua sugestão ou problema.')
      return
    }

    setIsSubmitting(true)

    try {
      await feedbackService.create({
        type,
        content,
        path: window.location.pathname,
        user_agent: navigator.userAgent,
      })

      toast.success('Obrigado pelo seu feedback!')
      setContent('')
      setType('suggestion')
      onClose()
    } catch {
      toast.error('Erro ao enviar feedback. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Feedback</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Que tipo de feedback é esse?
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setType('suggestion')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                  type === 'suggestion'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <MessageSquarePlus className="h-5 w-5" />
                <span className="text-xs font-medium">Sugestão</span>
              </button>
              <button
                type="button"
                onClick={() => setType('bug')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                  type === 'bug'
                    ? 'border-red-500 bg-red-500/5 text-red-600'
                    : 'border-border hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <Bug className="h-5 w-5" />
                <span className="text-xs font-medium">Problema</span>
              </button>
              <button
                type="button"
                onClick={() => setType('other')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                  type === 'other'
                    ? 'border-blue-500 bg-blue-500/5 text-blue-600'
                    : 'border-border hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <HelpCircle className="h-5 w-5" />
                <span className="text-xs font-medium">Outro</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Descrição
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                type === 'suggestion'
                  ? 'Conte-nos qual funcionalidade você gostaria de ver...'
                  : type === 'bug'
                  ? 'O que aconteceu? O que você esperava que acontecesse?'
                  : 'Como podemos ajudar?'
              }
              rows={5}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Seu feedback será analisado diretamente pela nossa equipe de produto.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
