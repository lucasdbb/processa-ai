import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Camera } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '../types'
import {
  phoneMask,
  removePhoneMask,
  isValidPhone,
  cpfMask,
  removeDocumentMask,
  isValidCpf,
} from '@/lib/masks'
import { fileToBase64 } from '@/lib/imageUtils'
import { authService } from '../services/auth-service'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: User
  onUpdateProfile: (updatedUser: User) => void
}

export function ProfileModal({ isOpen, onClose, user, onUpdateProfile }: ProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email,
    phone: user.phone ? phoneMask(user.phone) : '',
    cpf: user.cpf ? cpfMask(user.cpf) : '',
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const newsletterCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (newsletterCheckboxRef.current && isOpen) {
      newsletterCheckboxRef.current.checked = user.newsletter_opt_in || false
    }
  }, [isOpen, user.newsletter_opt_in])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) onClose()
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen, onClose])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target

      let processedValue = value
      if (name === 'phone') {
        processedValue = phoneMask(value)
      } else if (name === 'cpf') {
        processedValue = cpfMask(value)
      }

      setFormData((prev) => ({ ...prev, [name]: processedValue }))
    },
    []
  )

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
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
        const cleanCpf = removeDocumentMask(formData.cpf)

        const updateData = {
          name: formData.name,
          phone: cleanPhone.trim() === '' ? undefined : cleanPhone,
          cpf: cleanCpf.trim() === '' ? undefined : cleanCpf,
          newsletter_opt_in: newsletterCheckboxRef.current?.checked || false,
          avatar_url: avatarPreview || undefined,
        }

        const updatedUser = await authService.updateProfile(updateData)
        onUpdateProfile(updatedUser)
        setIsEditing(false)
        setAvatarPreview(null)
        toast.success('Perfil atualizado com sucesso!')
      } catch (error) {
        console.error('Erro ao atualizar perfil:', error)
        toast.error('Erro ao atualizar perfil. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    },
    [formData, avatarPreview, onUpdateProfile]
  )

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setFormData({
      name: user.name || '',
      email: user.email,
      phone: user.phone ? phoneMask(user.phone) : '',
      cpf: user.cpf ? cpfMask(user.cpf) : '',
    })
    setAvatarPreview(null)
    if (newsletterCheckboxRef.current) {
      newsletterCheckboxRef.current.checked = user.newsletter_opt_in || false
    }
  }, [user])

  const getInitials = (name: string) => {
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-card text-card-foreground rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="relative w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center text-lg font-bold overflow-hidden shadow-md ring-2 ring-muted">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="object-cover w-full h-full" />
                ) : user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="object-cover w-full h-full" />
                ) : (
                  getInitials(user.name || user.email)
                )}
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 bg-background text-foreground border border-border rounded-full p-1.5 hover:bg-muted transition-colors shadow-sm"
                  aria-label="Alterar foto"
                >
                  <Camera className="w-3 h-3" />
                </button>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                {isEditing ? 'Editar Perfil' : 'Meu Perfil'}
              </h2>
              <p className="text-xs text-muted-foreground font-medium">{user.email}</p>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>

          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full p-2 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
                    !isEditing ? 'bg-muted text-muted-foreground' : 'bg-background text-foreground'
                  }`}
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
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
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    !isEditing
                      ? 'bg-muted text-muted-foreground border-input'
                      : formData.phone && !isValidPhone(formData.phone)
                        ? 'border-destructive focus:ring-destructive'
                        : formData.phone && isValidPhone(formData.phone)
                          ? 'border-green-500 focus:ring-green-500'
                          : 'border-input focus:ring-primary'
                  }`}
                />
              </div>

              <div>
                <label htmlFor="cpf" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  CPF
                </label>
                <input
                  type="text"
                  id="cpf"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  placeholder="000.000.000-00"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    !isEditing
                      ? 'bg-muted text-muted-foreground border-input'
                      : formData.cpf && !isValidCpf(formData.cpf)
                        ? 'border-destructive focus:ring-destructive'
                        : formData.cpf && isValidCpf(formData.cpf)
                          ? 'border-green-500 focus:ring-green-500'
                          : 'border-input focus:ring-primary'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Membro desde
                </label>
                <input
                  type="text"
                  value={formatDate(user.created_at)}
                  disabled
                  className="w-full px-3 py-2 border border-input rounded-lg bg-muted text-muted-foreground text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2 bg-muted p-3 rounded-xl">
              <input
                type="checkbox"
                id="newsletter"
                name="newsletter"
                ref={newsletterCheckboxRef}
                defaultChecked={user.newsletter_opt_in || false}
                disabled={!isEditing}
                className="h-4 w-4 text-primary focus:ring-primary border-input rounded cursor-pointer disabled:opacity-50 bg-background"
              />
              <label
                htmlFor="newsletter"
                className={`text-sm font-medium ${!isEditing ? 'text-muted-foreground' : 'text-foreground'} cursor-pointer`}
              >
                Receber novidades e atualizações por e-mail
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-border mt-4">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-ring font-medium text-sm"
                >
                  Editar Perfil
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-5 py-2 border border-input text-foreground rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring font-medium text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 font-medium text-sm"
                  >
                    {isLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
