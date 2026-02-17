import { useState } from 'react'
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
import { toast } from 'sonner'
import { notificationService, type NotificationCreate } from '@/services/notification-service'

export default function NotificationsTab() {
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false)
  const [notificationType, setNotificationType] = useState<NotificationCreate['type']>('system')
  const [notificationRecipient, setNotificationRecipient] = useState<string>('all')
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationDescription, setNotificationDescription] = useState('')
  const [isSendingNotification, setIsSendingNotification] = useState(false)

  const handleSendNotification = async () => {
    if (!notificationTitle.trim()) {
      toast.error('O título é obrigatório')
      return
    }

    setIsSendingNotification(true)
    try {
      const result = await notificationService.create({
        type: notificationType,
        title: notificationTitle,
        description: notificationDescription || undefined,
        user_id: notificationRecipient === 'all' ? undefined : undefined,
      })

      toast.success(
        `Notificação enviada com sucesso para ${result.recipients.length} ${
          result.recipients.length === 1 ? 'usuário' : 'usuários'
        }`
      )

      setNotificationTitle('')
      setNotificationDescription('')
      setNotificationType('system')
      setNotificationRecipient('all')
      setIsNotificationModalOpen(false)
    } catch (error) {
      console.error('Failed to send notification:', error)
      toast.error('Erro ao enviar notificação')
    } finally {
      setIsSendingNotification(false)
    }
  }

  const handleCheckDeadlines = async () => {
    try {
      const result = await notificationService.checkDeadlines()
      toast.success(result.message || 'Prazos verificados com sucesso')
    } catch (error) {
      console.error('Failed to check deadlines:', error)
      toast.error('Erro ao verificar prazos')
    }
  }
  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">Gerenciar Notificações</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCheckDeadlines}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Prazos
            </Button>
            <Button onClick={() => setIsNotificationModalOpen(true)}>
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
      <Dialog open={isNotificationModalOpen} onOpenChange={setIsNotificationModalOpen}>
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
              <Select value={notificationType} onValueChange={(value) => setNotificationType(value as NotificationCreate['type'])}>
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
              <Select value={notificationRecipient} onValueChange={setNotificationRecipient}>
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
                onChange={(e) => setNotificationTitle(e.target.value)}
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
                onChange={(e) => setNotificationDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSendNotification}
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
