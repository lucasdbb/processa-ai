import { FileText, Download, CheckCircle, Clock, AlertTriangle, Trophy, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  AposentadoriaResult,
  CenarioAposentadoria,
  ProjecaoFutura,
  TempoContribuicaoResult,
  MediaSalarialResult,
} from '../types'

interface CenariosResultadoProps {
  resultado: AposentadoriaResult
  pdfUrl?: string | null
  onDownloadPdf?: () => void
}

const REGRA_LABELS: Record<string, string> = {
  permanente: 'Regra Permanente',
  pontos: 'Regra de Pontos',
  idade_progressiva: 'Idade Mín. Progressiva',
  pedagio_50: 'Pedágio 50%',
  pedagio_100: 'Pedágio 100%',
  direito_adquirido: 'Direito Adquirido',
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

function TempoResumo({ tempo }: { tempo: TempoContribuicaoResult }) {
  const parts = []
  if (tempo.anos > 0) parts.push(`${tempo.anos} ano${tempo.anos !== 1 ? 's' : ''}`)
  if (tempo.meses > 0) parts.push(`${tempo.meses} ${tempo.meses !== 1 ? 'meses' : 'mês'}`)
  if (tempo.dias > 0) parts.push(`${tempo.dias} dia${tempo.dias !== 1 ? 's' : ''}`)

  return (
    <div className="p-3 rounded-lg border border-border bg-muted/20">
      <p className="text-xs font-medium text-muted-foreground mb-1">Tempo de Contribuição</p>
      <p className="text-lg font-bold text-foreground">{parts.join(', ') || '0 dias'}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {tempo.vinculos_processados} vínculo{tempo.vinculos_processados !== 1 ? 's' : ''} processado{tempo.vinculos_processados !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

function MediaResumo({ media }: { media: MediaSalarialResult }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-muted/20">
      <p className="text-xs font-medium text-muted-foreground mb-1">Salário de Benefício</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Média 100%</p>
          <p className="text-sm font-bold text-foreground">{formatCurrency(media.media_100)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Média 80%</p>
          <p className="text-sm font-bold text-foreground">{formatCurrency(media.media_80)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {media.qtd_contribuicoes} contribuiç{media.qtd_contribuicoes !== 1 ? 'ões' : 'ão'}
      </p>
    </div>
  )
}

function CenarioCard({
  cenario,
  isMelhor,
}: {
  cenario: CenarioAposentadoria
  isMelhor: boolean
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        cenario.elegivel
          ? isMelhor
            ? 'border-green-500/40 bg-green-500/5 ring-1 ring-green-500/20'
            : 'border-green-500/20 bg-green-500/5'
          : 'border-border bg-muted/10'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {cenario.elegivel ? (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <h4 className="text-sm font-bold text-foreground">
            {REGRA_LABELS[cenario.regra] || cenario.regra_nome}
          </h4>
        </div>
        {isMelhor && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-300 text-[10px] font-bold shrink-0">
            <Trophy className="h-3 w-3" />
            Recomendado
          </span>
        )}
      </div>

      {cenario.elegivel ? (
        <div className="space-y-2">
          {cenario.beneficio_estimado != null && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Benefício estimado</span>
              <span className="font-bold text-green-700 dark:text-green-300">
                {formatCurrency(cenario.beneficio_estimado)}
              </span>
            </div>
          )}
          {cenario.coeficiente != null && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Coeficiente</span>
              <span className="font-medium text-foreground">
                {(cenario.coeficiente * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {cenario.fator_previdenciario != null && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fator previdenciário</span>
              <span className="font-medium text-foreground">
                {cenario.fator_previdenciario.toFixed(4)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {cenario.data_elegibilidade && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Elegível em</span>
              <span className="font-medium text-foreground">
                {formatDate(cenario.data_elegibilidade)}
              </span>
            </div>
          )}
          {cenario.beneficio_estimado != null && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Benefício projetado</span>
              <span className="font-medium text-foreground">
                {formatCurrency(cenario.beneficio_estimado)}
              </span>
            </div>
          )}
          {cenario.requisitos_faltantes.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Requisitos faltantes
              </p>
              {cenario.requisitos_faltantes.map((req, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-300 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  {req}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProjecaoRecomendacao({ projecao }: { projecao: ProjecaoFutura }) {
  const proximo = projecao.cenario_mais_proximo
  const vantajoso = projecao.cenario_mais_vantajoso

  return (
    <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        Projeção e Recomendação
      </h3>

      <p className="text-sm text-foreground leading-relaxed">
        {projecao.recomendacao}
      </p>

      {(proximo || vantajoso) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {proximo && (
            <div className="p-3 rounded-lg border border-border bg-background">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Mais próximo
              </p>
              <p className="text-sm font-bold text-foreground mt-1">
                {proximo.regra_nome}
              </p>
              <p className="text-xs text-muted-foreground">
                {proximo.meses_restantes} {proximo.meses_restantes === 1 ? 'mês' : 'meses'} &bull; {formatDate(proximo.data_elegibilidade)}
              </p>
              {proximo.beneficio_projetado != null && (
                <p className="text-lg font-bold text-primary mt-1">
                  {formatCurrency(proximo.beneficio_projetado)}
                </p>
              )}
              {proximo.coeficiente_projetado != null && (
                <p className="text-[10px] text-muted-foreground">
                  Coeficiente projetado: {(proximo.coeficiente_projetado * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
          {vantajoso && (
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wide">
                Mais vantajoso
              </p>
              <p className="text-sm font-bold text-foreground mt-1">
                {vantajoso.regra_nome}
              </p>
              <p className="text-xs text-muted-foreground">
                {vantajoso.meses_restantes} {vantajoso.meses_restantes === 1 ? 'mês' : 'meses'} &bull; {formatDate(vantajoso.data_elegibilidade)}
              </p>
              {vantajoso.beneficio_projetado != null && (
                <p className="text-lg font-bold text-primary mt-1">
                  {formatCurrency(vantajoso.beneficio_projetado)}
                </p>
              )}
              {vantajoso.coeficiente_projetado != null && (
                <p className="text-[10px] text-muted-foreground">
                  Coeficiente projetado: {(vantajoso.coeficiente_projetado * 100).toFixed(0)}%
                </p>
              )}
              {projecao.ganho_mensal_esperar != null && projecao.ganho_mensal_esperar > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                  +{formatCurrency(projecao.ganho_mensal_esperar)}/mês se esperar
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CenariosResultado({ resultado, pdfUrl, onDownloadPdf }: CenariosResultadoProps) {
  const elegiveis = resultado.cenarios.filter((c) => c.elegivel)
  const naoElegiveis = resultado.cenarios.filter((c) => !c.elegivel)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Resultado da Simulação
        </h2>
        {pdfUrl && onDownloadPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar Relatório
          </button>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TempoResumo tempo={resultado.tempo_contribuicao} />
        {resultado.media_salarial && <MediaResumo media={resultado.media_salarial} />}
      </div>

      {/* Projeção e Recomendação */}
      {resultado.projecao && <ProjecaoRecomendacao projecao={resultado.projecao} />}

      {/* Alertas globais */}
      {resultado.alertas.length > 0 && (
        <div className="space-y-1">
          {resultado.alertas.map((alerta, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">{alerta}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cenários elegíveis */}
      {elegiveis.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">
            Elegível agora ({elegiveis.length})
          </p>
          <div className="grid grid-cols-1 gap-2">
            {elegiveis.map((c) => (
              <CenarioCard
                key={c.regra}
                cenario={c}
                isMelhor={resultado.melhor_cenario === c.regra}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cenários futuros */}
      {naoElegiveis.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            {elegiveis.length > 0 ? 'Outros cenários' : 'Cenários'} ({naoElegiveis.length})
          </p>
          <div className="grid grid-cols-1 gap-2">
            {naoElegiveis.map((c) => (
              <CenarioCard
                key={c.regra}
                cenario={c}
                isMelhor={resultado.melhor_cenario === c.regra}
              />
            ))}
          </div>
        </div>
      )}

      {resultado.cenarios.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhum cenário avaliado</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Aviso:</strong> Esta simulação é informativa e não substitui orientação jurídica.
          Os valores são estimativos e podem variar conforme dados reais do INSS.
        </p>
      </div>
    </div>
  )
}
