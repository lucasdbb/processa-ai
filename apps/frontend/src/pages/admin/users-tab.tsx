import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Edit, CheckCircle, XCircle, Ban, Users, User, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn, formatDate } from '@/lib/utils'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { toast } from 'sonner'
import { useUser } from '@/features/auth/hooks/use-user'

interface UserCredits {
  subscription: number  // Available subscription credits
  purchased: number     // Available purchased credits
  total: number         // Total available credits
}

interface UserListItem {
  id: string
  email: string
  name: string
  role: 'client' | 'author' | 'admin' | 'office_client'
  status: 'active' | 'suspended' | 'deleted'
  avatar_url?: string | null
  created_at: string
  confirmed_at?: string | null
  credits?: UserCredits
  plan_id?: string
  subscription_status?: string
}

const roleLabel: Record<UserListItem['role'], string> = {
  client: 'Cliente',
  author: 'Autor',
  admin: 'Admin',
  office_client: 'Portal',
}

const getRoleIcon = (role: UserListItem['role']) => {
  switch (role) {
    case 'admin':
      return <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
    case 'author':
      return <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    case 'office_client':
      return <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
    default:
      return <Users className="w-4 h-4 text-muted-foreground" />
  }
}

const getRoleBadgeClass = (role: UserListItem['role']) => {
  switch (role) {
    case 'admin':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50'
    case 'author':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50'
    case 'office_client':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/50'
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800'
  }
}

