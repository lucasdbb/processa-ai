import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Calculator,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Edit3,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useCreditsStore } from '@/stores/credits-store'
import { useOnboardingStore } from '@/features/onboarding'
import { analytics } from '@/lib/analytics'
import type {
  VinculoInput,
  RemuneracaoInput,
  DadosSeguradoInput,
  AposentadoriaResult,
  CnisParseResult,
} from '../types'
import { CnisUpload } from './cnis-upload'
import { VinculosEditor } from './vinculos-editor'
import { RemuneracoesEditor } from './remuneracoes-editor'
import { CenariosResultado } from './cenarios-resultado'

interface AposentadoriaCalculatorProps {
  selectedClientId: string | null
}

type Step = 1 | 2 | 3

const STEP_LABELS = ['Dados Iniciais', 'Revisão', 'Resultado']

function StepIndicator({ currentStep }: { currentStep: Step }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as Step
        const isActive = step === currentStep
        const isCompleted = step < currentStep

        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  'h-px w-6 sm:w-10',
                  isCompleted ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : step}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:inline',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function emptySegurado(): DadosSeguradoInput {
  return {
    nome: '',
    cpf: '',
    data_nascimento: '',
    sexo: 'M',
    professor: false,
  }
}

export function AposentadoriaCalculator({
  selectedClientId,
}: AposentadoriaCalculatorProps) {
  const { fetchCredits } = useCreditsStore()
  const { markCalculatorUsed } = useOnboardingStore()

  const [step, setStep] = useState<Step>(1)
  const [segurado, setSegurado] = useState<DadosSeguradoInput>(emptySegurado())
  const [vinculos, setVinculos] = useState<VinculoInput[]>([])
  const [remuneracoes, setRemuneracoes] = useState<RemuneracaoInput[]>([])
  const [comCnis, setComCnis] = useState(false)
  const [vinculoAlertas, setVinculoAlertas] = useState<string[]>([])
  const [exportPdf, setExportPdf] = useState(true)

  const [salarioFuturo, setSalarioFuturo] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<AposentadoriaResult | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Pré-preencher salário futuro com a média das últimas 12 remunerações
  useEffect(() => {
    if (remuneracoes.length > 0 && !salarioFuturo) {
      const sorted = [...remuneracoes].sort((a, b) =>
        b.competencia.localeCompare(a.competencia)
      )
      const last12 = sorted.slice(0, 12)
      const avg = last12.reduce((sum, r) => sum + r.valor, 0) / last12.length
      setSalarioFuturo(avg.toFixed(2))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remuneracoes])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleCnisParsed = useCallback((data: CnisParseResult) => {
    setComCnis(true)

    // Fill segurado from CNIS
    if (data.segurado) {
      setSegurado((prev) => ({
        ...prev,
        nome: data.segurado.nome || prev.nome,
        cpf: data.segurado.cpf || prev.cpf,
        data_nascimento: data.segurado.data_nascimento || prev.data_nascimento,
      }))
    }

    // Fill vínculos
    const mapped: VinculoInput[] = data.vinculos.map((v) => ({
      empresa: v.empresa || '',
      cnpj: v.cnpj || '',
      data_inicio: v.data_inicio || '',
      data_fim: v.data_fim || null,
      tipo_vinculo: v.tipo || 'Empregado',
      atividade_especial: false,
      categoria_especial: null,
      indicadores: v.indicadores || [],
    }))
    setVinculos(mapped)

    // Fill remunerações
    const allRem: RemuneracaoInput[] = []
    for (const v of data.vinculos) {
      for (const r of v.remuneracoes) {
        allRem.push({
          competencia: r.competencia,
          valor: r.valor,
          indicadores: r.indicadores || [],
        })
      }
    }
    allRem.sort((a, b) => b.competencia.localeCompare(a.competencia))
    setRemuneracoes(allRem)

    if (data.alertas?.length) setVinculoAlertas(data.alertas)

    toast.success(
      `CNIS importado: ${mapped.length} vínculo(s), ${allRem.length} remuneração(ões)`
    )
  }, [])

  const validateStep1 = (): boolean => {
    if (!segurado.data_nascimento) {
      toast.error('Informe a data de nascimento')
      return false
    }
    if (vinculos.length === 0) {
      toast.error('Adicione pelo menos um vínculo')
      return false
    }
    const invalid = vinculos.some((v) => !v.data_inicio)
    if (invalid) {
      toast.error('Preencha a data de início de todos os vínculos')
      return false
    }
    return true
  }

  const pollForPdf = useCallback(
    async (jobId: string) => {
      let attempts = 0
      const maxAttempts = 60

      const interval = setInterval(async () => {
        attempts++
        try {
          const statusRes = await fetchWithCredentials(
            `${API_URL}/ai/jobs/${encodeURIComponent(jobId)}`
          )
          if (!statusRes.ok) return

          const statusData = (await statusRes.json()) as {
            status: string
            result?: { document_id?: string; download_url?: string }
            error?: string
          }

          if (statusData.status === 'completed') {
            clearInterval(interval)
            const downloadUrl = statusData.result?.download_url
            const documentId = statusData.result?.document_id

            if (downloadUrl) {
              setPdfUrl(downloadUrl)
            } else if (documentId) {
              const dlRes = await fetchWithCredentials(
                `${API_URL}/documents/${documentId}/download`
              )
              if (dlRes.ok) {
                const dlData = (await dlRes.json()) as { download_url: string }
                setPdfUrl(dlData.download_url)
              }
            }
          } else if (statusData.status === 'failed') {
            clearInterval(interval)
          }
        } catch {
          // continue
        }

        if (attempts >= maxAttempts) clearInterval(interval)
      }, 2000)
    },
    []
  )

  const handleSubmit = useCallback(async () => {
    setLoading(true)
    setResultado(null)
    setPdfUrl(null)

    try {
      const res = await fetchWithCredentials(
        `${API_URL}/calculators/previdencia/aposentadoria-simulacao`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segurado,
            vinculos,
            remuneracoes,
            com_cnis: comCnis,
            client_id: selectedClientId || undefined,
            export_pdf: exportPdf,
            salario_contribuicao_futuro: salarioFuturo
              ? parseFloat(salarioFuturo)
              : undefined,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { detail?: string }).detail || 'Erro ao simular aposentadoria'
        )
      }

      const data = (await res.json()) as {
        calculation_id: string
        pdf?: { job_id: string; status: string } | null
      }

      markCalculatorUsed()
      fetchCredits()

      const calcId = data.calculation_id
      const pdfJobId = data.pdf?.job_id
      let attempts = 0
      const maxAttempts = 120

      if (pollRef.current) clearInterval(pollRef.current)

      pollRef.current = setInterval(async () => {
        attempts++
        try {
          // Poll calculation result
          const histRes = await fetchWithCredentials(
            `${API_URL}/calculators/history?calculator_key=previdencia.aposentadoria-simulacao&limit=1`
          )
          if (!histRes.ok) return

          const histData = (await histRes.json()) as {
            calculations: Array<{
              id: string
              status: string
              output_payload?: AposentadoriaResult
              error?: string
            }>
          }

          const calc = histData.calculations.find((c) => c.id === calcId)
          if (!calc) return

          if (calc.status === 'completed' && calc.output_payload) {
            setResultado(calc.output_payload)
            setStep(3)

            // If PDF was requested, poll for it separately
            if (pdfJobId) {
              pollForPdf(pdfJobId)
            }

            clearInterval(pollRef.current!)
            pollRef.current = null
            setLoading(false)

            analytics.track('feature_used', {
              feature: 'calculator_aposentadoria_simulacao',
              com_cnis: comCnis,
            })
          } else if (calc.status === 'failed') {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setLoading(false)
            toast.error(calc.error || 'Erro na simulação de aposentadoria')
          }
        } catch {
          // continue polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setLoading(false)
          toast.error('Tempo esgotado ao simular')
        }
      }, 2000)
    } catch (err) {
      setLoading(false)
      toast.error(
        err instanceof Error ? err.message : 'Erro ao simular aposentadoria'
      )
    }
  }, [
    segurado,
    vinculos,
    remuneracoes,
    comCnis,
    selectedClientId,
    exportPdf,
    salarioFuturo,
    fetchCredits,
    markCalculatorUsed,
    pollForPdf,
  ])

  const handleDownloadPdf = useCallback(() => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank')
    }
  }, [pdfUrl])

  // ---- RENDER ----

  return (
    <div className="space-y-0">
      <StepIndicator currentStep={step} />

      {/* Step 1: Dados Iniciais */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Segurado info */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Dados do Segurado</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Nome
                </label>
                <input
                  type="text"
                  value={segurado.nome || ''}
                  onChange={(e) =>
                    setSegurado((s) => ({ ...s, nome: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Nome do segurado"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  CPF
                </label>
                <input
                  type="text"
                  value={segurado.cpf || ''}
                  onChange={(e) =>
                    setSegurado((s) => ({ ...s, cpf: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  value={segurado.data_nascimento}
                  onChange={(e) =>
                    setSegurado((s) => ({
                      ...s,
                      data_nascimento: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Sexo *
                </label>
                <div className="flex gap-2">
                  {(['M', 'F'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setSegurado((prev) => ({ ...prev, sexo: s }))
                      }
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        segurado.sexo === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:border-primary/50'
                      }`}
                    >
                      {s === 'M' ? 'Masculino' : 'Feminino'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={segurado.professor}
                onChange={(e) =>
                  setSegurado((s) => ({ ...s, professor: e.target.checked }))
                }
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">
                Professor(a) — exercício exclusivo de magistério (Ed. Infantil,
                Fundamental ou Médio)
              </span>
            </label>
          </div>

          {/* CNIS or manual */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">
              Vínculos e Remunerações
            </h3>

            <CnisUpload
              onParsed={handleCnisParsed}
              onReset={() => {
                setComCnis(false)
                setVinculos([])
                setRemuneracoes([])
                setVinculoAlertas([])
              }}
              disabled={loading}
            />

            <div className="relative flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>ou insira manualmente</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <VinculosEditor
              vinculos={vinculos}
              onChange={setVinculos}
              alertas={vinculoAlertas}
              disabled={loading}
            />
          </div>

          {/* Next */}
          <button
            type="button"
            onClick={() => {
              if (validateStep1()) setStep(2)
            }}
            disabled={loading}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Revisar Dados
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 2: Revisão */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Segurado summary */}
          <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Segurado</h3>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Edit3 className="h-3 w-3" />
                Editar
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {segurado.nome && (
                <div>
                  <span className="text-muted-foreground">Nome: </span>
                  <span className="font-medium text-foreground">
                    {segurado.nome}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Nascimento: </span>
                <span className="font-medium text-foreground">
                  {new Date(
                    segurado.data_nascimento + 'T00:00:00'
                  ).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Sexo: </span>
                <span className="font-medium text-foreground">
                  {segurado.sexo === 'M' ? 'Masculino' : 'Feminino'}
                </span>
              </div>
              {segurado.professor && (
                <div>
                  <span className="font-medium text-foreground">
                    Professor(a)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Vínculos review */}
          <VinculosEditor
            vinculos={vinculos}
            onChange={setVinculos}
            alertas={vinculoAlertas}
            disabled={loading}
          />

          {/* Remunerações review */}
          <RemuneracoesEditor
            remuneracoes={remuneracoes}
            onChange={setRemuneracoes}
            disabled={loading}
          />

          {/* Salário de contribuição futuro */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-foreground">
                Salário de contribuição futuro (R$)
              </label>
              <div className="relative group">
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded-lg bg-popover border border-border shadow-md text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Pré-preenchido com a média das últimas 12 remunerações.
                  Usado para projetar o benefício futuro em cada cenário.
                </div>
              </div>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={salarioFuturo}
              onChange={(e) => setSalarioFuturo(e.target.value)}
              placeholder="Ex: 4500.00"
              disabled={loading}
              className="w-full sm:w-60 px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
            />
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={exportPdf}
                onChange={(e) => setExportPdf(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">
                Gerar relatório PDF
              </span>
            </label>
          </div>

          {/* Cost info */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Custo:</strong> 20 créditos — Simulação completa de aposentadoria
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="flex-1 py-3 px-4 border border-border rounded-lg font-medium text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Simular Aposentadoria
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Resultado */}
      {step === 3 && resultado && (
        <div className="space-y-4">
          <CenariosResultado
            resultado={resultado}
            pdfUrl={pdfUrl}
            onDownloadPdf={handleDownloadPdf}
          />

          <button
            type="button"
            onClick={() => {
              setStep(1)
              setResultado(null)
              setPdfUrl(null)
              setSalarioFuturo('')
            }}
            className="w-full py-3 px-4 border border-border rounded-lg font-medium text-sm text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Nova Simulação
          </button>
        </div>
      )}
    </div>
  )
}
