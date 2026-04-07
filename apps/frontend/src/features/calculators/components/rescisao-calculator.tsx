import { useState, useCallback, useRef, useEffect } from 'react'
import { Calculator, Loader2, ChevronDown, Briefcase, DollarSign, Shield, Moon, History, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCreditsStore } from '@/stores/credits-store'
import { useOnboardingStore } from '@/features/onboarding'
import { analytics } from '@/lib/analytics'
import { AnalysisResultModal } from '@/features/ai/components/analysis-result-modal'
import { CalculationHistoryList } from './calculation-history-list'
import { HistoryBottomSheet } from '@/features/ai/components/history-bottom-sheet'

interface RescisaoCalculatorProps {
  selectedClientId: string | null
}

type RescisaoDetalhes = {
  remuneracao_bruta: number
  total_bruto: number
  total_descontos: number
  total: number
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [latestCalculationId, setLatestCalculationId] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<RescisaoDetalhes | null>(null)

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

  const formatCurrency = useCallback((value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    })
  }, [])

  const startPdfPolling = useCallback((jobId: string) => {
    let attempts = 0
    const maxAttempts = 60 // 2 minutes max

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

    pollIntervalRef.current = setInterval(async () => {
      attempts++
      try {
        const statusRes = await fetchWithCredentials(`${API_URL}/jobs/${encodeURIComponent(jobId)}`)
        if (!statusRes.ok) {
          if (attempts >= maxAttempts) {
            clearInterval(pollIntervalRef.current!)
            pollIntervalRef.current = null
            setIsGeneratingPdf(false)
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
          setIsGeneratingPdf(false)
          setHistoryRefreshKey((k) => k + 1)

          const downloadUrl = statusData.result?.download_url
          const documentId = statusData.result?.document_id

          if (downloadUrl) {
            setGeneratedPdfUrl(downloadUrl)
            setIsResultModalOpen(true)
            toast.success('PDF gerado com sucesso')
          } else if (documentId) {
            const dlRes = await fetchWithCredentials(`${API_URL}/documents/${documentId}/download`)
            if (dlRes.ok) {
              const dlData = (await dlRes.json()) as { download_url: string }
              setGeneratedPdfUrl(dlData.download_url)
              setIsResultModalOpen(true)
              toast.success('PDF gerado com sucesso')
            } else {
              toast.success('PDF gerado! Acesse pelo histórico.')
            }
          } else {
            toast.success('PDF gerado! Acesse pelo histórico.')
          }

          analytics.track('feature_used', {
            feature: 'rescisao_calculator',
            action: 'pdf_completed',
            success: true,
          })
        } else if (statusData.status === 'failed') {
          clearInterval(pollIntervalRef.current!)
          pollIntervalRef.current = null
          setIsGeneratingPdf(false)
          toast.error(statusData.error || 'Erro ao gerar PDF')
        }
      } catch {
        // Silently continue polling on network errors
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollIntervalRef.current!)
        pollIntervalRef.current = null
        setIsGeneratingPdf(false)
        toast.error('Tempo esgotado ao gerar PDF')
      }
    }, 2000)
  }, [])

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
          export_pdf: false,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error((error as { detail?: string } | null)?.detail || 'Erro ao calcular rescisão')
      }

      markCalculatorUsed()

      const data = (await res.json()) as {
        calculation_id?: string
        detalhes?: RescisaoDetalhes
      }

      setLatestCalculationId(data.calculation_id || null)
      setLatestResult(data.detalhes || null)
      setIsCalculating(false)

      // Refresh history and credits
      setHistoryRefreshKey((k) => k + 1)
      fetchCredits()

      toast.success('Cálculo realizado com sucesso')

      analytics.track('feature_used', {
        feature: 'rescisao_calculator',
        action: 'completed',
        success: true,
      })
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

  const handleGeneratePdf = useCallback(async () => {
    if (!latestCalculationId) {
      toast.error('Faça um cálculo antes de gerar o PDF')
      return
    }

    setIsGeneratingPdf(true)

    analytics.track('feature_used', {
      feature: 'rescisao_calculator',
      action: 'pdf_requested',
      calculation_id: latestCalculationId,
    })

    try {
      const res = await fetchWithCredentials(
        `${API_URL}/calculators/trabalhista/rescisao-trabalhista/${encodeURIComponent(latestCalculationId)}/pdf`,
        {
          method: 'POST',
        }
      )

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error((error as { detail?: string } | null)?.detail || 'Erro ao gerar PDF')
      }

      const data = (await res.json()) as { job_id?: string }
      if (!data.job_id) {
        throw new Error('Resposta inválida ao enfileirar PDF')
      }

      toast.success('PDF em geração. Você pode continuar usando a calculadora.')
      startPdfPolling(data.job_id)
    } catch (err) {
      setIsGeneratingPdf(false)
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PDF')
    }
  }, [latestCalculationId, startPdfPolling])

  const currentAvisoOptions = avisoOptions[formData.tipoRescisao] || avisoOptions.sem_justa_causa
  const currentAvisoLabel =
    currentAvisoOptions.find((opt) => opt.value === formData.tipoAvisoPrevio)?.label ||
    formData.tipoAvisoPrevio
  const currentTipoLabel = tipoRescisaoLabel[formData.tipoRescisao] || formData.tipoRescisao

  const totalBruto = latestResult?.total_bruto ?? 0
  const totalDescontos = latestResult?.total_descontos ?? 0
  const totalLiquido = latestResult?.total ?? 0
  const liquidoPercent = totalBruto > 0 ? Math.max(0, Math.min(100, (totalLiquido / totalBruto) * 100)) : 0

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
    <div className="h-full lg:grid lg:grid-cols-5 lg:gap-4 lg:min-h-0">
      {/* Left: Input form */}
      <div className="lg:col-span-3 flex flex-col lg:min-h-0">
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden lg:h-full">
          <div className="p-5 space-y-6 lg:flex-1 lg:overflow-y-auto lg:custom-scrollbar">

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

          {/* Botão + histórico mobile */}
          <div className="p-4 border-t border-border bg-muted/5 flex-shrink-0 space-y-2">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={isCalculating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg font-semibold text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Calcular Rescisão
            </button>

            {latestResult && (
              <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Resultado da Simulação</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {currentTipoLabel} &middot; Aviso {currentAvisoLabel}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    Instantâneo
                  </span>
                </div>

                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 uppercase tracking-wide">
                    Total Líquido Estimado
                  </p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 leading-tight mt-1">
                    {formatCurrency(totalLiquido)}
                  </p>

                  <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${liquidoPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Líquido representa {liquidoPercent.toFixed(1)}% do total bruto.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-background/80 border border-border p-2.5">
                    <p className="text-[10px] text-muted-foreground">Total Bruto</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{formatCurrency(totalBruto)}</p>
                  </div>

                  <div className="rounded-md bg-background/80 border border-border p-2.5">
                    <p className="text-[10px] text-muted-foreground">Descontos</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{formatCurrency(totalDescontos)}</p>
                  </div>

                  <div className="rounded-md bg-background/80 border border-border p-2.5 col-span-2">
                    <p className="text-[10px] text-muted-foreground">Remuneração Base de Cálculo</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {formatCurrency(latestResult.remuneracao_bruta)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf || !latestCalculationId}
                  className="w-full flex items-center justify-center gap-2 border border-input hover:bg-muted/60 px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {isGeneratingPdf ? 'Gerando PDF...' : 'Gerar PDF do Resultado'}
                </button>
              </div>
            )}

            <HistoryBottomSheet
              trigger={(open) => (
                <button
                  type="button"
                  onClick={open}
                  className="lg:hidden flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <History className="h-4 w-4" />
                  <span>Ver histórico de cálculos</span>
                </button>
              )}
            >
              <CalculationHistoryList
                calculatorKey="trabalhista.rescisao-trabalhista"
                clientId={selectedClientId}
                title="Histórico de Cálculos"
                refreshKey={historyRefreshKey}
              />
            </HistoryBottomSheet>
          </div>
        </div>
      </div>

      {/* Right: History — desktop only */}
      <div className="hidden lg:flex lg:col-span-2 flex-col min-h-0">
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
