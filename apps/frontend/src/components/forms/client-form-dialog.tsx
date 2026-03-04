import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2, Building2, User } from 'lucide-react'
import { clientsService, type Client, type ClientCreate, type ClientUpdate } from '@/services/clients-service'
import { toast } from 'sonner'
import { analytics } from '@/lib/analytics'

interface ClientFormDialogProps {
  isOpen: boolean
  onClose: () => void
  client?: Client
  onSave: () => void | Promise<void>
}

type PersonType = 'fisica' | 'juridica'

const getInitialFormData = (client?: Client) => {
  // Aplicar máscaras nos valores existentes
  const cpf_cnpj = client?.cpf_cnpj || ''
  const phone = client?.phone || ''
  const zip_code = client?.zip_code || ''
  
  // Detectar se é CPF ou CNPJ baseado no tamanho
  const numbers = cpf_cnpj.replace(/\D/g, '')
  const formattedCpfCnpj = numbers.length > 11 ? formatCNPJ(cpf_cnpj) : formatCPF(cpf_cnpj)
  
  return {
    name: client?.name ?? '',
    email: client?.email ?? '',
    phone: phone ? formatPhone(phone) : '',
    cpf_cnpj: formattedCpfCnpj,
    status: client?.status ?? ('active' as 'active' | 'inactive' | 'archived'),
    address: client?.address ?? '',
    city: client?.city ?? '',
    state: client?.state ?? '',
    zip_code: zip_code ? formatCEP(zip_code) : '',
    notes: client?.notes ?? '',
  }
}

const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return value
}

const formatCNPJ = (value: string) => {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 14) {
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
  }
  return value
}

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
  }
  return value
}

const formatCEP = (value: string) => {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 8) {
    return numbers.replace(/(\d{5})(\d)/, '$1-$2')
  }
  return value
}

interface ViaCEPResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

