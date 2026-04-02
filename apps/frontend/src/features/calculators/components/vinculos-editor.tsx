import { useState } from 'react'
import { Plus, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { VinculoInput } from '../types'

interface VinculosEditorProps {
  vinculos: VinculoInput[]
  onChange: (vinculos: VinculoInput[]) => void
  alertas?: string[]
  disabled?: boolean
}

const TIPOS_VINCULO = [
  'Empregado',
  'Contribuinte Individual',
  'Facultativo',
  'Empregado Doméstico',
  'Segurado Especial',
  'Avulso',
  'Servidor Público',
  'Militar',
]

function emptyVinculo(): VinculoInput {
  return {
    empresa: '',
    cnpj: '',
    data_inicio: '',
    data_fim: null,
    tipo_vinculo: 'Empregado',
    atividade_especial: false,
    categoria_especial: null,
    indicadores: [],
  }
}

function VinculoRow({
  vinculo,
  index,
  onUpdate,
  onRemove,
  disabled,
}: {
  vinculo: VinculoInput
  index: number
  onUpdate: (index: number, field: keyof VinculoInput, value: unknown) => void
  onRemove: (index: number) => void
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row — always visible */}
      <div className="flex items-center gap-2 p-3 bg-muted/20">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <span className="text-xs font-bold text-muted-foreground w-6">#{index + 1}</span>

        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={vinculo.empresa || ''}
            onChange={(e) => onUpdate(index, 'empresa', e.target.value)}
            placeholder="Empresa"
            disabled={disabled}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
          />
          <input
            type="date"
            value={vinculo.data_inicio}
            onChange={(e) => onUpdate(index, 'data_inicio', e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
          />
          <input
            type="date"
            value={vinculo.data_fim || ''}
            onChange={(e) => onUpdate(index, 'data_fim', e.target.value || null)}
            disabled={disabled}
            placeholder="Em aberto"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={disabled}
          className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="p-3 border-t border-border space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ</label>
              <input
                type="text"
                value={vinculo.cnpj || ''}
                onChange={(e) => onUpdate(index, 'cnpj', e.target.value)}
                placeholder="00.000.000/0000-00"
                disabled={disabled}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de Vínculo</label>
              <select
                value={vinculo.tipo_vinculo}
                onChange={(e) => onUpdate(index, 'tipo_vinculo', e.target.value)}
                disabled={disabled}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
              >
                {TIPOS_VINCULO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vinculo.atividade_especial}
                onChange={(e) => {
                  onUpdate(index, 'atividade_especial', e.target.checked)
                  if (!e.target.checked) onUpdate(index, 'categoria_especial', null)
                }}
                disabled={disabled}
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">Atividade Especial</span>
            </label>

            {vinculo.atividade_especial && (
              <select
                value={vinculo.categoria_especial ?? ''}
                onChange={(e) => onUpdate(index, 'categoria_especial', e.target.value ? Number(e.target.value) : null)}
                disabled={disabled}
                className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
              >
                <option value="">Selecione</option>
                <option value="15">15 anos</option>
                <option value="20">20 anos</option>
                <option value="25">25 anos</option>
              </select>
            )}
          </div>

          {!vinculo.data_fim && (
            <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Vínculo em aberto — será considerado até a data de referência do cálculo.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function VinculosEditor({ vinculos, onChange, alertas, disabled }: VinculosEditorProps) {
  const handleUpdate = (index: number, field: keyof VinculoInput, value: unknown) => {
    const updated = [...vinculos]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const handleRemove = (index: number) => {
    onChange(vinculos.filter((_, i) => i !== index))
  }

  const handleAdd = () => {
    onChange([...vinculos, emptyVinculo()])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          Vínculos ({vinculos.length})
        </h3>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {alertas && alertas.length > 0 && (
        <div className="space-y-1">
          {alertas.map((alerta, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">{alerta}</p>
            </div>
          ))}
        </div>
      )}

      {vinculos.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">Nenhum vínculo adicionado</p>
          <p className="text-xs mt-1">Clique em "Adicionar" ou importe um CNIS</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vinculos.map((vinculo, i) => (
            <VinculoRow
              key={i}
              vinculo={vinculo}
              index={i}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}
