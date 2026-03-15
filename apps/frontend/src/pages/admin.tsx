import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users,
  FileText,
  LayoutDashboard,
  Shield,
  ArrowLeft,
  MessageSquare,
  Newspaper,
  Bell,
  Cpu,
  Send,
} from 'lucide-react'
import OverviewTab from './admin/overview-tab'
import UsersTab from './admin/users-tab'
import PostsTab from './admin/posts-tab'
import MaterialsTab from './admin/materials-tab'
import FeedbacksTab from './admin/feedbacks-tab'
import NotificationsTab from './admin/notifications-tab'
import AiCostsTab from './admin/ai-costs-tab'
import NotificationLogsTab from './admin/notification-logs-tab'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUser } from '@/features/auth/hooks/use-user'

type Tab = 'overview' | 'users' | 'posts' | 'materials' | 'feedbacks' | 'notifications' | 'notification-logs' | 'ai-costs'

const TABS_ADMIN: Tab[] = ['overview', 'users', 'posts', 'materials', 'feedbacks', 'notifications', 'notification-logs', 'ai-costs']
const TABS_AUTHOR: Tab[] = ['overview', 'posts']

const isTab = (value: string | null | undefined): value is Tab =>
  value === 'overview' || value === 'users' || value === 'posts' || value === 'materials' || value === 'feedbacks' || value === 'notifications' || value === 'notification-logs' || value === 'ai-costs'


export default function AdminPage() {
  const { user, isAdmin, isAuthor, isLoading: authLoading } = useUser()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const allowedTabs = isAdmin ? TABS_ADMIN : TABS_AUTHOR
  const tabFromUrl = searchParams.get('tab')
  const activeTab: Tab = isTab(tabFromUrl) && allowedTabs.includes(tabFromUrl)
    ? tabFromUrl
    : allowedTabs[0]

  useEffect(() => {
    if (!authLoading && !isAdmin && !isAuthor) {
      navigate('/')
    }
  }, [authLoading, isAdmin, isAuthor, navigate])

  const setTab = (next: Tab) => {
    if (!allowedTabs.includes(next)) return
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev)
      nextParams.set('tab', next)
      return nextParams
    })
  }

  if (authLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAdmin && !isAuthor) {
    return null
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

          {isAdmin ? (
            <button
              onClick={() => setTab('notification-logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'notification-logs'
                  ? 'bg-slate-900 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
            >
              <Send className="w-5 h-5" />
              Logs de Envio
            </button>
          ) : null}

          {isAdmin ? (
            <button
              onClick={() => setTab('ai-costs')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'ai-costs'
                  ? 'bg-slate-900 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
            >
              <Cpu className="w-5 h-5" />
              Custos IA
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
            {isAdmin ? (
              <Button variant={activeTab === 'notification-logs' ? 'default' : 'outline'} onClick={() => setTab('notification-logs')}>
                <Send className="h-4 w-4" />
                Logs de Envio
              </Button>
            ) : null}
            {isAdmin ? (
              <Button variant={activeTab === 'ai-costs' ? 'default' : 'outline'} onClick={() => setTab('ai-costs')}>
                <Cpu className="h-4 w-4" />
                Custos IA
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
            <FeedbacksTab />
          ) : null}
          {isAdmin && activeTab === 'notifications' ? (
            <NotificationsTab />
          ) : null}
          {isAdmin && activeTab === 'notification-logs' ? (
            <NotificationLogsTab />
          ) : null}
          {isAdmin && activeTab === 'ai-costs' ? (
            <AiCostsTab />
          ) : null}

        </div>
      </div>

    </div>
  )
}

