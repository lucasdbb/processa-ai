
import { useState, useCallback } from 'react'
import { Calculator, Loader2, FileText, Calendar, DollarSign, Percent, AlertTriangle, Moon, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCreditsStore } from '@/stores/credits-store'
import type { RescisaoDetalhes, CalculatorResult } from '../types'
import { analytics } from '@/lib/analytics'

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
    basePericulosidade: '1621.00',
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

    analytics.track('feature_used', {
      feature: 'rescisao_calculator',
      action: 'started',
      tipo: formData.tipoRescisao
    })

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
          base_periculosidade: parseFloat(formData.basePericulosidade) || 1621.00,
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
      
      analytics.track('feature_used', {
        feature: 'rescisao_calculator',
        action: 'completed',
        success: true
      })
    } catch (err) {
      analytics.track('feature_used', {
        feature: 'rescisao_calculator',
        action: 'failed',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular rescisão')
    } finally {
      setIsCalculating(false)
    }
  }, [formData, selectedClientId, user, credits, fetchCredits])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1">
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
                       { key: 'decimoTerceiro', label: '13º Prop.' }
                     ].map((item) => (
                       <button
                         key={item.key}
                         type="button"
                         onClick={() => handleInputChange(item.key as keyof typeof formData, !formData[item.key as keyof typeof formData])}
                         className={cn(
                           "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-[10px] font-medium transition-all h-8",
                           formData[item.key as keyof typeof formData]
                             ? "bg-primary/10 border-primary text-primary"
                             : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                         )}
                       >
                         <div className={cn(
                           "w-3 h-3 rounded-full border flex items-center justify-center transition-colors",
                           formData[item.key as keyof typeof formData]
                             ? "bg-primary border-primary text-primary-foreground"
                             : "border-muted-foreground/30 bg-background"
                         )}>
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
                      
                      {/* Adicional de Risco (Select/Dropdown) */}
                      <div className="flex-1 min-w-[180px] flex flex-col justify-between p-2.5 rounded-lg border border-border bg-background">
                         <div className="space-y-2 h-full flex flex-col">
                            <div className="flex items-center justify-between">
                               <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                 <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Adicional de Risco
                               </span>
                            </div>

                            <div className="relative">
                              <select
                                value={formData.adicionalPericulosidade ? 'periculosidade' : (formData.adicionalInsalubridadeGrau !== '0' ? 'insalubridade' : 'nenhum')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'nenhum') {
                                    setFormData(prev => ({ ...prev, adicionalPericulosidade: false, adicionalInsalubridadeGrau: '0' }));
                                  } else if (val === 'periculosidade') {
                                    setFormData(prev => ({ ...prev, adicionalPericulosidade: true, adicionalInsalubridadeGrau: '0' }));
                                  } else if (val === 'insalubridade') {
                                    setFormData(prev => ({ ...prev, adicionalPericulosidade: false, adicionalInsalubridadeGrau: '20' }));
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

                            {/* Detalhes Contextuais */}
                            <div className="flex-1 flex flex-col justify-end mt-1.5">
                              {/* Periculosidade */}
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

                              {/* Insalubridade */}
                              {formData.adicionalInsalubridadeGrau !== '0' && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-1.5 pt-2 border-t border-dashed border-border/50">
                                   <div className="flex justify-between items-center mb-0.5">
                                      <span className="text-[10px] text-muted-foreground">Grau</span>
                                      <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">Base: R$ {parseFloat(formData.baseInsalubridade).toLocaleString('pt-BR')}</span>
                                   </div>
                                   <div className="flex gap-1">
                                     {['10', '20', '40'].map((val) => (
                                       <button
                                         key={val}
                                         type="button"
                                         onClick={() => handleInputChange('adicionalInsalubridadeGrau', val)}
                                         className={cn(
                                           "flex-1 text-[10px] font-bold py-1.5 rounded border transition-all h-8 flex items-center justify-center",
                                           formData.adicionalInsalubridadeGrau === val
                                             ? "bg-blue-500 border-blue-600 text-white shadow-sm"
                                             : "bg-background border-input text-muted-foreground hover:bg-muted"
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
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold pointer-events-none">%</span>
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
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold pointer-events-none">Hrs</span>
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
              {isCalculating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              <span>{isCalculating ? 'Calcular Rescisão' : 'Calcular Rescisão'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col">
        {resultado ? (
          <div className="bg-card border border-border rounded-xl flex flex-col h-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex-1 p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Resultado Estimado
                  </h2>
                  <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                    Trabalhista
                  </div>
                </div>
                
                <div className="p-5 bg-muted/30 rounded-xl border border-border/50 space-y-4 shadow-inner">
                   <div className="flex justify-between items-end pb-3 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Remuneração Base</span>
                      <span className="font-bold text-lg text-foreground">R$ {resultado.detalhes.remuneracaoBruta.toFixed(2)}</span>
                   </div>

                   <div className="space-y-2.5">
                      {[
                        { label: 'Saldo de Salário', value: resultado.detalhes.saldoSalario },
                        { label: 'Aviso Prévio', value: resultado.detalhes.avisoPrevio },
                        { label: 'Férias Vencidas', value: resultado.detalhes.feriasVencidas },
                        { label: 'Férias Proporcionais', value: resultado.detalhes.feriasProporcionais },
                        { label: '13º Proporcional', value: resultado.detalhes.decimoTerceiro },
                        { label: 'FGTS (8%)', value: resultado.detalhes.fgts },
                        { label: 'Multa FGTS (40%)', value: resultado.detalhes.multaFgts },
                      ].map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className={cn("font-medium", item.value > 0 ? "text-foreground" : "text-muted-foreground/50")}>
                            R$ {item.value.toFixed(2)}
                          </span>
                        </div>
                      ))}
                   </div>
                   
                   <div className="pt-4 border-t-2 border-dashed border-border/50 flex justify-between items-center">
                     <span className="font-bold text-foreground text-sm uppercase tracking-wide">Total Líquido</span>
                     <span className="text-xl font-extrabold text-primary">R$ {resultado.detalhes.total.toFixed(2)}</span>
                   </div>
                </div>
                
                <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs border border-blue-100 dark:border-blue-900/30">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>
                    Este cálculo é uma estimativa preliminar baseada nos dados informados. 
                    Recomendamos validação oficial para fins processuais.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground h-full flex flex-col items-center justify-center border-dashed">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
               <Calculator className="h-8 w-8 opacity-40" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Resultado do Cálculo</h3>
            <p className="text-sm opacity-80 max-w-[200px]">Preencha os dados do contrato e clique em calcular para ver o detalhamento.</p>
          </div>
        )}
      </div>
    </div>
  )
}
