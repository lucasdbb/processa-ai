
import { useState, useCallback, useRef, useEffect } from 'react'
import { Calculator, Loader2, Calendar, DollarSign, Percent, AlertTriangle, Moon, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCreditsStore } from '@/stores/credits-store'
import { analytics } from '@/lib/analytics'
import { AnalysisResultModal } from '@/features/ai/components/analysis-result-modal'
import { CalculationHistoryList } from './calculation-history-list'

interface RescisaoCalculatorProps {
  selectedClientId: string | null
}

export function RescisaoCalculator({ selectedClientId }: RescisaoCalculatorProps) {
  const { user } = useUser()
  const { credits, fetchCredits } = useCreditsStore()

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
    avisoPrevio: true,
    feriasVencidas: '',
    feriasProporcionais: true,
    decimoTerceiro: true,
  })

  const handleInputChange = useCallback(
    (field: keyof typeof formData, value: string | boolean) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
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
          user_id: user.id,
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
          aviso_previo: formData.avisoPrevio,
          ferias_vencidas: parseInt(formData.feriasVencidas) || 0,
          ferias_proporcionais: formData.feriasProporcionais,
          decimo_terceiro: formData.decimoTerceiro,
          export_pdf: true,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error((error as { detail?: string } | null)?.detail || 'Erro ao calcular rescisão')
      }

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
  }, [formData, selectedClientId, user, credits, fetchCredits])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1">
      {/* Left: Input form */}
      <div className="lg:col-span-3 flex flex-col">
        <div className="bg-card border border-border rounded-xl flex flex-col">
          <div className="flex-1 p-4">
            <div className="space-y-5">
              {/* Grupo 1: Dados e Valores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coluna Esquerda: Datas e Motivo */}
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Dados do Contrato
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-1">
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Admissão *</label>
                      <input
                        type="date"
                        value={formData.dataAdmissao}
                        onChange={(e) => handleInputChange('dataAdmissao', e.target.value)}
                        className="w-full px-2 py-1.5 bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-none transition-all text-xs h-8"
                        required
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Rescisão *</label>
                      <input
                        type="date"
                        value={formData.dataRescisao}
                        onChange={(e) => handleInputChange('dataRescisao', e.target.value)}
                        className="w-full px-2 py-1.5 bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-none transition-all text-xs h-8"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Motivo *</label>
                      <div className="relative">
                        <select
                          value={formData.tipoRescisao}
                          onChange={(e) => handleInputChange('tipoRescisao', e.target.value)}
                          className="w-full px-2 py-1.5 bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-none transition-all appearance-none text-xs h-8"
                        >
                          <option value="sem_justa_causa">Dispensa sem Justa Causa</option>
                          <option value="por_pedido">Pedido de Demissão</option>
                          <option value="com_justa_causa">Dispensa com Justa Causa</option>
                          <option value="acordo">Acordo (Reforma Trabalhista)</option>
                          <option value="termino_contrato">Término de Contrato</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Toggles Compactos */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'avisoPrevio', label: 'Aviso Prévio' },
                      { key: 'feriasProporcionais', label: 'Férias Prop.' },
                      { key: 'decimoTerceiro', label: '13º Prop.' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          handleInputChange(
                            item.key as keyof typeof formData,
                            !formData[item.key as keyof typeof formData]
                          )
                        }
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-[10px] font-medium transition-all h-8',
                          formData[item.key as keyof typeof formData]
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded-full border flex items-center justify-center transition-colors',
                            formData[item.key as keyof typeof formData]
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/30 bg-background'
                          )}
                        >
                          {formData[item.key as keyof typeof formData] && <Check className="h-2 w-2" />}
                        </div>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coluna Direita: Financeiro */}
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Valores
                  </h3>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Salário Base *</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                        <input
                          type="number"
                          value={formData.salarioBase}
                          onChange={(e) => handleInputChange('salarioBase', e.target.value)}
                          className="w-full pl-7 pr-2 py-1.5 bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-none transition-all text-xs font-medium h-8"
                          placeholder="0,00"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">Outras Verbas</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                          <input
                            type="number"
                            value={formData.outrasVerbas}
                            onChange={(e) => handleInputChange('outrasVerbas', e.target.value)}
                            className="w-full pl-7 pr-2 py-1.5 bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-none transition-all text-xs h-8"
                            placeholder="0,00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">Férias Venc. (dias)</label>
                        <input
                          type="number"
                          value={formData.feriasVencidas}
                          onChange={(e) => handleInputChange('feriasVencidas', e.target.value)}
                          className="w-full px-2 py-1.5 bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-none transition-all text-xs h-8"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grupo 2: Adicionais (Compacto) */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Percent className="h-3.5 w-3.5" />
                  Adicionais
                </h3>

                <div className="bg-muted/20 rounded-lg border border-border/60 p-3">
                  <div className="flex flex-col md:flex-row gap-4 items-stretch">
                    {/* Adicional de Risco */}
                    <div className="flex-1 min-w-[180px] flex flex-col justify-between p-2.5 rounded-lg border border-border bg-background">
                      <div className="space-y-2 h-full flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Adicional de Risco
                          </span>
                        </div>

                        <div className="relative">
                          <select
                            value={
                              formData.adicionalPericulosidade
                                ? 'periculosidade'
                                : formData.adicionalInsalubridadeGrau !== '0'
                                  ? 'insalubridade'
                                  : 'nenhum'
                            }
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === 'nenhum') {
                                setFormData((prev) => ({
                                  ...prev,
                                  adicionalPericulosidade: false,
                                  adicionalInsalubridadeGrau: '0',
                                }))
                              } else if (val === 'periculosidade') {
                                setFormData((prev) => ({
                                  ...prev,
                                  adicionalPericulosidade: true,
                                  adicionalInsalubridadeGrau: '0',
                                }))
                              } else if (val === 'insalubridade') {
                                setFormData((prev) => ({
                                  ...prev,
                                  adicionalPericulosidade: false,
                                  adicionalInsalubridadeGrau: '20',
                                }))
                              }
                            }}
                            className="w-full px-2 py-1.5 bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-none transition-all text-xs h-9 appearance-none font-medium"
                          >
                            <option value="nenhum">Nenhum</option>
                            <option value="periculosidade">Periculosidade (30%)</option>
                            <option value="insalubridade">Insalubridade</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        </div>

                        <div className="flex-1 flex flex-col justify-end mt-1.5">
                          {formData.adicionalPericulosidade && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-1.5 pt-2 border-t border-dashed border-border/50">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Base de Cálculo</span>
                                <div className="relative w-full">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">R$</span>
                                  <input
                                    type="number"
                                    value={formData.basePericulosidade}
                                    onChange={(e) => handleInputChange('basePericulosidade', e.target.value)}
                                    placeholder="1.621,00"
                                    className="w-full pl-6 pr-2 py-1 text-xs bg-muted/30 border border-input/50 rounded focus:ring-1 focus:ring-amber-500 outline-none h-8 font-medium text-right"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {formData.adicionalInsalubridadeGrau !== '0' && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-1.5 pt-2 border-t border-dashed border-border/50">
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[10px] text-muted-foreground">Grau</span>
                                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                                  Base: R$ {parseFloat(formData.baseInsalubridade).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                {['10', '20', '40'].map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => handleInputChange('adicionalInsalubridadeGrau', val)}
                                    className={cn(
                                      'flex-1 text-[10px] font-bold py-1.5 rounded border transition-all h-8 flex items-center justify-center',
                                      formData.adicionalInsalubridadeGrau === val
                                        ? 'bg-blue-500 border-blue-600 text-white shadow-sm'
                                        : 'bg-background border-input text-muted-foreground hover:bg-muted'
                                    )}
                                  >
                                    {val}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {!formData.adicionalPericulosidade && formData.adicionalInsalubridadeGrau === '0' && (
                            <div className="text-[10px] text-muted-foreground/40 italic text-center py-2 h-8 flex items-center justify-center">
                              Sem adicional selecionado
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:block w-px bg-border/60 my-2"></div>

                    {/* Noturno */}
                    <div className="flex-1 min-w-[180px] flex flex-col justify-between p-2.5 rounded-lg border border-border bg-background">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Moon className="h-3.5 w-3.5 text-indigo-500" /> Adicional Noturno
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 h-full justify-end">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Percentual Legal</span>
                          <span className="text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50">
                            {formData.adicionalNoturnoPercent}%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-medium text-muted-foreground">Percentual (%)</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={formData.adicionalNoturnoPercent}
                                onChange={(e) => handleInputChange('adicionalNoturnoPercent', e.target.value)}
                                className="w-full pl-2 pr-5 py-1 text-xs bg-muted/20 border border-input rounded focus:ring-1 focus:ring-indigo-500 outline-none h-8 font-medium transition-all"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold pointer-events-none">
                                %
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-medium text-muted-foreground">Média de Horas</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={formData.mediaHorasNoturnas}
                                onChange={(e) => handleInputChange('mediaHorasNoturnas', e.target.value)}
                                placeholder="0"
                                className="w-full pl-2 pr-7 py-1 text-xs bg-muted/20 border border-input rounded focus:ring-1 focus:ring-indigo-500 outline-none h-8 transition-all font-medium"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold pointer-events-none">
                                Hrs
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-border bg-muted/10 shrink-0">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={isCalculating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full disabled:opacity-60 disabled:cursor-not-allowed h-10"
            >
              {isCalculating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
              <span>Calcular Rescisão</span>
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
