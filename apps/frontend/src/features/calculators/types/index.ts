
export type RescisaoDetalhes = {
  remuneracaoBruta: number
  saldoSalario: number
  avisoPrevio: number
  feriasVencidas: number
  feriasProporcionais: number
  decimoTerceiro: number
  fgts: number
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
