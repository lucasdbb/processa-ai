import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users,
  FileText,
  LayoutDashboard,
  Shield,
  RefreshCw,
  ArrowLeft,
  XCircle,
  MessageSquare,
  Newspaper,
  Bell,
  Send,
} from 'lucide-react'
import OverviewTab from './admin/overview-tab'
import UsersTab from './admin/users-tab'
import PostsTab from './admin/posts-tab'
import MaterialsTab from './admin/materials-tab'
import FeedbacksTab from './admin/feedbacks-tab'
import NotificationsTab from './admin/notifications-tab'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { useUser } from '@/features/auth/hooks/use-user'
import { toast } from 'sonner'
import { feedbackService, type FeedbackResponse } from '@/services/feedback-service'
import type { NotificationCreate } from '@/services/notification-service'

type Tab = 'overview' | 'users' | 'posts' | 'materials' | 'feedbacks' | 'notifications'

const TABS_ADMIN: Tab[] = ['overview', 'users', 'posts', 'materials', 'feedbacks', 'notifications']
const TABS_AUTHOR: Tab[] = ['overview', 'posts']

const isTab = (value: string | null | undefined): value is Tab =>
  value === 'overview' || value === 'users' || value === 'posts' || value === 'materials' || value === 'feedbacks' || value === 'notifications'


