import { Edit, RefreshCw, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { cn } from '@/lib/utils'
import type { FeedbackResponse } from '@/services/feedback-service'

interface FeedbacksTabProps {
  feedbacks: FeedbackResponse[]
  isFeedbacksLoading: boolean
  feedbacksPage: number
  feedbacksPageSize: number
  feedbacksTotal: number
  feedbackStatusFilter: string
  feedbackSortOrder: 'asc' | 'desc'
  selectedFeedback: FeedbackResponse | null
  isEditStatusDialogOpen: boolean
  isViewFeedbackDialogOpen: boolean
  isUpdatingFeedback: boolean
  feedbackStatus: FeedbackResponse['status']
  onLoadFeedbacks: (page?: number, pageSize?: number) => void
  onFeedbackStatusFilterChange: (value: string) => void
  onFeedbackSortOrderChange: (value: 'asc' | 'desc') => void
  onOpenEditStatusDialog: (feedback: FeedbackResponse, e: React.MouseEvent) => void
  onOpenViewFeedbackDialog: (feedback: FeedbackResponse) => void
  onSetIsEditStatusDialogOpen: (open: boolean) => void
  onSetIsViewFeedbackDialogOpen: (open: boolean) => void
  onSetSelectedFeedback: (feedback: FeedbackResponse | null) => void
  onFeedbackStatusChange: (value: FeedbackResponse['status']) => void
  onUpdateFeedbackStatus: () => void
}

export default function FeedbacksTab({
  feedbacks,
  isFeedbacksLoading,
  feedbacksPage,
  feedbacksPageSize,
  feedbacksTotal,
  feedbackStatusFilter,
  feedbackSortOrder,
  selectedFeedback,
  isEditStatusDialogOpen,
  isViewFeedbackDialogOpen,
  isUpdatingFeedback,
  feedbackStatus,
  onLoadFeedbacks,
  onFeedbackStatusFilterChange,
  onFeedbackSortOrderChange,
  onOpenEditStatusDialog,
  onOpenViewFeedbackDialog,
  onSetIsEditStatusDialogOpen,
  onSetIsViewFeedbackDialogOpen,
  onSetSelectedFeedback,
  onFeedbackStatusChange,
  onUpdateFeedbackStatus,
}: FeedbacksTabProps) {
  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">Gerenciar Feedbacks</h2>
          <div className="flex items-center gap-2">
            <Select
              value={feedbackStatusFilter}
              onValueChange={onFeedbackStatusFilterChange}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="in_progress">Em Progresso</SelectItem>
                <SelectItem value="done">Concluído</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => onLoadFeedbacks()} disabled={isFeedbacksLoading}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <CardContent className="p-0">
            {isFeedbacksLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Usuário</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Conteúdo</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Origem</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => onFeedbackSortOrderChange(feedbackSortOrder === 'desc' ? 'asc' : 'desc')}>
                        <div className="flex items-center gap-1">
                          Data
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {feedbacks.map((f) => (
                      <tr
                        key={f.id}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => onOpenViewFeedbackDialog(f)}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium">{f.user_name || 'Usuário'}</p>
                            <p className="text-xs text-muted-foreground">{f.user_email || '-'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            f.type === 'bug' ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50" :
                            f.type === 'suggestion' ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50" :
                            "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800"
                          )}>
                            {f.type === 'bug' ? 'Problema' : f.type === 'suggestion' ? 'Sugestão' : 'Outro'}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-md truncate" title={f.content}>
                          {f.content}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          <span title={f.user_agent || ''}>{f.path || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            f.status === 'new' ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50" :
                            f.status === 'in_progress' ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900/50" :
                            f.status === 'done' ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50" :
                            "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800"
                          )}>
                            {f.status === 'new' ? 'Novo' : f.status === 'in_progress' ? 'Em Progresso' : f.status === 'done' ? 'Concluído' : 'Arquivado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(f.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            onClick={(e) => onOpenEditStatusDialog(f, e)}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {feedbacks.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">Nenhum feedback encontrado.</div>
                ) : null}
              </div>
            )}
          </CardContent>
          {feedbacks.length > 0 && !isFeedbacksLoading ? (
            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
              <div className="text-sm text-muted-foreground hidden sm:block">
                Mostrando {((feedbacksPage - 1) * feedbacksPageSize) + 1} a {Math.min(feedbacksPage * feedbacksPageSize, feedbacksTotal)} de {feedbacksTotal} resultados
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLoadFeedbacks(feedbacksPage - 1, feedbacksPageSize)}
                  disabled={feedbacksPage === 1 || isFeedbacksLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <div className="text-sm font-medium">
                  Página {feedbacksPage} de {Math.ceil(feedbacksTotal / feedbacksPageSize)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLoadFeedbacks(feedbacksPage + 1, feedbacksPageSize)}
                  disabled={feedbacksPage >= Math.ceil(feedbacksTotal / feedbacksPageSize) || isFeedbacksLoading}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Edit Status Dialog */}
      <Dialog
        open={isEditStatusDialogOpen}
        onOpenChange={(open) => {
          onSetIsEditStatusDialogOpen(open)
          if (!open) onSetSelectedFeedback(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Status</DialogTitle>
            <DialogDescription>
              Alterar o status do feedback de {selectedFeedback?.user_name || 'Usuário'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={feedbackStatus}
                onValueChange={(v) => onFeedbackStatusChange(v as FeedbackResponse['status'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedFeedback && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Conteúdo:</p>
                <p className="text-muted-foreground">{selectedFeedback.content}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onSetIsEditStatusDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={onUpdateFeedbackStatus} disabled={isUpdatingFeedback}>
              {isUpdatingFeedback ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Feedback Modal */}
      <Dialog
        open={isViewFeedbackDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            onSetIsViewFeedbackDialogOpen(false)
            onSetSelectedFeedback(null)
          } else {
            onSetIsViewFeedbackDialogOpen(true)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Feedback</DialogTitle>
            <DialogDescription>
              Enviado por {selectedFeedback?.user_name || 'Usuário'} em {selectedFeedback ? new Date(selectedFeedback.created_at).toLocaleDateString('pt-BR') : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                  <div className="mt-1">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                      selectedFeedback.type === 'bug' ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50" :
                      selectedFeedback.type === 'suggestion' ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50" :
                      "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800"
                    )}>
                      {selectedFeedback.type === 'bug' ? 'Problema' : selectedFeedback.type === 'suggestion' ? 'Sugestão' : 'Outro'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                      selectedFeedback.status === 'new' ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50" :
                      selectedFeedback.status === 'in_progress' ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900/50" :
                      selectedFeedback.status === 'done' ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50" :
                      "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800"
                    )}>
                      {selectedFeedback.status === 'new' ? 'Novo' : selectedFeedback.status === 'in_progress' ? 'Em Progresso' : selectedFeedback.status === 'done' ? 'Concluído' : 'Arquivado'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Conteúdo</label>
                <div className="mt-2 p-4 rounded-lg bg-muted border border-border whitespace-pre-wrap">
                  {selectedFeedback.content}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="mt-1 text-sm">{selectedFeedback.user_email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Origem (Path)</label>
                  <p className="mt-1 text-sm font-mono bg-muted px-2 py-1 rounded w-fit">{selectedFeedback.path || '-'}</p>
                </div>
              </div>

              {selectedFeedback.user_agent && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                  <p className="mt-1 text-xs text-muted-foreground break-all">{selectedFeedback.user_agent}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => onSetIsViewFeedbackDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
