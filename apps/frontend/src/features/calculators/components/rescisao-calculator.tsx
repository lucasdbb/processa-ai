
import { useState, useCallback } from 'react'
import { Calculator, Loader2, FileText, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCreditsStore } from '@/stores/credits-store'
import type { RescisaoDetalhes, CalculatorResult } from '../types'

interface RescisaoCalculatorProps {
  selectedClientId: string | null
}

export function RescisaoCalculator({ selectedClientId }: RescisaoCalculatorProps) {
  const { user } = useUser()
  const { credits, fetchCredits } = useCreditsStore()
  
  const [resultado, setResultado] = useState<CalculatorResult<RescisaoDetalhes> | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  
  const [formData, setFormData] = useState({
    // Rescisão - Composição Salarial
    salarioBase: '',
    adicionalPericulosidade: false,
    adicionalInsalubridadeGrau: '0', // 0, 10, 20, 40
    baseInsalubridade: '1621.00',
    adicionalNoturnoPercent: '20',
    mediaHorasNoturnas: '',
    outrasVerbas: '',

    // Rescisão - Dados do Contrato
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

    // Check credits
    await fetchCredits()
    if (credits && credits.total_available < 1) {
       toast.error('Créditos insuficientes. Recarregue para continuar.')
       return
    }

    setIsCalculating(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/calculators/trabalhista/rescisao-trabalhista`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          ...(selectedClientId && { client_id: selectedClientId }),
          
          // Novos campos de composição
          salario_base: parseFloat(formData.salarioBase) || 0,
          adicional_periculosidade: formData.adicionalPericulosidade,
          adicional_insalubridade_grau: parseInt(formData.adicionalInsalubridadeGrau) || 0,
          base_insalubridade: parseFloat(formData.baseInsalubridade) || 1621.00,
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
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error((error as { detail?: string } | null)?.detail || 'Erro ao calcular rescisão')
      }

      const data = await res.json() as {
        detalhes: {
          remuneracao_bruta: number
          saldo_salario: number
          aviso_previo: number
          ferias_vencidas: number
          ferias_proporcionais: number
          decimo_terceiro: number
          fgts: number
          multa_fgts: number
          total: number
        }
      }

      setResultado({
        tipo: 'rescisao',
        detalhes: {
          remuneracaoBruta: data.detalhes.remuneracao_bruta,
          saldoSalario: data.detalhes.saldo_salario,
          avisoPrevio: data.detalhes.aviso_previo,
          feriasVencidas: data.detalhes.ferias_vencidas,
          feriasProporcionais: data.detalhes.ferias_proporcionais,
          decimoTerceiro: data.detalhes.decimo_terceiro,
          fgts: data.detalhes.fgts,
          multaFgts: data.detalhes.multa_fgts,
          total: data.detalhes.total,
        },
      })
      
      // Update credits
      fetchCredits()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular rescisão')
    } finally {
      setIsCalculating(false)
    }
  }, [formData, selectedClientId, user, credits, fetchCredits])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0">
      <div className="lg:col-span-3 flex flex-col min-h-0">
        <div className="bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-4">
              {/* Seção 1: Composição Salarial */}
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 border-b border-border pb-1 text-primary">
                  Composição Salarial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">Salário Base (R$) *</label>
                    <input
                      type="number"
                      value={formData.salarioBase}
                      onChange={(e) => handleInputChange('salarioBase', e.target.value)}
                      className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground text-sm"
                      placeholder="Ex: 3000,00"
                      required
                    />
                  </div>

                  {/* Adicionais */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div className={cn(
                       "p-3 rounded-lg border transition-all cursor-pointer",
                       formData.adicionalPericulosidade 
                         ? "bg-primary/5 border-primary ring-1 ring-primary" 
                         : "bg-muted/30 border-border hover:border-primary/50"
                     )}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.adicionalPericulosidade}
                            onChange={(e) => handleInputChange('adicionalPericulosidade', e.target.checked)}
                            className="rounded border-input text-primary focus:ring-primary w-4 h-4 transition-all"
                          />
                          <span className="text-sm font-medium text-foreground">
                            Periculosidade (30%)
                          </span>
                        </label>
                     </div>

                     <div className={cn(
                       "p-3 rounded-lg border transition-all",
                       formData.adicionalInsalubridadeGrau !== '0'
                         ? "bg-primary/5 border-primary ring-1 ring-primary" 
                         : "bg-muted/30 border-border hover:border-primary/50"
                     )}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-foreground">Insalubridade</label>
                        </div>
                        <select
                          value={formData.adicionalInsalubridadeGrau}
                          onChange={(e) => handleInputChange('adicionalInsalubridadeGrau', e.target.value)}
                          className="w-full px-2 py-1 bg-background border border-input rounded-md text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        >
                          <option value="0">Não se aplica</option>
                          <option value="10">Mínimo (10%)</option>
                          <option value="20">Médio (20%)</option>
                          <option value="40">Máximo (40%)</option>
                        </select>
                     </div>
                  </div>

                  {/* Adicional Noturno */}
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 md:col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-foreground">Adicional Noturno</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Percentual (%)</label>
                          <input
                            type="number"
                            value={formData.adicionalNoturnoPercent}
                            onChange={(e) => handleInputChange('adicionalNoturnoPercent', e.target.value)}
                            className="w-full px-2 py-1 bg-background border border-input rounded-md text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Média Horas/Mês</label>
                          <input
                            type="number"
                            value={formData.mediaHorasNoturnas}
                            onChange={(e) => handleInputChange('mediaHorasNoturnas', e.target.value)}
                            className="w-full px-2 py-1 bg-background border border-input rounded-md text-xs"
                            placeholder="0"
                          />
                        </div>
                      </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">Outras Verbas (R$)</label>
                    <input
                      type="number"
                      value={formData.outrasVerbas}
                      onChange={(e) => handleInputChange('outrasVerbas', e.target.value)}
                      className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground text-sm"
                      placeholder="Ex: 500,00"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Dados do Contrato */}
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 border-b border-border pb-1 text-primary">
                  Dados do Contrato
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Admissão *</label>
                    <input
                      type="date"
                      value={formData.dataAdmissao}
                      onChange={(e) => handleInputChange('dataAdmissao', e.target.value)}
                      className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Rescisão *</label>
                    <input
                      type="date"
                      value={formData.dataRescisao}
                      onChange={(e) => handleInputChange('dataRescisao', e.target.value)}
                      className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground text-sm"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">Motivo *</label>
                    <div className="relative">
                      <select
                        value={formData.tipoRescisao}
                        onChange={(e) => handleInputChange('tipoRescisao', e.target.value)}
                        className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none text-foreground text-sm"
                      >
                        <option value="sem_justa_causa">Dispensa sem Justa Causa</option>
                        <option value="por_pedido">Pedido de Demissão</option>
                        <option value="com_justa_causa">Dispensa com Justa Causa</option>
                        <option value="acordo">Acordo (Reforma Trabalhista)</option>
                        <option value="termino_contrato">Término de Contrato</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground">
                        <ChevronDown className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Férias Vencidas (dias)</label>
                    <input
                      type="number"
                      value={formData.feriasVencidas}
                      onChange={(e) => handleInputChange('feriasVencidas', e.target.value)}
                      className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 mt-3 border-t border-border">
                  <label className="flex items-center cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.avisoPrevio}
                      onChange={(e) => handleInputChange('avisoPrevio', e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5 transition-all"
                    />
                    <span className="ml-2 text-xs text-foreground font-medium">
                      Aviso Prévio
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.feriasProporcionais}
                      onChange={(e) => handleInputChange('feriasProporcionais', e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5 transition-all"
                    />
                    <span className="ml-2 text-xs text-foreground font-medium">
                      Férias Prop.
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.decimoTerceiro}
                      onChange={(e) => handleInputChange('decimoTerceiro', e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5 transition-all"
                    />
                    <span className="ml-2 text-xs text-foreground font-medium">
                      13º Prop.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border bg-muted/10 shrink-0">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={isCalculating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              <span>{isCalculating ? 'Calculando...' : 'Calcular'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col min-h-0">
        {resultado ? (
          <div className="bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="space-y-4">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Resultado da Rescisão
                </h2>
                
                <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                   <div className="flex justify-between items-center text-sm pb-2 border-b border-border/50">
                      <span className="text-muted-foreground">Remuneração Base</span>
                      <span className="font-semibold text-foreground">R$ {resultado.detalhes.remuneracaoBruta.toFixed(2)}</span>
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Saldo de Salário</span>
                        <span className="font-medium text-foreground">R$ {resultado.detalhes.saldoSalario.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Aviso Prévio</span>
                        <span className="font-medium text-foreground">R$ {resultado.detalhes.avisoPrevio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Férias Vencidas</span>
                        <span className="font-medium text-foreground">R$ {resultado.detalhes.feriasVencidas.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Férias Proporcionais</span>
                        <span className="font-medium text-foreground">R$ {resultado.detalhes.feriasProporcionais.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>13º Proporcional</span>
                        <span className="font-medium text-foreground">R$ {resultado.detalhes.decimoTerceiro.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>FGTS</span>
                        <span className="font-medium text-foreground">R$ {resultado.detalhes.fgts.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Multa FGTS</span>
                        <span className="font-medium text-foreground">R$ {resultado.detalhes.multaFgts.toFixed(2)}</span>
                      </div>
                   </div>
                   
                   <div className="pt-3 border-t border-border flex justify-between items-center text-foreground font-bold text-base">
                     <span>Total Líquido Estimado</span>
                     <span className="text-primary">R$ {resultado.detalhes.total.toFixed(2)}</span>
                   </div>
                </div>
                <div className="text-xs text-muted-foreground text-center px-4">
                  * Este cálculo é uma estimativa e não substitui o cálculo oficial do contador ou homologação sindical.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Preencha os dados ao lado e clique em Calcular</p>
            <p className="text-xs mt-1 opacity-60">Os resultados aparecerão aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}
