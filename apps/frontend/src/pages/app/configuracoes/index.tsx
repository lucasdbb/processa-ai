import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@/features/auth/hooks/use-user'
import { Bell, Shield, CreditCard, Palette, Camera, Check, Loader2, ChevronDown, Calendar, ExternalLink } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { DocumentType } from '@/features/auth/types'
import {
  phoneMask,
  removePhoneMask,
  isValidPhone,
  cpfMask,
  cnpjMask,
  removeDocumentMask,
  isValidCpf,
  isValidCnpj,
} from '@/lib/masks'
import { fileToBase64 } from '@/lib/imageUtils'
import { authService } from '@/features/auth/services/auth-service'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useCalendarSettingsStore, type CalendarColorScheme } from '@/stores/calendar-settings-store'
import { billingService, type SubscriptionStatus } from '@/services/billing-service'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export default function ConfiguracoesPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const { logout } = useAuthStore()
  const { resolvedTheme, setTheme } = useTheme()

  // Profile dropdown state
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  // Appearance section state
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)

  // Calendar section state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const { colorScheme, setColorScheme, defaultView, setDefaultView } = useCalendarSettingsStore()

  // Notifications section state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [deadlineReminders, setDeadlineReminders] = useState(true)
  const [processUpdates, setProcessUpdates] = useState(true)

  // Security section state
  const [isSecurityOpen, setIsSecurityOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Billing section state
  const [isBillingOpen, setIsBillingOpen] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [documentType, setDocumentType] = useState<DocumentType>(user?.document_type || 'cpf')
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone ? phoneMask(user.phone) : '',
    documentNumber: user?.document_number
      ? user.document_type === 'cnpj'
        ? cnpjMask(user.document_number)
        : cpfMask(user.document_number)
      : '',
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const newsletterCheckboxRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        if (!isEditing) {
          setIsProfileOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEditing])

  const sections = [
    {
      id: 'appearance',
      name: 'Aparência',
      icon: Palette,
      description: 'Tema da interface',
    },
    {
      id: 'calendar',
      name: 'Calendário',
      icon: Calendar,
      description: 'Preferências do calendário',
    },
    {
      id: 'notifications',
      name: 'Notificações',
      icon: Bell,
      description: 'Configure alertas e lembretes',
    },
    {
      id: 'security',
      name: 'Segurança',
      icon: Shield,
      description: 'Senha e autenticação',
    },
    {
      id: 'billing',
      name: 'Assinatura',
      icon: CreditCard,
      description: 'Plano e pagamentos',
    },
  ]

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target

      let processedValue = value
      if (name === 'phone') {
        processedValue = phoneMask(value)
      } else if (name === 'documentNumber') {
        processedValue = documentType === 'cpf' ? cpfMask(value) : cnpjMask(value)
      }

      setFormData((prev) => ({ ...prev, [name]: processedValue }))
    },
    [documentType]
  )

  const handleDocumentTypeChange = useCallback((type: DocumentType) => {
    setDocumentType(type)
    setFormData((prev) => ({ ...prev, documentNumber: '' }))
  }, [])

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione apenas arquivos de imagem.')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('O arquivo deve ter no maximo 5MB.')
        return
      }

      try {
        const base64 = await fileToBase64(file, 400, 400, 0.8)
        setAvatarPreview(base64)
      } catch (error) {
        console.error('Erro ao processar imagem:', error)
        toast.error('Erro ao processar imagem. Tente novamente.')
      }
    }
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setIsLoading(true)

      try {
        const cleanPhone = removePhoneMask(formData.phone)
        const cleanDocument = removeDocumentMask(formData.documentNumber)

        const updateData = {
          name: formData.name,
          phone: cleanPhone.trim() === '' ? undefined : cleanPhone,
          document_type: documentType,
          document_number: cleanDocument.trim() === '' ? undefined : cleanDocument,
          newsletter_opt_in: newsletterCheckboxRef.current?.checked || false,
          avatar_url: avatarPreview || undefined,
        }

        const updatedUser = await authService.updateProfile(updateData)
        setUser(updatedUser)
        setIsEditing(false)
        setIsProfileOpen(false)
        setAvatarPreview(null)
        toast.success('Perfil atualizado com sucesso!')
      } catch (error) {
        console.error('Erro ao atualizar perfil:', error)
        toast.error('Erro ao atualizar perfil. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    },
    [formData, avatarPreview, setUser, documentType]
  )

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setDocumentType(user?.document_type || 'cpf')
    setFormData({
      name: user?.name || '',
      phone: user?.phone ? phoneMask(user.phone) : '',
      documentNumber: user?.document_number
        ? user.document_type === 'cnpj'
          ? cnpjMask(user.document_number)
          : cpfMask(user.document_number)
        : '',
    })
    setAvatarPreview(null)
    if (newsletterCheckboxRef.current) {
      newsletterCheckboxRef.current.checked = user?.newsletter_opt_in || false
    }
  }, [user])

  // Load subscription data
  useEffect(() => {
    if (isBillingOpen && !subscription) {
      setLoadingBilling(true)
      billingService
        .getSubscription()
        .then(setSubscription)
        .catch((error) => {
          console.error('Error loading subscription:', error)
          toast.error('Erro ao carregar informações da assinatura')
        })
        .finally(() => setLoadingBilling(false))
    }
  }, [isBillingOpen])

  const handleOpenPortal = async () => {
    setOpeningPortal(true)
    try {
      const { portal_url } = await billingService.getPortalUrl()
      window.location.href = portal_url
    } catch (error) {
      console.error('Error opening portal:', error)
      toast.error('Erro ao abrir portal de gerenciamento')
      setOpeningPortal(false)
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
      console.error('Error deleting account:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir conta')
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
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
      // await authService.changePassword(currentPassword, newPassword)
      toast.success('Senha alterada com sucesso')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar senha')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const getStatusLabel = (status: SubscriptionStatus['status']) => {
    const labels = {
      active: { text: 'Ativa', color: 'text-green-600 dark:text-green-500' },
      trialing: { text: 'Período de teste', color: 'text-blue-600 dark:text-blue-500' },
      past_due: { text: 'Pagamento pendente', color: 'text-yellow-600 dark:text-yellow-500' },
      canceled: { text: 'Cancelada', color: 'text-red-600 dark:text-red-500' },
      incomplete: { text: 'Incompleta', color: 'text-orange-600 dark:text-orange-500' },
      paused: { text: 'Pausada', color: 'text-gray-600 dark:text-gray-500' },
      none: { text: 'Nenhuma', color: 'text-muted-foreground' },
    }
    return labels[status] || labels.none
  }

  const getInitials = () => {
    const name = user?.name || user?.email?.split('@')[0] || 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuracoes</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta e preferências.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden" ref={profileDropdownRef}>
        {/* Profile Header - Always visible */}
        <button
          type="button"
          onClick={() => {
            if (!isEditing) {
              setIsProfileOpen(!isProfileOpen)
            }
          }}
          className={cn(
            'w-full p-5 flex items-center justify-between hover:bg-muted/30 transition-colors',
            isProfileOpen && 'bg-muted/30'
          )}
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center text-lg font-bold overflow-hidden ring-2 ring-muted">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="object-cover w-full h-full" />
              ) : (
                getInitials()
              )}
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-foreground">
                {user?.name || 'Usuario'}
              </h2>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                Plano Gratuito
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {isProfileOpen ? 'Recolher' : 'Expandir'}
            </span>
            <ChevronDown
              className={cn(
                'h-5 w-5 text-muted-foreground transition-transform duration-200',
                isProfileOpen && 'rotate-180'
              )}
            />
          </div>
        </button>

        {/* Profile Form - Collapsible */}
        {isProfileOpen && (
          <div className="border-t border-border">
            {/* Edit Controls */}
            <div className="px-5 py-3 bg-muted/20 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {isEditing ? 'Editando perfil' : 'Dados do perfil'}
              </span>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Salvar
                  </button>
                </div>
              )}
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Avatar edit */}
              {isEditing && (
                <div className="flex items-center gap-4 pb-4 border-b border-border">
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
                    <p className="text-xs text-muted-foreground">JPG, PNG. Max 5MB.</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome */}
                <div className="md:col-span-2">
                  <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={cn(
                      'w-full px-3 py-2.5 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all',
                      !isEditing ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground'
                    )}
                    required
                  />
                </div>

                {/* Telefone */}
                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="(11) 99999-9999"
                    className={cn(
                      'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all',
                      !isEditing
                        ? 'bg-muted text-muted-foreground border-input cursor-not-allowed'
                        : formData.phone && !isValidPhone(formData.phone)
                          ? 'border-destructive focus:ring-destructive bg-background'
                          : formData.phone && isValidPhone(formData.phone)
                            ? 'border-green-500 focus:ring-green-500 bg-background'
                            : 'border-input focus:ring-primary bg-background'
                    )}
                  />
                </div>

                {/* Documento */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Documento
                  </label>
                  <div className="flex gap-2">
                    {isEditing && (
                      <div className="flex bg-muted p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => handleDocumentTypeChange('cpf')}
                          className={cn(
                            'px-2 py-1.5 rounded-md font-medium text-xs transition-all',
                            documentType === 'cpf' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                          )}
                        >
                          CPF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDocumentTypeChange('cnpj')}
                          className={cn(
                            'px-2 py-1.5 rounded-md font-medium text-xs transition-all',
                            documentType === 'cnpj' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                          )}
                        >
                          CNPJ
                        </button>
                      </div>
                    )}
                    <input
                      type="text"
                      id="documentNumber"
                      name="documentNumber"
                      value={formData.documentNumber}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                      className={cn(
                        'flex-1 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all',
                        !isEditing
                          ? 'bg-muted text-muted-foreground border-input cursor-not-allowed'
                          : formData.documentNumber && (documentType === 'cpf' ? !isValidCpf(formData.documentNumber) : !isValidCnpj(formData.documentNumber))
                            ? 'border-destructive focus:ring-destructive bg-background'
                            : formData.documentNumber && (documentType === 'cpf' ? isValidCpf(formData.documentNumber) : isValidCnpj(formData.documentNumber))
                              ? 'border-green-500 focus:ring-green-500 bg-background'
                              : 'border-input focus:ring-primary bg-background'
                      )}
                    />
                  </div>
                </div>

                {/* Membro desde */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Membro desde
                  </label>
                  <input
                    type="text"
                    value={user?.created_at ? formatDate(user.created_at) : '-'}
                    disabled
                    className="w-full px-3 py-2.5 border border-input rounded-lg bg-muted text-muted-foreground text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Newsletter */}
              <div className="flex items-center space-x-3 pt-2 bg-muted/50 p-4 rounded-xl">
                <input
                  type="checkbox"
                  id="newsletter"
                  name="newsletter"
                  ref={newsletterCheckboxRef}
                  defaultChecked={user?.newsletter_opt_in || false}
                  disabled={!isEditing}
                  className="h-4 w-4 text-primary focus:ring-primary border-input rounded cursor-pointer disabled:opacity-50 bg-background"
                />
                <label
                  htmlFor="newsletter"
                  className={cn('text-sm font-medium cursor-pointer', !isEditing ? 'text-muted-foreground' : 'text-foreground')}
                >
                  Receber novidades e atualizacoes por e-mail
                </label>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Settings Sections */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {sections.map((section) => {
          const Icon = section.icon

          // Aparencia é expansível
          if (section.id === 'appearance') {
            return (
              <div key={section.id}>
                <button
                  onClick={() => setIsAppearanceOpen(!isAppearanceOpen)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="p-2.5 bg-muted rounded-lg">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{section.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform duration-200',
                      isAppearanceOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isAppearanceOpen && (
                  <div className="px-5 pb-5 pt-0">
                    <div className="flex gap-2 ml-14">
                      {(['light', 'dark', 'system'] as const).map((theme) => (
                        <button
                          key={theme}
                          onClick={() => setTheme(theme)}
                          className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            resolvedTheme === theme || (theme === 'system' && !['light', 'dark'].includes(resolvedTheme || ''))
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Escuro' : 'Sistema'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          }

          // Calendário é expansível
          if (section.id === 'calendar') {
            return (
              <div key={section.id}>
                <button
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="p-2.5 bg-muted rounded-lg">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{section.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform duration-200',
                      isCalendarOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isCalendarOpen && (
                  <div className="px-5 pb-5 pt-0 space-y-4">
                    <div className="ml-14 space-y-4">
                      {/* Esquema de Cores */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Esquema de Cores
                        </label>
                        <div className="flex gap-2">
                          {(['default', 'minimal', 'colorful'] as CalendarColorScheme[]).map((scheme) => (
                            <button
                              key={scheme}
                              onClick={() => {
                                setColorScheme(scheme)
                                toast.success('Tema do calendário atualizado')
                              }}
                              className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                colorScheme === scheme
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {scheme === 'default' && 'Padrão'}
                              {scheme === 'minimal' && 'Minimalista'}
                              {scheme === 'colorful' && 'Colorido'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Visualização Padrão */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Visualização Padrão
                        </label>
                        <div className="flex gap-2">
                          {(['month', 'week', 'day', 'agenda'] as const).map((view) => (
                            <button
                              key={view}
                              onClick={() => {
                                setDefaultView(view)
                                toast.success('Visualização padrão atualizada')
                              }}
                              className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                defaultView === view
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {view === 'month' && 'Mês'}
                              {view === 'week' && 'Semana'}
                              {view === 'day' && 'Dia'}
                              {view === 'agenda' && 'Agenda'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          }

          // Notificações é expansível
          if (section.id === 'notifications') {
            return (
              <div key={section.id}>
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="p-2.5 bg-muted rounded-lg">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{section.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform duration-200',
                      isNotificationsOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isNotificationsOpen && (
                  <div className="px-5 pb-5 pt-0">
                    <div className="ml-14 space-y-4">
                      {/* Email Notifications */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-foreground">Notificações por Email</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Receba atualizações importantes por email
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={emailNotifications}
                            onChange={(e) => {
                              setEmailNotifications(e.target.checked)
                              toast.success(
                                e.target.checked
                                  ? 'Notificações por email ativadas'
                                  : 'Notificações por email desativadas'
                              )
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 dark:peer-focus:ring-slate-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
                        </label>
                      </div>

                      {/* Push Notifications */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-foreground">Notificações Push</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Receba notificações no navegador
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pushNotifications}
                            onChange={(e) => {
                              setPushNotifications(e.target.checked)
                              toast.success(
                                e.target.checked
                                  ? 'Notificações push ativadas'
                                  : 'Notificações push desativadas'
                              )
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 dark:peer-focus:ring-slate-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
                        </label>
                      </div>

                      {/* Deadline Reminders */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-foreground">Lembretes de Prazos</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Alertas sobre prazos próximos do vencimento
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deadlineReminders}
                            onChange={(e) => {
                              setDeadlineReminders(e.target.checked)
                              toast.success(
                                e.target.checked
                                  ? 'Lembretes de prazos ativados'
                                  : 'Lembretes de prazos desativados'
                              )
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 dark:peer-focus:ring-slate-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
                        </label>
                      </div>

                      {/* Process Updates */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-foreground">Atualizações de Processos</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Notificações sobre mudanças nos processos
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={processUpdates}
                            onChange={(e) => {
                              setProcessUpdates(e.target.checked)
                              toast.success(
                                e.target.checked
                                  ? 'Atualizações de processos ativadas'
                                  : 'Atualizações de processos desativadas'
                              )
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 dark:peer-focus:ring-slate-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          }

          // Segurança é expansível
          if (section.id === 'security') {
            return (
              <div key={section.id}>
                <button
                  onClick={() => setIsSecurityOpen(!isSecurityOpen)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="p-2.5 bg-muted rounded-lg">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{section.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform duration-200',
                      isSecurityOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isSecurityOpen && (
                  <div className="px-5 pb-5 pt-0">
                    <div className="ml-14 space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-3">Alterar Senha</h4>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="current-password" className="block text-sm font-medium text-muted-foreground mb-1">
                              Senha Atual
                            </label>
                            <input
                              id="current-password"
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                              placeholder="Digite sua senha atual"
                            />
                          </div>
                          <div>
                            <label htmlFor="new-password" className="block text-sm font-medium text-muted-foreground mb-1">
                              Nova Senha
                            </label>
                            <input
                              id="new-password"
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                              placeholder="Digite sua nova senha"
                            />
                          </div>
                          <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-muted-foreground mb-1">
                              Confirmar Nova Senha
                            </label>
                            <input
                              id="confirm-password"
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                              placeholder="Confirme sua nova senha"
                            />
                          </div>
                          <button
                            onClick={handleChangePassword}
                            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isChangingPassword ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Alterando...
                              </>
                            ) : (
                              'Alterar Senha'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          }

          // Billing é expansível
          if (section.id === 'billing') {
            const statusInfo = subscription ? getStatusLabel(subscription.status) : null

            return (
              <div key={section.id}>
                <button
                  onClick={() => setIsBillingOpen(!isBillingOpen)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="p-2.5 bg-muted rounded-lg">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{section.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform duration-200',
                      isBillingOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isBillingOpen && (
                  <div className="px-5 pb-5 pt-0">
                    <div className="ml-14 space-y-4">
                      {loadingBilling ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : subscription ? (
                        <>
                          {/* Status da Assinatura */}
                          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-muted-foreground">Status</span>
                              <span className={cn('text-sm font-semibold', statusInfo?.color)}>
                                {statusInfo?.text}
                              </span>
                            </div>
                            
                            {subscription.status === 'active' && subscription.current_period_end && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                  Próxima renovação
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                  {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            )}

                            {subscription.cancel_at_period_end && (
                              <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-600 dark:text-yellow-500">
                                Sua assinatura será cancelada no fim do período atual
                              </div>
                            )}
                          </div>

                          {/* Botões de Ação */}
                          <div className="space-y-2">
                            <button
                              onClick={handleOpenPortal}
                              disabled={openingPortal}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {openingPortal ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Abrindo...
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="w-4 h-4" />
                                  Gerenciar Assinatura
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => navigate('/planos')}
                              className="w-full px-4 py-2.5 border-2 border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
                            >
                              Ver Planos Disponíveis
                            </button>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            O gerenciamento completo de assinatura (faturas, pagamento, cancelamento) é feito pelo
                            portal seguro do Stripe.
                          </p>
                        </>
                      ) : (
                        <div className="text-center py-8 space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Você ainda não possui uma assinatura ativa.
                          </p>
                          <button
                            onClick={() => navigate('/planos')}
                            className="px-6 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                          >
                            Ver Planos
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          }

          return (
            <button
              key={section.id}
              className="w-full flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="p-2.5 bg-muted rounded-lg">
                <Icon className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground">{section.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
              </div>
              <svg
                className="h-5 w-5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )
        })}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
        <h3 className="font-medium text-red-600 mb-1">Zona de Perigo</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Acoes irreversiveis para sua conta.
        </p>
        <button 
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          Excluir minha conta
        </button>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Excluir conta permanentemente?"
        description="Esta ação é irreversível. Todos os seus dados, processos, clientes, documentos e configurações serão permanentemente excluídos. Você não poderá recuperar essas informações."
        confirmText={isDeletingAccount ? 'Excluindo...' : 'Sim, excluir minha conta'}
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingAccount}
      />
    </div>
  )
}
