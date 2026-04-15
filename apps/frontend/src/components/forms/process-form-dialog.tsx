import { useState, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ClientSelect } from '@/components/ui/client-select'
import { processesService, type ClientRole, type ProcessCategory, type ProcessCreate, type ProcessUpdate, type ProcessValidationResponse } from '@/services/processes-service'
import { PROCESS_AREAS, PROCESS_TYPES, TRIBUNALS } from '@/lib/constants'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Client } from '@/services/clients-service'
import { analytics } from '@/lib/analytics'

export interface ProcessFormData {
  id: string
  process_number: string
  process_category: ProcessCategory
  type: string
  area: string
  court: string
  tribunal: string
  client_id: string
  client_name?: string
  defendant: string
  client_role: ClientRole
  value: number
  status: 'active' | 'concluded' | 'cancelled'
  start_date?: string
  notes?: string
  is_partnership: boolean
  partner_lawyer?: string
  partner_percentage?: number
}

interface ProcessFormDialogProps {
  isOpen: boolean
  onClose: () => void
  process?: ProcessFormData
  /** Cliente pre-selecionado (para fluxo de cadeia) */
  preselectedClient?: Client
  onSave: (process: ProcessFormData) => void
}

const formatCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const cents = parseInt(digits, 10)
  const reais = cents / 100
  return reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const parseCurrencyToNumber = (formatted: string): number => {
  if (!formatted) return 0
  const cleaned = formatted.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

const numberToCurrencyDisplay = (value: number | string | null | undefined): string => {
  if (value == null) return ''
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || num === 0) return ''
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const getInitialFormData = (process?: ProcessFormData, preselectedClient?: Client) => ({
  process_number: process?.process_number ?? '',
  process_category: process?.process_category ?? ('judicial' as ProcessCategory),
  type: process?.type ?? '',
  area: process?.area ?? '',
  court: process?.court ?? '',
  tribunal: process?.tribunal ?? '',
  client_id: process?.client_id ?? preselectedClient?.id ?? '',
  defendant: process?.defendant ?? '',
  client_role: process?.client_role ?? ('author' as ClientRole),
  value: numberToCurrencyDisplay(process?.value),
  status: process?.status ?? ('active' as ProcessFormData['status']),
  start_date: process?.start_date ?? '',
  notes: process?.notes ?? '',
  is_partnership: process?.is_partnership ?? false,
  partner_lawyer: process?.partner_lawyer ?? '',
  partner_percentage: process?.partner_percentage?.toString() ?? '',
})

function ProcessFormDialogBody({
  process,
  preselectedClient,
  isEditing,
  onClose,
  onSave,
}: {
  process?: ProcessFormData
  preselectedClient?: Client
  isEditing: boolean
  onClose: () => void
  onSave: (process: ProcessFormData) => void
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(process, preselectedClient))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedClient, setSelectedClient] = useState<Client | null>(preselectedClient ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const validationCache = useRef<Map<string, ProcessValidationResponse>>(new Map())
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyValidationResult = useCallback((res: ProcessValidationResponse, currentRole: ClientRole) => {
    setFormData((prev) => ({
      ...prev,
      court: prev.court || res.court || prev.court,
      tribunal: prev.tribunal || res.tribunal || prev.tribunal,
      type: prev.type || res.process_class || prev.type,
      area: prev.area || res.inferred_area || prev.area,
      start_date: prev.start_date || res.start_date || prev.start_date,
      value: prev.value || (res.valor_causa ? numberToCurrencyDisplay(res.valor_causa) : prev.value),
      defendant: prev.defendant || (
        currentRole === 'author'
          ? res.defendants.join(', ')
          : res.plaintiffs.join(', ')
      ),
    }))
  }, [])

  const validateEffect = useCallback(async (processNumber: string, currentRole: ClientRole) => {
    const cached = validationCache.current.get(processNumber)
    if (cached) {
      if (cached.is_valid) applyValidationResult(cached, currentRole)
      return
    }

    setIsValidating(true)
    try {
      const response = await processesService.validateProcessNumber(processNumber)
      validationCache.current.set(processNumber, response)

      if (response.is_valid) {
        applyValidationResult(response, currentRole)
        toast.success('Processo localizado!')
      } else {
        toast.info('Processo não localizado. Preencha os dados manualmente.')
      }
    } catch {
      toast.error('Não foi possível verificar o processo. Tente novamente.')
    } finally {
      setIsValidating(false)
    }
  }, [applyValidationResult])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.process_number.trim()) {
      newErrors.process_number = formData.process_category === 'judicial'
        ? 'Número do processo é obrigatório'
        : 'Número / protocolo é obrigatório'
    }

    if (!formData.type.trim()) {
      newErrors.type = 'Tipo de processo é obrigatório'
    }

    if (!formData.area.trim()) {
      newErrors.area = 'Área do direito é obrigatória'
    }

    if (formData.process_category === 'judicial') {
      if (!formData.court.trim()) {
        newErrors.court = 'Vara é obrigatória'
      }
      if (!formData.tribunal.trim()) {
        newErrors.tribunal = 'Tribunal é obrigatório'
      }
    }

    if (!formData.client_id) {
      newErrors.client_id = 'Selecione um cliente'
    }

    if (!formData.defendant.trim()) {
      newErrors.defendant = 'Parte contrária é obrigatória'
    }

    if (formData.is_partnership) {
      if (!formData.partner_lawyer.trim()) {
        newErrors.partner_lawyer = 'Advogado(a) parceiro(a) é obrigatório'
      }
      const pct = parseFloat(formData.partner_percentage)
      if (!formData.partner_percentage || isNaN(pct) || pct < 0 || pct > 100) {
        newErrors.partner_percentage = 'Informe um percentual válido entre 0 e 100'
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
      if (isEditing && process) {
        // Update existente
        const payload: ProcessUpdate = {
          process_number: formData.process_number,
          process_category: formData.process_category,
          type: formData.type,
          area: formData.area,
          court: formData.court || undefined,
          tribunal: formData.tribunal || undefined,
          defendant: formData.defendant || undefined,
          client_role: formData.client_role,
          value: formData.value ? parseCurrencyToNumber(formData.value) : undefined,
          notes: formData.notes || undefined,
          start_date: formData.start_date || undefined,
          status: formData.status,
          is_partnership: formData.is_partnership,
          partner_lawyer: formData.is_partnership ? formData.partner_lawyer || undefined : undefined,
          partner_percentage: formData.is_partnership && formData.partner_percentage
            ? parseFloat(formData.partner_percentage)
            : undefined,
        }

        const updated = await processesService.update(process.id, payload)

        const updatedProcess: ProcessFormData = {
          ...process,
          ...updated,
          client_name: selectedClient?.name ?? process.client_name,
          process_category: updated.process_category,
          area: updated.area || '',
          court: updated.court || '',
          tribunal: updated.tribunal || '',
          defendant: updated.defendant || '',
          client_role: updated.client_role,
          value: updated.value || 0,
          start_date: updated.start_date || undefined,
          notes: updated.notes || undefined,
          is_partnership: updated.is_partnership ?? false,
          partner_lawyer: updated.partner_lawyer ?? undefined,
          partner_percentage: updated.partner_percentage ?? undefined,
        }
        
        analytics.track('office_action', { entity: 'process', action: 'updated', category: formData.process_category, area: formData.area })
        toast.success('Processo atualizado com sucesso!')
        onSave(updatedProcess)
        onClose()
      } else {
        // Criar novo
        const payload: ProcessCreate = {
          client_id: formData.client_id,
          process_number: formData.process_number,
          process_category: formData.process_category,
          type: formData.type,
          area: formData.area,
          court: formData.court || undefined,
          tribunal: formData.tribunal || undefined,
          defendant: formData.defendant || undefined,
          client_role: formData.client_role,
          value: formData.value ? parseCurrencyToNumber(formData.value) : undefined,
          notes: formData.notes || undefined,
          start_date: formData.start_date || undefined,
          is_partnership: formData.is_partnership,
          partner_lawyer: formData.is_partnership ? formData.partner_lawyer || undefined : undefined,
          partner_percentage: formData.is_partnership && formData.partner_percentage
            ? parseFloat(formData.partner_percentage)
            : undefined,
        }

        const created = await processesService.create(payload)

        const savedProcess: ProcessFormData = {
          id: created.id,
          process_number: created.process_number,
          process_category: created.process_category,
          type: created.type,
          area: created.area || '',
          court: created.court || '',
          tribunal: created.tribunal || '',
          client_id: created.client_id,
          client_name: selectedClient?.name,
          defendant: created.defendant || '',
          client_role: created.client_role,
          value: created.value || 0,
          status: created.status as ProcessFormData['status'],
          start_date: created.start_date || undefined,
          notes: created.notes || undefined,
          is_partnership: created.is_partnership ?? false,
          partner_lawyer: created.partner_lawyer ?? undefined,
          partner_percentage: created.partner_percentage ?? undefined,
        }

        analytics.track('office_action', { entity: 'process', action: 'created', category: formData.process_category, area: formData.area })
        toast.success('Processo criado com sucesso!')
        onSave(savedProcess)
        onClose()
      }
    } catch {
      toast.error('Erro ao salvar processo')
    } finally {
      setIsSaving(false)
    }
  }

  const formatProcessNumber = (value: string): string => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '')
    
    // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
    // 7 dígitos - 2 dígitos - 4 dígitos - 1 dígito - 2 dígitos - 4 dígitos
    if (numbers.length <= 7) {
      return numbers
    } else if (numbers.length <= 9) {
      return `${numbers.slice(0, 7)}-${numbers.slice(7)}`
    } else if (numbers.length <= 13) {
      return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9)}`
    } else if (numbers.length <= 14) {
      return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13)}`
    } else if (numbers.length <= 16) {
      return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13, 14)}.${numbers.slice(14)}`
    } else {
      return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13, 14)}.${numbers.slice(14, 16)}.${numbers.slice(16, 20)}`
    }
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    if (field === 'process_number') {
      // Aplica máscara CNJ apenas para processos judiciais
      const formatted = formData.process_category === 'judicial' ? formatProcessNumber(value) : value
      setFormData((prev) => ({ ...prev, [field]: formatted }))

      // Dispara busca automática ao completar o número CNJ (25 chars) com debounce
      if (formData.process_category === 'judicial' && formatted.length === 25) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        const currentRole = formData.client_role
        debounceTimer.current = setTimeout(() => {
          validateEffect(formatted, currentRole)
        }, 800)
      } else {
        // Cancela busca pendente se usuário apagou dígitos
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
      }
    } else if (field === 'value') {
      setFormData((prev) => ({ ...prev, [field]: formatCurrencyInput(value) }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleClientChange = (clientId: string | null, client: Client | null) => {
    setSelectedClient(client)
    setFormData((prev) => ({ ...prev, client_id: clientId || '' }))
    if (errors.client_id && clientId) {
      setErrors((prev) => ({ ...prev, client_id: '' }))
    }
  }

  // ClientSelect irá buscar os dados completos se initialClient não for passado
  const initialClient = isEditing ? undefined : preselectedClient

  return (
    <DialogContent
      className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
    >
      <DialogHeader className="p-6 pb-2 shrink-0">
        <DialogTitle>{isEditing ? 'Editar Processo' : 'Novo Processo'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
          {/* Cliente - sempre visivel mas travado se edicao ou pre-selecionado */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Cliente</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Selecione o Cliente <span className="text-destructive">*</span>
              </label>
              <ClientSelect
                value={formData.client_id}
                onChange={handleClientChange}
                initialClient={initialClient}
                error={errors.client_id}
                placeholder="Buscar cliente por nome, CPF ou email..."
                disabled={isEditing || !!preselectedClient}
              />
            </div>
          </div>

          {/* Informacoes Basicas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Informações do Processo</h3>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Natureza <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'judicial', label: 'Judicial', description: 'Número CNJ' },
                  { value: 'administrative', label: 'Administrativo', description: 'Protocolo / número livre' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      handleChange('process_category', option.value)
                      // Limpa número ao trocar categoria para evitar máscara errada
                      if (option.value !== formData.process_category) {
                        handleChange('process_number', '')
                      }
                    }}
                    className={cn(
                      'flex flex-col items-start px-4 py-3 rounded-lg border-2 text-left transition-all',
                      formData.process_category === option.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/40'
                    )}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Número do processo */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {formData.process_category === 'judicial' ? 'Número do Processo' : 'Número / Protocolo'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.process_number}
                  onChange={(e) => handleChange('process_number', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.process_number ? 'border-destructive' : 'border-border'
                  )}
                  placeholder={
                    formData.process_category === 'judicial'
                      ? '0000000-00.0000.0.00.0000'
                      : 'Ex: 12345/2026, INSS-001/2024'
                  }
                />
                {isValidating && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {errors.process_number && <p className="mt-1 text-xs text-destructive">{errors.process_number}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Área do Direito <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.area}
                  onChange={(e) => handleChange('area', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.area ? 'border-destructive' : 'border-border'
                  )}
                >
                  <option value="">Selecione...</option>
                  {PROCESS_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                {errors.area && <p className="mt-1 text-xs text-destructive">{errors.area}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Tipo de Processo <span className="text-destructive">*</span>
                </label>
                <input
                  list="process-types"
                  type="text"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.type ? 'border-destructive' : 'border-border'
                  )}
                  placeholder="Selecione ou digite..."
                />
                <datalist id="process-types">
                  {PROCESS_TYPES.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
                {errors.type && <p className="mt-1 text-xs text-destructive">{errors.type}</p>}
              </div>

              {formData.process_category === 'judicial' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Tribunal <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.tribunal}
                      onChange={(e) => handleChange('tribunal', e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                        errors.tribunal ? 'border-destructive' : 'border-border'
                      )}
                    >
                      <option value="">Selecione...</option>
                      {TRIBUNALS.map((tribunal) => (
                        <option key={tribunal} value={tribunal}>
                          {tribunal}
                        </option>
                      ))}
                    </select>
                    {errors.tribunal && <p className="mt-1 text-xs text-destructive">{errors.tribunal}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Vara <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.court}
                      onChange={(e) => handleChange('court', e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                        errors.court ? 'border-destructive' : 'border-border'
                      )}
                      placeholder="Ex: 1ª Vara Cível"
                    />
                    {errors.court && <p className="mt-1 text-xs text-destructive">{errors.court}</p>}
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Órgão / Entidade
                  </label>
                  <input
                    type="text"
                    value={formData.court}
                    onChange={(e) => handleChange('court', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ex: INSS, Receita Federal, Prefeitura de SP"
                  />
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Valor da Causa
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.value}
                    onChange={(e) => handleChange('value', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Data de Distribuição
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as ProcessFormData['status'])}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="active">Ativo</option>
                <option value="concluded">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Partes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Partes</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Meu cliente é o <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'author', label: 'Autor / Reclamante', description: 'Quem move a ação' },
                  { value: 'defendant', label: 'Réu / Reclamado', description: 'Quem responde à ação' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChange('client_role', option.value)}
                    className={cn(
                      'flex flex-col items-start px-4 py-3 rounded-lg border-2 text-left transition-all',
                      formData.client_role === option.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/40'
                    )}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {formData.client_role === 'author' ? 'Réu / Reclamado' : 'Autor / Reclamante'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.defendant}
                onChange={(e) => handleChange('defendant', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.defendant ? 'border-destructive' : 'border-border'
                )}
                placeholder={formData.client_role === 'author' ? 'Nome do réu ou reclamado' : 'Nome do autor ou reclamante'}
              />
              {errors.defendant && (
                <p className="mt-1 text-xs text-destructive">{errors.defendant}</p>
              )}
            </div>
          </div>

          {/* Parceria */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Parceria</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Este processo é conduzido em parceria com outro advogado(a)?</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.is_partnership}
                onClick={() => {
                  setFormData((prev) => ({ ...prev, is_partnership: !prev.is_partnership }))
                  if (errors.partner_lawyer || errors.partner_percentage) {
                    setErrors((prev) => ({ ...prev, partner_lawyer: '', partner_percentage: '' }))
                  }
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  formData.is_partnership ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    formData.is_partnership ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {formData.is_partnership && (
              <div className="space-y-4 pl-0 border-l-2 border-purple-500/30 pl-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Advogado(a) Parceiro(a) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.partner_lawyer}
                    onChange={(e) => handleChange('partner_lawyer', e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                      errors.partner_lawyer ? 'border-destructive' : 'border-border'
                    )}
                    placeholder="Nome ou OAB do advogado(a) parceiro(a)"
                  />
                  {errors.partner_lawyer && <p className="mt-1 text-xs text-destructive">{errors.partner_lawyer}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    % do Ganho do Escritório <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.partner_percentage}
                      onChange={(e) => handleChange('partner_percentage', e.target.value)}
                      className={cn(
                        'w-full pr-10 px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                        errors.partner_percentage ? 'border-destructive' : 'border-border'
                      )}
                      placeholder="Ex: 70"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Percentual dos honorários que fica com o escritório</p>
                  {errors.partner_percentage && <p className="mt-1 text-xs text-destructive">{errors.partner_percentage}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Descricao */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Observações sobre o processo..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border shrink-0 bg-background">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alteracoes' : 'Criar Processo'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function ProcessFormDialog({ isOpen, onClose, process, preselectedClient, onSave }: ProcessFormDialogProps) {
  const isEditing = !!process

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <ProcessFormDialogBody
          key={process?.id ?? preselectedClient?.id ?? 'new'}
          process={process}
          preselectedClient={preselectedClient}
          isEditing={isEditing}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Dialog>
  )
}
