import { useState, useCallback, useRef, useEffect } from 'react'
import { Calculator, Loader2, ChevronDown, Briefcase, DollarSign, Shield, Moon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCreditsStore } from '@/stores/credits-store'
import { useOnboardingStore } from '@/features/onboarding'
import { analytics } from '@/lib/analytics'
import { AnalysisResultModal } from '@/features/ai/components/analysis-result-modal'
import { CalculationHistoryList } from './calculation-history-list'

interface RescisaoCalculatorProps {
  selectedClientId: string | null
}

const tipoRescisaoLabel: Record<string, string> = {
  sem_justa_causa: 'Dispensa sem Justa Causa',
  por_pedido: 'Pedido de Demissão',
  com_justa_causa: 'Dispensa com Justa Causa',
  acordo: 'Acordo (Reforma Trabalhista)',
  termino_contrato: 'Término de Contrato',
}

const avisoOptions: Record<string, { value: string; label: string }[]> = {
  sem_justa_causa: [
    { value: 'trabalhado', label: 'Trabalhado' },
    { value: 'indenizado', label: 'Indenizado' },
    { value: 'dispensado', label: 'Dispensado' },
  ],
  por_pedido: [
    { value: 'trabalhado', label: 'Trabalhado' },
    { value: 'nao_cumprido', label: 'Não cumprido' },
  ],
  com_justa_causa: [
    { value: 'dispensado', label: 'Dispensado' },
  ],
  acordo: [
    { value: 'trabalhado', label: 'Trabalhado' },
    { value: 'indenizado', label: 'Indenizado' },
    { value: 'dispensado', label: 'Dispensado' },
  ],
  termino_contrato: [
    { value: 'dispensado', label: 'Dispensado' },
  ],
}

