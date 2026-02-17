import { Plus, RefreshCw, Bell, CheckCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

interface NotificationsTabProps {
  isNotificationModalOpen: boolean
  notificationType: string
  notificationRecipient: string
  notificationTitle: string
  notificationDescription: string
  isSendingNotification: boolean
  onSetIsNotificationModalOpen: (open: boolean) => void
  onNotificationTypeChange: (value: string) => void
  onNotificationRecipientChange: (value: string) => void
  onNotificationTitleChange: (value: string) => void
  onNotificationDescriptionChange: (value: string) => void
  onCheckDeadlines: () => Promise<void>
  onSendNotification: () => Promise<void>
}

export default function NotificationsTab({
  isNotificationModalOpen,
  notificationType,
  notificationRecipient,
  notificationTitle,
  notificationDescription,
  isSendingNotification,
  onSetIsNotificationModalOpen,
  onNotificationTypeChange,
  onNotificationRecipientChange,
  onNotificationTitleChange,
  onNotificationDescriptionChange,
  onCheckDeadlines,
  onSendNotification,
}: NotificationsTabProps) {
  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">Gerenciar Notificações</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCheckDeadlines}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Prazos
            </Button>
            <Button onClick={() => onSetIsNotificationModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Notificação
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-sm text-muted-foreground">Total enviadas</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-sm text-muted-foreground">Lidas</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Bell className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-sm text-muted-foreground">Não lidas</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Histórico */}
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle>Histórico de Notificações Enviadas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma notificação enviada ainda.</p>
              <p className="text-sm mt-1">As notificações enviadas aparecerão aqui.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Notification Dialog */}
      <Dialog open={isNotificationModalOpen} onOpenChange={onSetIsNotificationModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Nova Notificação</DialogTitle>
            <DialogDescription>
              Envie notificações para os usuários da plataforma
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Tipo de Notificação
              </label>
              <Select value={notificationType} onValueChange={onNotificationTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="blog">Blog</SelectItem>
                  <SelectItem value="feature">Nova Funcionalidade</SelectItem>
                  <SelectItem value="deadline">Prazo</SelectItem>
                  <SelectItem value="process">Processo</SelectItem>
                  <SelectItem value="calculation">Cálculo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Destinatários
              </label>
              <Select value={notificationRecipient} onValueChange={onNotificationRecipientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Quem receberá" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Título <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Ex: Nova funcionalidade disponível"
                value={notificationTitle}
                onChange={(e) => onNotificationTitleChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Descrição
              </label>
              <textarea
                className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground resize-none"
                rows={3}
                placeholder="Detalhes da notificação..."
                value={notificationDescription}
                onChange={(e) => onNotificationDescriptionChange(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={onSendNotification}
              disabled={isSendingNotification || !notificationTitle.trim()}
              className="w-full"
            >
              {isSendingNotification ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Notificação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
