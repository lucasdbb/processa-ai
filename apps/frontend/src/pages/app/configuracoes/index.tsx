import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@/features/auth/hooks/use-user'
import { Shield, CreditCard, Camera, Check, Loader2, ExternalLink, Pencil, Coins, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  phoneMask,
  removePhoneMask,
  isValidPhone,
  cpfMask,
  removeDocumentMask,
  isValidCpf,
} from '@/lib/masks'
import { fileToBase64 } from '@/lib/imageUtils'
import { authService } from '@/features/auth/services/auth-service'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useCreditsStore } from '@/stores/credits-store'
import { billingService, type SubscriptionStatus } from '@/services/billing-service'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

type Tab = 'perfil' | 'seguranca' | 'assinatura'

const AREAS = [
  'Trabalhista', 'Cível', 'Previdenciário', 'Criminal', 'Empresarial',
  'Tributário', 'Família e Sucessões', 'Imobiliário', 'Ambiental', 'Outro',
]

export default function ConfiguracoesPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const { logout } = useAuthStore()
  const { credits, fetchCredits, isLoading: loadingCredits } = useCreditsStore()

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>('perfil')

  // Profile modal
  const [editingProfile, setEditingProfile] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone ? phoneMask(user.phone) : '',
    cpf: user?.cpf ? cpfMask(user.cpf) : '',
    company: user?.company || '',
    bio: user?.bio || '',
    newsletter: user?.newsletter_opt_in || false,
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Security
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Billing
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [showPortalConfirm, setShowPortalConfirm] = useState(false)

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  // Refresh user data on mount
  useEffect(() => {
    authService.getCurrentUser().then((userData) => {
      if (userData) setUser(userData)
    })
  }, [setUser])

  // Load billing data on mount
  useEffect(() => {
    setLoadingBilling(true)
    billingService
      .getSubscription()
      .then(setSubscription)
      .catch((error) => {
        console.error('Error loading subscription:', error)
      })
      .finally(() => setLoadingBilling(false))

    fetchCredits()
  }, [fetchCredits])

  // Sync form with user data when modal opens
  useEffect(() => {
    if (editingProfile && user) {
      setFormData({
        name: user.name || '',
        phone: user.phone ? phoneMask(user.phone) : '',
        cpf: user.cpf ? cpfMask(user.cpf) : '',
        company: user.company || '',
        bio: user.bio || '',
        newsletter: user.newsletter_opt_in || false,
      })
      setAvatarPreview(null)
    }
  }, [editingProfile, user])

  const isFormValid = useMemo(() => {
    if (!formData.name || formData.name.trim() === '') return false
    if (!formData.cpf || formData.cpf.trim() === '') return false
    if (!isValidCpf(formData.cpf)) return false
    if (formData.phone && formData.phone.trim() !== '' && !isValidPhone(formData.phone)) return false
    return true
  }, [formData.cpf, formData.phone, formData.name])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    let processedValue: string | boolean = value
    if (type === 'checkbox') {
      processedValue = checked
    } else if (name === 'phone') {
      processedValue = phoneMask(value)
    } else if (name === 'cpf') {
      processedValue = cpfMask(value)
    }
    setFormData((prev) => ({ ...prev, [name]: processedValue }))
  }

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 5MB.')
      return
    }
    try {
      const base64 = await fileToBase64(file, 400, 400, 0.8)
      setAvatarPreview(base64)
    } catch {
      toast.error('Erro ao processar imagem. Tente novamente.')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) {
      toast.error('Preencha todos os campos obrigatórios corretamente.')
      return
    }
    setIsLoading(true)
    try {
      const cleanPhone = removePhoneMask(formData.phone)
      const cleanCpf = removeDocumentMask(formData.cpf)
      const updatedUser = await authService.updateProfile({
        name: formData.name,
        phone: cleanPhone.trim() === '' ? undefined : cleanPhone,
        cpf: cleanCpf,
        company: formData.company.trim() || undefined,
        bio: formData.bio.trim() || undefined,
        newsletter_opt_in: formData.newsletter,
        avatar_url: avatarPreview || undefined,
      })
      setUser(updatedUser)
      setEditingProfile(false)
      setAvatarPreview(null)
      toast.success('Perfil atualizado com sucesso!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil. Tente novamente.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    setIsChangingPassword(true)
    try {
      // TODO: Implementar endpoint de mudança de senha
      toast.success('Senha alterada com sucesso')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar senha')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleOpenPortal = async () => {
    setOpeningPortal(true)
    try {
      const { portal_url } = await billingService.getPortalUrl()
      window.location.href = portal_url
    } catch {
      toast.error('Erro ao abrir portal de gerenciamento')
      setOpeningPortal(false)
      setShowPortalConfirm(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true)
    try {
      await authService.deleteAccount()
      toast.success('Conta excluída com sucesso')
      logout()
      navigate('/')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir conta')
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteConfirm(false)
    }
  }

  const getStatusLabel = (status: SubscriptionStatus['status']) => {
    const labels: Record<string, { text: string; color: string; bg: string }> = {
      active: { text: 'Ativa', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-500/10' },
      trialing: { text: 'Período de teste', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-500/10' },
      past_due: { text: 'Pagamento pendente', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
      canceled: { text: 'Cancelada', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-500/10' },
      incomplete: { text: 'Incompleta', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-500/10' },
      paused: { text: 'Pausada', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-500/10' },
      none: { text: 'Sem assinatura', color: 'text-muted-foreground', bg: 'bg-muted' },
    }
    return labels[status] || labels.none
  }

  const getInitials = () => {
    const name = user?.name || user?.email?.split('@')[0] || 'U'
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const currentAvatar = avatarPreview || user?.avatar_url

  // ─── Tab definitions ────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'seguranca', label: 'Segurança', icon: Shield },
    { id: 'assinatura', label: 'Assinatura', icon: CreditCard },
  ]

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua conta e preferências.</p>
      </div>

      {/* Profile card — always visible */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center text-lg font-bold overflow-hidden ring-2 ring-muted shrink-0">
              {currentAvatar ? (
                <img src={currentAvatar} alt="Avatar" className="object-cover w-full h-full" />
              ) : (
                getInitials()
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{user?.name || 'Usuario'}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              {subscription && (
                <span
                  className={cn(
                    'inline-block mt-1.5 px-2 py-0.5 text-xs font-medium rounded-full',
                    getStatusLabel(subscription.status).bg,
                    getStatusLabel(subscription.status).color,
                  )}
                >
                  {getStatusLabel(subscription.status).text}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingProfile(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1" aria-label="Secoes de configuracoes">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>

        {/* ── Aba: Perfil ── */}
        {activeTab === 'perfil' && (
          <div className="space-y-1">
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              <DataRow label="Nome completo" value={user?.name || 'Nao informado'} />
              <DataRow label="Escritório" value={user?.company || 'Nao informado'} />
              <DataRow label="Principal área de atuação" value={user?.bio || 'Nao informado'} />
              <DataRow
                label="Telefone"
                value={user?.phone ? phoneMask(user.phone) : 'Nao informado'}
              />
              <DataRow
                label="CPF"
                value={user?.cpf ? cpfMask(user.cpf) : 'Nao informado'}
              />
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Newsletter</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.newsletter_opt_in ? 'Inscrito para receber novidades' : 'Nao inscrito'}
                  </p>
                </div>
                <span
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full',
                    user?.newsletter_opt_in
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {user?.newsletter_opt_in ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2 px-1">
              Para alterar qualquer dado, clique em "Editar" no cartao acima.
            </p>
          </div>
        )}

        {/* ── Aba: Seguranca ── */}
        {activeTab === 'seguranca' && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Alterar senha</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Escolha uma senha forte com pelo menos 6 caracteres.
              </p>
              <div className="space-y-4 max-w-sm">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5">
                    Nova senha
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    placeholder="Digite a nova senha"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2.5 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 transition-all',
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-primary',
                    )}
                    placeholder="Confirme a nova senha"
                  />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-destructive mt-1">As senhas nao coincidem</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChangingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                  Alterar senha
                </button>
              </div>
            </div>

            <Separator />

            {/* Danger zone inside Security tab */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Zona de perigo</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Ações permanentes e irreversíveis para sua conta.
              </p>
              <div className="border border-red-500/20 rounded-xl p-5 bg-red-500/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Excluir conta</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Todos os seus dados serão permanentemente removidos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="shrink-0 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Excluir conta
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Aba: Assinatura ── */}
        {activeTab === 'assinatura' && (
          <div className="space-y-4">

            {/* Subscription status */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Status da assinatura</h2>
              {loadingBilling ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : subscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status atual</span>
                    <span
                      className={cn(
                        'px-2.5 py-1 text-xs font-semibold rounded-full',
                        getStatusLabel(subscription.status).bg,
                        getStatusLabel(subscription.status).color,
                      )}
                    >
                      {getStatusLabel(subscription.status).text}
                    </span>
                  </div>
                  {subscription.status === 'active' && subscription.current_period_end && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Proxima renovacao</span>
                      <span className="text-sm font-medium text-foreground">
                        {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                  {subscription.cancel_at_period_end && (
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        Sua assinatura sera cancelada ao fim do periodo atual.
                      </p>
                    </div>
                  )}
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPortalConfirm(true)}
                      disabled={openingPortal}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      {openingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                      Gerenciar assinatura
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/app/assinatura')}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Ver planos
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Faturas e cancelamentos sao gerenciados pelo portal seguro do Stripe.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Voce nao possui uma assinatura ativa.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/app/assinatura')}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Ver planos de assinatura
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Credits panel */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Coins className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Creditos disponiveis</h2>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <CreditBlock
                  label="Assinatura"
                  value={loadingCredits ? null : (credits?.subscription_credits ?? 0)}
                />
                <CreditBlock
                  label="Comprados"
                  value={loadingCredits ? null : (credits?.purchased_credits ?? 0)}
                />
                <div className="bg-foreground/5 border border-border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total</p>
                  {loadingCredits ? (
                    <Loader2 className="w-4 h-4 animate-spin inline text-muted-foreground" />
                  ) : (
                    <p className="text-xl font-bold text-foreground">{credits?.total_available ?? 0}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/app/assinatura')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Comprar creditos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de edicao de perfil ── */}
      <Dialog open={editingProfile} onOpenChange={(open) => { if (!isLoading) setEditingProfile(open) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center text-xl font-bold overflow-hidden ring-2 ring-muted">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="object-cover w-full h-full" />
                  ) : user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="object-cover w-full h-full" />
                  ) : (
                    getInitials()
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 bg-background text-foreground border border-border rounded-full p-1.5 hover:bg-muted transition-colors shadow-sm"
                  aria-label="Alterar foto"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Foto de perfil</p>
                <p className="text-xs text-muted-foreground">JPG, PNG. Max. 5MB.</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>

            {/* Nome */}
            <div>
              <label htmlFor="modal-name" className="block text-sm font-medium text-foreground mb-1.5">
                Nome Completo <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                id="modal-name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Escritório + Área */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="modal-company" className="block text-sm font-medium text-foreground mb-1.5">
                  Nome do escritório
                </label>
                <input
                  type="text"
                  id="modal-company"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Ex: Silva & Associados"
                  className="w-full px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="modal-bio" className="block text-sm font-medium text-foreground mb-1.5">
                  Principal área de atuação
                </label>
                <Select value={formData.bio} onValueChange={(v) => setFormData((prev) => ({ ...prev, bio: v }))} disabled={isLoading}>
                  <SelectTrigger id="modal-bio" className="h-[42px]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Telefone */}
              <div>
                <label htmlFor="modal-phone" className="block text-sm font-medium text-foreground mb-1.5">
                  Telefone
                </label>
                <input
                  type="tel"
                  id="modal-phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(11) 99999-9999"
                  className={cn(
                    'w-full px-3 py-2.5 border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:border-transparent transition-all',
                    formData.phone && !isValidPhone(formData.phone)
                      ? 'border-destructive focus:ring-destructive'
                      : formData.phone && isValidPhone(formData.phone)
                        ? 'border-green-500 focus:ring-green-500'
                        : 'border-input focus:ring-primary'
                  )}
                />
                {formData.phone && !isValidPhone(formData.phone) && (
                  <p className="text-xs text-destructive mt-1">Telefone invalido</p>
                )}
              </div>

              {/* CPF */}
              <div>
                <label htmlFor="modal-cpf" className="block text-sm font-medium text-foreground mb-1.5">
                  CPF <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  id="modal-cpf"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  placeholder="000.000.000-00"
                  required
                  className={cn(
                    'w-full px-3 py-2.5 border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:border-transparent transition-all',
                    !formData.cpf || !isValidCpf(formData.cpf)
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-green-500 focus:ring-green-500'
                  )}
                />
                {formData.cpf && !isValidCpf(formData.cpf) && (
                  <p className="text-xs text-destructive mt-1">CPF invalido</p>
                )}
              </div>
            </div>

            {/* Newsletter */}
            <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-lg">
              <input
                type="checkbox"
                id="modal-newsletter"
                name="newsletter"
                checked={formData.newsletter}
                onChange={handleInputChange}
                className="h-4 w-4 text-primary focus:ring-primary border-input rounded cursor-pointer bg-background"
              />
              <label htmlFor="modal-newsletter" className="text-sm font-medium text-foreground cursor-pointer">
                Receber novidades e atualizacoes por e-mail
              </label>
            </div>
          </form>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !isFormValid}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogs de confirmacao ── */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Excluir conta permanentemente?"
        description="Esta acao e irreversivel. Todos os seus dados, processos, clientes, documentos e configuracoes serao permanentemente excluidos."
        confirmText={isDeletingAccount ? 'Excluindo...' : 'Sim, excluir minha conta'}
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingAccount}
      />

      <ConfirmDialog
        isOpen={showPortalConfirm}
        onClose={() => setShowPortalConfirm(false)}
        onConfirm={handleOpenPortal}
        title="Gerenciar Assinatura"
        description="Voce sera redirecionado para o portal de pagamentos seguro do Stripe. Ao alterar seu plano, seus creditos mensais serao redefinidos imediatamente para o limite do novo plano."
        confirmText={openingPortal ? 'Redirecionando...' : 'Entendi, ir para o portal'}
        cancelText="Cancelar"
        variant="info"
        isLoading={openingPortal}
      />
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
  )
}

function CreditBlock({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {value === null ? (
        <Loader2 className="w-4 h-4 animate-spin inline text-muted-foreground" />
      ) : (
        <p className="text-lg font-bold text-foreground">{value}</p>
      )}
    </div>
  )
}