export function RescisaoCalculator({ selectedClientId }: RescisaoCalculatorProps) {
  const { user } = useUser()
  const { credits, fetchCredits } = useCreditsStore()
  const { markCalculatorUsed } = useOnboardingStore()

  const [isCalculating, setIsCalculating] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  // Modal state for freshly generated result
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | undefined>()

  // Polling ref for PDF job
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  const [formData, setFormData] = useState({
    salarioBase: '',
    adicionalPericulosidade: false,
    basePericulosidade: '1621.00',
    adicionalInsalubridadeGrau: '0',
    baseInsalubridade: '1621.00',
    adicionalNoturnoPercent: '20',
    mediaHorasNoturnas: '',
    outrasVerbas: '',
    dataAdmissao: '',
    dataRescisao: '',
    tipoRescisao: 'sem_justa_causa',
    tipoAvisoPrevio: 'trabalhado',
    feriasVencidas: '',
  })

  const handleInputChange = useCallback(
    (field: keyof typeof formData, value: string | boolean) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value }

        // Auto-reset aviso prévio when tipo_rescisao changes
        if (field === 'tipoRescisao') {
          const opts = avisoOptions[value as string] || avisoOptions.sem_justa_causa
          const validValues = opts.map((o) => o.value)
          if (!validValues.includes(next.tipoAvisoPrevio)) {
            next.tipoAvisoPrevio = validValues[0]
          }
        }

        return next
      })
    },
    []
  )

  const handleCalculate = useCallback(async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado')
      return
    }

    await fetchCredits()
    if (credits && credits.total_available < 1) {
      toast.error('Créditos insuficientes. Recarregue para continuar.')
      return
    }

    setIsCalculating(true)

    analytics.track('feature_used', {
      feature: 'rescisao_calculator',
      action: 'started',
      tipo: formData.tipoRescisao,
    })

    try {
      const res = await fetchWithCredentials(`${API_URL}/calculators/trabalhista/rescisao-trabalhista`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(selectedClientId && { client_id: selectedClientId }),
          salario_base: parseFloat(formData.salarioBase) || 0,
          adicional_periculosidade: formData.adicionalPericulosidade,
          base_periculosidade: parseFloat(formData.basePericulosidade) || 1621.0,
          adicional_insalubridade_grau: parseInt(formData.adicionalInsalubridadeGrau) || 0,
          base_insalubridade: parseFloat(formData.baseInsalubridade) || 1621.0,
          adicional_noturno_percent: parseFloat(formData.adicionalNoturnoPercent) || 20,
          media_horas_noturnas: parseFloat(formData.mediaHorasNoturnas) || 0,
          outras_verbas: parseFloat(formData.outrasVerbas) || 0,
          data_admissao: formData.dataAdmissao,
          data_rescisao: formData.dataRescisao,
          tipo_rescisao: formData.tipoRescisao,
          tipo_aviso_previo: formData.tipoAvisoPrevio,
          ferias_vencidas: parseInt(formData.feriasVencidas) || 0,
          ferias_proporcionais: true,
          decimo_terceiro: true,
          export_pdf: true,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error((error as { detail?: string } | null)?.detail || 'Erro ao calcular rescisão')
      }

      markCalculatorUsed()

      const data = (await res.json()) as {
        pdf?: { job_id?: string; status?: string }
      }

      // Refresh history and credits
      setHistoryRefreshKey((k) => k + 1)
      fetchCredits()

      // Poll for PDF job completion if a job was enqueued
      if (data.pdf?.job_id) {
        const jobId = data.pdf.job_id
        let attempts = 0
        const maxAttempts = 60 // 2 minutes max

        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

        pollIntervalRef.current = setInterval(async () => {
          attempts++
          try {
            const statusRes = await fetchWithCredentials(`${API_URL}/ai/jobs/${encodeURIComponent(jobId)}`)
            if (!statusRes.ok) {
              if (attempts >= maxAttempts) {
                clearInterval(pollIntervalRef.current!)
                pollIntervalRef.current = null
                setIsCalculating(false)
                toast.error('Tempo esgotado ao gerar PDF')
              }
              return
            }

            const statusData = (await statusRes.json()) as {
              status: string
              result?: { document_id?: string; download_url?: string }
              error?: string
            }

            if (statusData.status === 'completed') {
              clearInterval(pollIntervalRef.current!)
              pollIntervalRef.current = null
              setIsCalculating(false)
              setHistoryRefreshKey((k) => k + 1)

              // Get download URL from result or fetch via unified endpoint
              const downloadUrl = statusData.result?.download_url
              const documentId = statusData.result?.document_id

              if (downloadUrl) {
                setGeneratedPdfUrl(downloadUrl)
                setIsResultModalOpen(true)
              } else if (documentId) {
                const dlRes = await fetchWithCredentials(`${API_URL}/documents/${documentId}/download`)
                if (dlRes.ok) {
                  const dlData = (await dlRes.json()) as { download_url: string }
                  setGeneratedPdfUrl(dlData.download_url)
                  setIsResultModalOpen(true)
                } else {
                  toast.success('PDF gerado! Acesse pelo histórico.')
                }
              } else {
                toast.success('Cálculo realizado com sucesso')
              }

              analytics.track('feature_used', {
                feature: 'rescisao_calculator',
                action: 'completed',
                success: true,
              })
            } else if (statusData.status === 'failed') {
              clearInterval(pollIntervalRef.current!)
              pollIntervalRef.current = null
              setIsCalculating(false)
              toast.error(statusData.error || 'Erro ao gerar PDF')
            }
          } catch {
            // Silently continue polling on network errors
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollIntervalRef.current!)
            pollIntervalRef.current = null
            setIsCalculating(false)
            toast.error('Tempo esgotado ao gerar PDF')
          }
        }, 2000)
      } else {
        setIsCalculating(false)
        toast.success('Cálculo realizado com sucesso')

        analytics.track('feature_used', {
          feature: 'rescisao_calculator',
          action: 'completed',
          success: true,
        })
      }
    } catch (err) {
      setIsCalculating(false)
      analytics.track('feature_used', {
        feature: 'rescisao_calculator',
        action: 'failed',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular rescisão')
    }
  }, [formData, selectedClientId, user, credits, fetchCredits, markCalculatorUsed])

  const currentAvisoOptions = avisoOptions[formData.tipoRescisao] || avisoOptions.sem_justa_causa

  const adicionalRisco = formData.adicionalPericulosidade
    ? 'periculosidade'
    : formData.adicionalInsalubridadeGrau !== '0'
      ? 'insalubridade'
      : 'nenhum'

  const inputClass =
    'w-full bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground/50'
  const labelClass = 'block text-xs font-medium text-muted-foreground mb-1.5'
  const sectionClass = 'space-y-4'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1">
      {/* Left: Input form */}
      <div className="lg:col-span-3 flex flex-col">
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="flex-1 p-5 space-y-6">

            {/* Seção 1: Contrato */}
            <div className={sectionClass}>
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Dados do Contrato</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Data de Admissão</label>
                  <input
                    type="date"
                    value={formData.dataAdmissao}
                    onChange={(e) => handleInputChange('dataAdmissao', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Data de Rescisão</label>
                  <input
                    type="date"
                    value={formData.dataRescisao}
                    onChange={(e) => handleInputChange('dataRescisao', e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className={labelClass}>Motivo da Rescisão</label>
                  <div className="relative">
                    <select
                      value={formData.tipoRescisao}
                      onChange={(e) => handleInputChange('tipoRescisao', e.target.value)}
                      className={cn(inputClass, 'appearance-none pr-8')}
                    >
                      {Object.entries(tipoRescisaoLabel).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Aviso Prévio</label>
                  <div className="relative">
                    <select
                      value={formData.tipoAvisoPrevio}
                      onChange={(e) => handleInputChange('tipoAvisoPrevio', e.target.value)}
                      className={cn(inputClass, 'appearance-none pr-8')}
                      disabled={currentAvisoOptions.length === 1}
                    >
                      {currentAvisoOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 2: Remuneração */}
            <div className={sectionClass}>
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Remuneração</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Salário Base (CTPS)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                    <input
                      type="number"
                      value={formData.salarioBase}
                      onChange={(e) => handleInputChange('salarioBase', e.target.value)}
                      className={cn(inputClass, 'pl-9 font-semibold')}
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Outras Verbas</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <input
                      type="number"
                      value={formData.outrasVerbas}
                      onChange={(e) => handleInputChange('outrasVerbas', e.target.value)}
                      className={cn(inputClass, 'pl-9')}
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Férias Vencidas (dias)</label>
                  <input
                    type="number"
                    value={formData.feriasVencidas}
                    onChange={(e) => handleInputChange('feriasVencidas', e.target.value)}
                    className={inputClass}
                    placeholder="0"
                    min="0"
                    max="365"
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Adicionais */}
            <div className={sectionClass}>
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Adicionais</h3>
                <span className="ml-auto text-[10px] text-muted-foreground">Opcional</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Periculosidade / Insalubridade */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                  <span className="text-xs font-medium text-muted-foreground">Periculosidade / Insalubridade</span>

                  <div className="flex gap-1.5">
                    {[
                      { value: 'nenhum', label: 'Nenhum' },
                      { value: 'periculosidade', label: 'Peric. 30%' },
                      { value: 'insalubridade', label: 'Insal.' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (opt.value === 'nenhum') {
                            setFormData((prev) => ({ ...prev, adicionalPericulosidade: false, adicionalInsalubridadeGrau: '0' }))
                          } else if (opt.value === 'periculosidade') {
                            setFormData((prev) => ({ ...prev, adicionalPericulosidade: true, adicionalInsalubridadeGrau: '0' }))
                          } else {
                            setFormData((prev) => ({ ...prev, adicionalPericulosidade: false, adicionalInsalubridadeGrau: '20' }))
                          }
                        }}
                        className={cn(
                          'flex-1 py-1.5 rounded-md border text-xs font-medium transition-all',
                          adicionalRisco === opt.value
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400'
                            : 'bg-background border-input text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {formData.adicionalInsalubridadeGrau !== '0' && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Grau de insalubridade</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Base: R$ {parseFloat(formData.baseInsalubridade).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {[
                          { val: '10', label: 'Mínimo 10%' },
                          { val: '20', label: 'Médio 20%' },
                          { val: '40', label: 'Máximo 40%' },
                        ].map((g) => (
                          <button
                            key={g.val}
                            type="button"
                            onClick={() => handleInputChange('adicionalInsalubridadeGrau', g.val)}
                            className={cn(
                              'flex-1 py-1.5 rounded-md border text-xs font-medium transition-all',
                              formData.adicionalInsalubridadeGrau === g.val
                                ? 'bg-blue-500 border-blue-600 text-white'
                                : 'bg-background border-input text-muted-foreground hover:bg-muted/50'
                            )}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Noturno */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Moon className="h-3 w-3 text-indigo-500" />
                      Adicional Noturno
                    </span>
                    <span className="text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                      {formData.adicionalNoturnoPercent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Percentual</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.adicionalNoturnoPercent}
                          onChange={(e) => handleInputChange('adicionalNoturnoPercent', e.target.value)}
                          className={cn(inputClass, 'pr-8 text-xs')}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Média de Horas</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.mediaHorasNoturnas}
                          onChange={(e) => handleInputChange('mediaHorasNoturnas', e.target.value)}
                          placeholder="0"
                          className={cn(inputClass, 'pr-8 text-xs')}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botão */}
          <div className="p-4 border-t border-border bg-muted/5">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={isCalculating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg font-semibold text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Calcular Rescisão
            </button>
          </div>
        </div>
      </div>

      {/* Right: History */}
      <div className="lg:col-span-2 flex flex-col">
        <CalculationHistoryList
          calculatorKey="trabalhista.rescisao-trabalhista"
          clientId={selectedClientId}
          title="Histórico de Cálculos"
          refreshKey={historyRefreshKey}
        />
      </div>

      {/* Modal for freshly generated PDF */}
      <AnalysisResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        title="Rescisão Trabalhista"
        pdfUrl={generatedPdfUrl}
        onDownload={
          generatedPdfUrl
            ? () => {
                window.open(generatedPdfUrl, '_blank')
              }
            : undefined
        }
      />
    </div>
  )
}