function ClientFormDialogBody({
  client,
  isEditing,
  onClose,
  onSave,
}: {
  client?: Client
  isEditing: boolean
  onClose: () => void
  onSave: () => void | Promise<void>
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(client))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingCEP, setIsLoadingCEP] = useState(false)
  
  // Determinar tipo de pessoa baseado no CPF/CNPJ existente
  const getInitialPersonType = (): PersonType => {
    if (client?.cpf_cnpj) {
      const numbers = client.cpf_cnpj.replace(/\D/g, '')
      return numbers.length > 11 ? 'juridica' : 'fisica'
    }
    return 'fisica'
  }
  
  const [personType, setPersonType] = useState<PersonType>(getInitialPersonType)

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
            newErrors.name = 'Nome é obrigatório'
          }

          if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Email inválido'
          }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório'
    }

    if (!formData.cpf_cnpj.trim()) {
      newErrors.cpf_cnpj = personType === 'fisica' ? 'CPF é obrigatório' : 'CNPJ é obrigatório'
    } else {
      const numbers = formData.cpf_cnpj.replace(/\D/g, '')
      if (personType === 'fisica' && numbers.length !== 11) {
        newErrors.cpf_cnpj = 'CPF deve ter 11 dígitos'
      } else if (personType === 'juridica' && numbers.length !== 14) {
        newErrors.cpf_cnpj = 'CNPJ deve ter 14 dígitos'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSaving(true)

    try {
      // Remover formatação dos campos
      const dataToSend = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone.replace(/\D/g, '') || undefined,
        cpf_cnpj: formData.cpf_cnpj.replace(/\D/g, '') || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip_code: formData.zip_code.replace(/\D/g, '') || undefined,
        notes: formData.notes || undefined,
        status: formData.status,
      }

      if (isEditing && client) {
        await clientsService.update(client.id, dataToSend as ClientUpdate)
        analytics.track('office_action', { entity: 'client', action: 'updated' })
        toast.success('Cliente atualizado com sucesso!')
      } else {
        await clientsService.create(dataToSend as ClientCreate)
        analytics.track('office_action', { entity: 'client', action: 'created', person_type: personType })
        toast.success('Cliente criado com sucesso!')
      }

      await onSave()
      onClose()
    } catch (error) {
      console.error('Error saving client:', error)
      toast.error(`Erro ao ${isEditing ? 'atualizar' : 'criar'} cliente`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }
  
  const handleCPFCNPJChange = (value: string) => {
    const formatted = personType === 'fisica' ? formatCPF(value) : formatCNPJ(value)
    handleChange('cpf_cnpj', formatted)
  }
  
  const handlePhoneChange = (value: string) => {
    handleChange('phone', formatPhone(value))
  }
  
  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value)
    handleChange('zip_code', formatted)
    
    const numbers = formatted.replace(/\D/g, '')
    if (numbers.length === 8) {
      setIsLoadingCEP(true)
      try {
        const response = await fetch(`https://viacep.com.br/ws/${numbers}/json/`)
        const data: ViaCEPResponse = await response.json()
        
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            address: data.logradouro || prev.address,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }))
          toast.success('CEP encontrado!')
        } else {
          toast.error('CEP não encontrado')
        }
      } catch (error) {
        console.error('Error fetching CEP:', error)
        toast.error('Erro ao buscar CEP')
      } finally {
        setIsLoadingCEP(false)
      }
    }
  }
  
  const handlePersonTypeChange = (type: PersonType) => {
    setPersonType(type)
    // Limpar CPF/CNPJ ao trocar tipo
    handleChange('cpf_cnpj', '')
    if (errors.cpf_cnpj) {
      setErrors((prev) => ({ ...prev, cpf_cnpj: '' }))
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
      <DialogHeader className="p-6 pb-2 shrink-0">
        <DialogTitle>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-5">
          {/* Tipo de Pessoa */}
          <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Tipo de Pessoa <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handlePersonTypeChange('fisica')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                personType === 'fisica'
                  ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'border-border bg-background text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <User className="h-4 w-4" />
              Pessoa Física
            </button>
            <button
              type="button"
              onClick={() => handlePersonTypeChange('juridica')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                personType === 'juridica'
                  ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'border-border bg-background text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <Building2 className="h-4 w-4" />
              Pessoa Jurídica
            </button>
          </div>
        </div>

        {/* Informações Básicas */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Informações Básicas</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {personType === 'fisica' ? 'Nome Completo' : 'Razão Social'} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.name ? 'border-destructive' : 'border-border'
                )}
                placeholder={personType === 'fisica' ? 'João da Silva' : 'Empresa Ltda'}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {personType === 'fisica' ? 'CPF' : 'CNPJ'} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.cpf_cnpj}
                onChange={(e) => handleCPFCNPJChange(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.cpf_cnpj ? 'border-destructive' : 'border-border'
                )}
                placeholder={personType === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                maxLength={personType === 'fisica' ? 14 : 18}
              />
              {errors.cpf_cnpj && <p className="mt-1 text-xs text-destructive">{errors.cpf_cnpj}</p>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.email ? 'border-destructive' : 'border-border'
                )}
                placeholder="contato@email.com"
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Telefone <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.phone ? 'border-destructive' : 'border-border'
                )}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
              {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value as 'active' | 'inactive' | 'archived')}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="archived">Arquivado</option>
            </select>
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Endereço</h3>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-1.5">CEP</label>
              <input
                type="text"
                value={formData.zip_code}
                onChange={(e) => handleCEPChange(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="00000-000"
                maxLength={9}
                disabled={isLoadingCEP}
              />
              {isLoadingCEP && (
                <div className="absolute right-3 top-9">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Cidade</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="São Paulo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Estado</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Logradouro</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Rua, Avenida, etc."
            />
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Observações</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            placeholder="Adicione observações sobre o cliente..."
          />
        </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border shrink-0 bg-background">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Cliente'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function ClientFormDialog({ isOpen, onClose, client, onSave }: ClientFormDialogProps) {
  const isEditing = !!client

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <ClientFormDialogBody
          key={client?.id ?? 'new'}
          client={client}
          isEditing={isEditing}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Dialog>
  )
}