export default function AdminPage() {
  const { user, isAdmin, isAuthor, isLoading: authLoading } = useUser()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const allowedTabs = isAdmin ? TABS_ADMIN : TABS_AUTHOR
  const initialTabFromUrl = searchParams.get('tab')
  const initialTab: Tab = isTab(initialTabFromUrl) && allowedTabs.includes(initialTabFromUrl)
    ? initialTabFromUrl
    : allowedTabs[0]

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [error, setError] = useState<string | null>(null)

  const [feedbacks, setFeedbacks] = useState<FeedbackResponse[]>([])
  const [isFeedbacksLoading, setIsFeedbacksLoading] = useState(false)
  const [feedbacksPage, setFeedbacksPage] = useState(1)
  const [feedbacksPageSize, setFeedbacksPageSize] = useState(10)
  const [feedbacksTotal, setFeedbacksTotal] = useState(0)
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>('all')
  const [feedbackSortOrder, setFeedbackSortOrder] = useState<'asc' | 'desc'>('desc')

  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackResponse | null>(null)
  const [isEditStatusDialogOpen, setIsEditStatusDialogOpen] = useState(false)
  const [isViewFeedbackDialogOpen, setIsViewFeedbackDialogOpen] = useState(false)
  const [isUpdatingFeedback, setIsUpdatingFeedback] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackResponse['status']>('new')

  // Notifications state
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false)
  const [notificationType, setNotificationType] = useState<NotificationCreate['type']>('system')
  const [notificationRecipient, setNotificationRecipient] = useState<string>('all')
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationDescription, setNotificationDescription] = useState('')
  const [isSendingNotification, setIsSendingNotification] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAdmin && !isAuthor) {
      navigate('/')
    }
  }, [authLoading, isAdmin, isAuthor, navigate])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (isTab(tab) && allowedTabs.includes(tab)) {
      setActiveTab(tab)
      return
    }
    setActiveTab((current) => (allowedTabs.includes(current) ? current : allowedTabs[0]))
  }, [allowedTabs, searchParams])

  const setTab = (next: Tab) => {
    if (!allowedTabs.includes(next)) return
    setActiveTab(next)
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev)
      nextParams.set('tab', next)
      return nextParams
    })
  }

  const loadFeedbacks = useCallback(async (page = 1, pageSize = 10) => {
    setIsFeedbacksLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const data = await feedbackService.getAll(pageSize, offset, feedbackStatusFilter, feedbackSortOrder)
      // Handle potential backend mismatch or legacy format
      const items = data.items || (Array.isArray(data) ? data : [])
      const total = typeof data.total === 'number' ? data.total : items.length
      
      setFeedbacks(items)
      setFeedbacksTotal(total)
      setFeedbacksPage(page)
      setFeedbacksPageSize(pageSize)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar feedbacks'
      setFeedbacks([])
      setFeedbacksTotal(0)
      setError(message)
      toast.error(message)
    } finally {
      setIsFeedbacksLoading(false)
    }
  }, [feedbackStatusFilter, feedbackSortOrder])

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin && !isAuthor) return
    if (isAdmin) {
      void loadFeedbacks()
    }
  }, [authLoading, isAdmin, isAuthor, loadFeedbacks])

  const handleUpdateFeedbackStatus = async () => {
    if (!selectedFeedback) return
    setIsUpdatingFeedback(true)
    try {
      await feedbackService.update(selectedFeedback.id, { status: feedbackStatus })
      toast.success('Status do feedback atualizado!')
      setFeedbacks((prev) => prev.map((f) => (f.id === selectedFeedback.id ? { ...f, status: feedbackStatus } : f)))
      setIsEditStatusDialogOpen(false)
      setSelectedFeedback(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setIsUpdatingFeedback(false)
    }
  }

  const openEditStatusDialog = (f: FeedbackResponse, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Update state synchronously to ensure dialog gets correct data
    setFeedbackStatus(f.status)
    setSelectedFeedback(f)
    setIsEditStatusDialogOpen(true)
  }

  const openViewFeedbackDialog = (f: FeedbackResponse) => {
    setSelectedFeedback(f)
    setIsViewFeedbackDialogOpen(true)
  }

  if (authLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAdmin && !isAuthor) {
    return null
  }

  const handleSendNotification = async () => {
    if (!notificationTitle.trim()) {
      toast.error('O título é obrigatório')
      return
    }

    setIsSendingNotification(true)
    try {
      const { notificationService } = await import('@/services/notification-service')
      const result = await notificationService.create({
        type: notificationType,
        title: notificationTitle,
        description: notificationDescription || undefined,
        user_id: notificationRecipient === 'all' ? undefined : undefined, // TODO: implementar seleção de usuário específico
      })

      toast.success(
        `Notificação enviada com sucesso para ${result.recipients.length} ${
          result.recipients.length === 1 ? 'usuário' : 'usuários'
        }`
      )

      // Reset form
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

  const handleNotificationTypeChange = (value: string) => {
    setNotificationType(value as NotificationCreate['type'])
  }

  return (
    <div className="min-h-screen bg-muted/40 flex font-sans text-foreground">
      <div className="w-64 bg-card border-r border-border hidden lg:flex flex-col fixed h-full">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-foreground" />
            Admin
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:bg-muted mb-4 border border-border hover:text-foreground"
            type="button"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Home
          </button>

          <button
            onClick={() => setTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            type="button"
          >
            <LayoutDashboard className="w-5 h-5" />
            Visão Geral
          </button>

          {isAdmin ? (
            <button
              onClick={() => setTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'users'
                  ? 'bg-slate-900 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
            >
              <Users className="w-5 h-5" />
              Usuários
            </button>
          ) : null}

          <button
            onClick={() => setTab('posts')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'posts'
                ? 'bg-slate-900 text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            type="button"
          >
            <Newspaper className="w-5 h-5" />
            Artigos do Blog
          </button>

          {isAdmin ? (
            <button
              onClick={() => setTab('materials')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'materials'
                  ? 'bg-slate-900 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
            >
              <FileText className="w-5 h-5" />
              Materiais
            </button>
          ) : null}

          {isAdmin ? (
            <button
              onClick={() => setTab('feedbacks')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'feedbacks'
                  ? 'bg-slate-900 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
            >
              <MessageSquare className="w-5 h-5" />
              Feedbacks
            </button>
          ) : null}

          {isAdmin ? (
            <button
              onClick={() => setTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'notifications'
                  ? 'bg-slate-900 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
            >
              <Bell className="w-5 h-5" />
              Notificações
            </button>
          ) : null}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar className="h-8 w-8">
              {user?.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user?.name || user?.email || 'Avatar'} />
              ) : null}
              <AvatarFallback className="bg-slate-900 text-white text-sm font-medium">
                {(user?.name
                  ? user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : user?.email
                    ? user.email.slice(0, 2).toUpperCase()
                    : 'A')}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-foreground truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 lg:ml-64">
        <div className="p-8 max-w-7xl mx-auto">
          {error ? (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Erro ao carregar dados</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          ) : null}

          <div className="lg:hidden mb-6 flex flex-wrap gap-2">
            <Button variant={activeTab === 'overview' ? 'default' : 'outline'} onClick={() => setTab('overview')}>
              <LayoutDashboard className="h-4 w-4" />
              Visão geral
            </Button>
            {isAdmin ? (
              <Button variant={activeTab === 'users' ? 'default' : 'outline'} onClick={() => setTab('users')}>
                <Users className="h-4 w-4" />
                Usuários
              </Button>
            ) : null}
            <Button variant={activeTab === 'posts' ? 'default' : 'outline'} onClick={() => setTab('posts')}>
              <Newspaper className="h-4 w-4" />
              Posts
            </Button>
            {isAdmin ? (
              <Button variant={activeTab === 'materials' ? 'default' : 'outline'} onClick={() => setTab('materials')}>
                <FileText className="h-4 w-4" />
                Materiais
              </Button>
            ) : null}
            {isAdmin ? (
              <Button variant={activeTab === 'feedbacks' ? 'default' : 'outline'} onClick={() => setTab('feedbacks')}>
                <MessageSquare className="h-4 w-4" />
                Feedbacks
              </Button>
            ) : null}
            {isAdmin ? (
              <Button variant={activeTab === 'notifications' ? 'default' : 'outline'} onClick={() => setTab('notifications')}>
                <Bell className="h-4 w-4" />
                Notificações
              </Button>
            ) : null}
          </div>

          {activeTab === 'overview' ? <OverviewTab isAdmin={isAdmin} /> : null}

          {isAdmin && activeTab === 'users' ? <UsersTab /> : null}

          {activeTab === 'posts' ? <PostsTab isAdmin={isAdmin} /> : null}
          {isAdmin && activeTab === 'materials' ? (
            <MaterialsTab isAdmin={isAdmin} />
          ) : null}
          {isAdmin && activeTab === 'feedbacks' ? (
            <FeedbacksTab
              feedbacks={feedbacks}
              isFeedbacksLoading={isFeedbacksLoading}
              feedbacksPage={feedbacksPage}
              feedbacksPageSize={feedbacksPageSize}
              feedbacksTotal={feedbacksTotal}
              feedbackStatusFilter={feedbackStatusFilter}
              feedbackSortOrder={feedbackSortOrder}
              selectedFeedback={selectedFeedback}
              isEditStatusDialogOpen={isEditStatusDialogOpen}
              isViewFeedbackDialogOpen={isViewFeedbackDialogOpen}
              isUpdatingFeedback={isUpdatingFeedback}
              feedbackStatus={feedbackStatus}
              onLoadFeedbacks={loadFeedbacks}
              onFeedbackStatusFilterChange={setFeedbackStatusFilter}
              onFeedbackSortOrderChange={setFeedbackSortOrder}
              onOpenEditStatusDialog={openEditStatusDialog}
              onOpenViewFeedbackDialog={openViewFeedbackDialog}
              onSetIsEditStatusDialogOpen={setIsEditStatusDialogOpen}
              onSetIsViewFeedbackDialogOpen={setIsViewFeedbackDialogOpen}
              onSetSelectedFeedback={setSelectedFeedback}
              onFeedbackStatusChange={setFeedbackStatus}
              onUpdateFeedbackStatus={() => void handleUpdateFeedbackStatus()}
            />
          ) : null}
          {isAdmin && activeTab === 'notifications' ? (
            <NotificationsTab
              isNotificationModalOpen={isNotificationModalOpen}
              notificationType={notificationType}
              notificationRecipient={notificationRecipient}
              notificationTitle={notificationTitle}
              notificationDescription={notificationDescription}
              isSendingNotification={isSendingNotification}
              onSetIsNotificationModalOpen={setIsNotificationModalOpen}
              onNotificationTypeChange={handleNotificationTypeChange}
              onNotificationRecipientChange={setNotificationRecipient}
              onNotificationTitleChange={setNotificationTitle}
              onNotificationDescriptionChange={setNotificationDescription}
              onCheckDeadlines={() => Promise.resolve()}
              onSendNotification={handleSendNotification}
            />
          ) : null}

        </div>
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
              <Select value={notificationType} onValueChange={handleNotificationTypeChange}>
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
    </div>
  )
}

