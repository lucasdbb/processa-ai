
export type RescisaoDetalhes = {
  remuneracaoBruta: number
  saldoSalario: number
  avisoPrevio: number
  feriasVencidas: number
  feriasProporcionais: number
  decimoTerceiro: number
  fgts: number
  fgtsRescisorio: number
  multaFgts: number
  total: number
}

export type AposentadoriaDetalhes = {
  podeAposentar: boolean
  anosRestantes: number
  tempoRestante: number
  beneficio: number
  idadeMinima: number
  tempoMinimoContrib: number
}

export type CalculatorResult<T> = {
  tipo: string
  detalhes: T
}

// ---------------------------------------------------------------------------
// Calculadoras Previdenciárias
// ---------------------------------------------------------------------------

export type VinculoInput = {
  empresa?: string
  cnpj?: string
  data_inicio: string
  data_fim?: string | null
  tipo_vinculo: string
  atividade_especial: boolean
  categoria_especial?: number | null
  indicadores: string[]
}

export type RemuneracaoInput = {
  competencia: string
  valor: number
  indicadores: string[]
}

export type DadosSeguradoInput = {
  nome?: string
  cpf?: string
  data_nascimento: string
  sexo: 'M' | 'F'
  professor: boolean
}

// --- Tempo de Contribuição ---

export type TempoContribuicaoResult = {
  anos: number
  meses: number
  dias: number
  total_dias: number
  vinculos_processados: number
  alertas: string[]
}

// --- Média Salarial ---

export type MediaSalarialResult = {
  media_100: number
  media_80: number
  qtd_contribuicoes: number
  maior_contribuicao: number
  menor_contribuicao: number
}

// --- Fator Previdenciário ---

export type FatorPrevidenciarioResult = {
  fator: number
  formula_detalhada: string
}

// --- Simulação de Aposentadoria ---

export type CenarioAposentadoria = {
  regra: string
  regra_nome: string
  elegivel: boolean
  data_elegibilidade?: string | null
  beneficio_estimado?: number | null
  coeficiente?: number | null
  fator_previdenciario?: number | null
  requisitos_faltantes: string[]
}

export type CenarioProjetado = {
  regra: string
  regra_nome: string
  meses_restantes: number
  data_elegibilidade: string
  tempo_contribuicao_projetado: number
  coeficiente_projetado?: number | null
  beneficio_projetado?: number | null
}

export type ProjecaoFutura = {
  salario_contribuicao: number
  cenario_mais_proximo?: CenarioProjetado | null
  cenario_mais_vantajoso?: CenarioProjetado | null
  ganho_mensal_esperar?: number | null
  recomendacao: string
}

export type AposentadoriaResult = {
  tempo_contribuicao: TempoContribuicaoResult
  media_salarial?: MediaSalarialResult | null
  cenarios: CenarioAposentadoria[]
  melhor_cenario?: string | null
  alertas: string[]
  projecao?: ProjecaoFutura | null
}

// --- CNIS Parse ---

export type CnisSegurado = {
  nome?: string | null
  cpf?: string | null
  nit?: string | null
  data_nascimento?: string | null
  nome_mae?: string | null
}

export type CnisVinculo = {
  sequencia?: number | null
  empresa?: string | null
  cnpj?: string | null
  tipo?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  ultima_remuneracao?: number | null
  indicadores: string[]
  remuneracoes: RemuneracaoInput[]
}

export type CnisParseResult = {
  segurado: CnisSegurado
  vinculos: CnisVinculo[]
  alertas: string[]
}