export default function UsersTab() {
  const { user } = useUser()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [isUsersLoading, setIsUsersLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserListItem['role']>('all')
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [selectedUserRole, setSelectedUserRole] = useState<UserListItem['role']>('client')
  const [selectedUserSubscriptionCredits, setSelectedUserSubscriptionCredits] = useState(0)
  const [selectedUserPurchasedCredits, setSelectedUserPurchasedCredits] = useState(0)
  const [selectedUserPlan, setSelectedUserPlan] = useState('free')
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [statusToUpdate, setStatusToUpdate] = useState<'active' | 'suspended'>('active')
  const [userToUpdateStatus, setUserToUpdateStatus] = useState<UserListItem | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const currentUserId = user?.id

  const extractErrorMessage = useCallback(async (response: Response, fallback: string) => {
    try {
      const data: unknown = await response.json()
      if (data && typeof data === 'object' && 'detail' in data) {
        const detail = (data as { detail?: unknown }).detail
        if (typeof detail === 'string' && detail.trim()) return detail

        if (Array.isArray(detail)) {
          const messages = detail
            .map((item) => {
              if (!item || typeof item !== 'object') return null
              const loc = 'loc' in item ? (item as { loc?: unknown }).loc : undefined
              const msg = 'msg' in item ? (item as { msg?: unknown }).msg : undefined
              const locParts = Array.isArray(loc) ? loc : []
              const field = locParts
                .map((p) => (typeof p === 'string' || typeof p === 'number' ? String(p) : ''))
                .filter(Boolean)
                .at(-1)
              const messageText = typeof msg === 'string' ? msg : ''
              if (field && messageText) return `${field}: ${messageText}`
              if (messageText) return messageText
              return null
            })
            .filter((m): m is string => Boolean(m && m.trim()))

          if (messages.length > 0) return messages.join('; ')
        }
      }
    } catch {
      return fallback
    }
    return fallback
  }, [])

  const loadUsers = useCallback(async () => {
    setIsUsersLoading(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/users?limit=100&offset=0`)
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao carregar usuários'))
      const data = (await res.json()) as unknown
      setUsers(Array.isArray(data) ? (data as UserListItem[]) : [])
    } catch (err) {
      setUsers([])
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar usuários')
    } finally {
      setIsUsersLoading(false)
    }
  }, [extractErrorMessage])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const openRoleDialog = (userItem: UserListItem) => {
    setSelectedUser(userItem)
    setSelectedUserRole(userItem.role)
    setSelectedUserSubscriptionCredits(userItem.credits?.subscription ?? 0)
    setSelectedUserPurchasedCredits(userItem.credits?.purchased ?? 0)
    setSelectedUserPlan(userItem.plan_id ?? 'free')
    setIsRoleDialogOpen(true)
  }

  const closeRoleDialog = () => {
    setIsRoleDialogOpen(false)
    setSelectedUser(null)
  }

  const handleUpdateRole = async () => {
    if (!selectedUser) return
    setIsUpdatingRole(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/users/update-user`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: selectedUserRole,
          subscriptionCredits: selectedUserSubscriptionCredits,
          purchasedCredits: selectedUserPurchasedCredits,
          planId: selectedUserPlan,
        }),
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao atualizar usuário'))
      toast.success('Usuário atualizado!')
      closeRoleDialog()
      void loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar usuário')
    } finally {
      setIsUpdatingRole(false)
    }
  }

  const openStatusDialog = (userItem: UserListItem) => {
    setUserToUpdateStatus(userItem)
    setStatusToUpdate(userItem.status === 'suspended' ? 'active' : 'suspended')
    setIsStatusDialogOpen(true)
  }

  const handleUpdateUserStatus = async () => {
    if (!userToUpdateStatus) return
    setIsUpdatingStatus(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/users/update-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userToUpdateStatus.id, status: statusToUpdate }),
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao atualizar status'))
      toast.success('Status atualizado!')
      setIsStatusDialogOpen(false)
      setUserToUpdateStatus(null)
      void loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setIsUpdatingStatus(false)
    }
  }
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    const role = roleFilter
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      const matchesRole = role === 'all' || u.role === role
      return matchesSearch && matchesRole
    })
  }, [users, userSearch, roleFilter])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Gerenciar Usuários</h2>
        <Button variant="outline" onClick={loadUsers} disabled={isUsersLoading}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="p-4 border-b border-border">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar usuários..."
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
              <SelectTrigger className="md:w-[200px]">
                <SelectValue placeholder="Todas as roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as roles</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="office_client">Portal</SelectItem>
                <SelectItem value="author">Autor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isUsersLoading ? (
              <div className="py-16 flex items-center justify-center">
                <LoadingSpinner size="lg" text="Carregando usuarios..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Usuário</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Créditos</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Plano</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Cadastro</th>
                    <th className="px-6 py-3 text-right font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium overflow-hidden">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : u.name ? (
                              u.name.substring(0, 2).toUpperCase()
                            ) : (
                              u.email.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{u.name || 'Sem nome'}</p>
                            <div className="flex items-center gap-1">
                              <p className="text-muted-foreground">{u.email}</p>
                              {u.confirmed_at ? (
                                <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                            getRoleBadgeClass(u.role)
                          )}
                        >
                          {getRoleIcon(u.role)}
                          {roleLabel[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-foreground font-medium">
                        <div className="flex flex-col text-sm">
                          <span className="font-medium">{u.credits?.total ?? 0} disponíveis</span>
                          <span className="text-xs text-muted-foreground">
                            {u.credits?.subscription ?? 0} assinatura | {u.credits?.purchased ?? 0} comprados
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            u.plan_id === 'autonomo'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                              : u.plan_id === 'student'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          )}
                        >
                          {u.plan_id === 'autonomo' ? 'Autônomo' : u.plan_id === 'student' ? 'Estudante' : 'Gratuito'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openRoleDialog(u)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openStatusDialog(u)}
                            disabled={u.id === currentUserId}
                            className={u.status === 'suspended' ? 'text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30' : 'text-destructive hover:text-destructive hover:bg-red-100 dark:hover:bg-red-900/30'}
                            title={u.status === 'suspended' ? 'Ativar usuário' : 'Inativar usuário'}
                          >
                            {u.status === 'suspended' ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">Nenhum usuário encontrado.</div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isRoleDialogOpen}
        onOpenChange={(open) => (open ? undefined : closeRoleDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              {selectedUser ? `Editar informações de ${selectedUser.name || selectedUser.email}` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Role</label>
              <Select
                value={selectedUserRole}
                onValueChange={(v) => setSelectedUserRole(v as UserListItem['role'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="author">Autor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Créditos de Assinatura</label>
              <Input
                type="number"
                min="0"
                value={selectedUserSubscriptionCredits}
                onChange={(e) => setSelectedUserSubscriptionCredits(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Créditos mensais do plano (resetam a cada ciclo)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Créditos Comprados</label>
              <Input
                type="number"
                min="0"
                value={selectedUserPurchasedCredits}
                onChange={(e) => setSelectedUserPurchasedCredits(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Créditos comprados separadamente (não expiram)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Plano</label>
              <Select value={selectedUserPlan} onValueChange={setSelectedUserPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Gratuito</SelectItem>
                  <SelectItem value="student">Estudante</SelectItem>
                  <SelectItem value="autonomo">Autônomo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRoleDialog}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateRole} disabled={isUpdatingRole}>
              {isUpdatingRole ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={isStatusDialogOpen}
        onClose={() => setIsStatusDialogOpen(false)}
        onConfirm={handleUpdateUserStatus}
        title={statusToUpdate === 'suspended' ? 'Inativar usuário?' : 'Ativar usuário?'}
        description={
          statusToUpdate === 'suspended'
            ? `Deseja inativar o usuário ${userToUpdateStatus?.email}? Ele perderá o acesso à plataforma.`
            : `Deseja ativar o usuário ${userToUpdateStatus?.email}? Ele terá o acesso restaurado.`
        }
        confirmText={statusToUpdate === 'suspended' ? 'Inativar' : 'Ativar'}
        variant={statusToUpdate === 'suspended' ? 'danger' : 'success'}
        isLoading={isUpdatingStatus}
      />
    </div>
  )
}
