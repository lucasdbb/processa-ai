import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { RemuneracaoInput } from '../types'

interface RemuneracoesEditorProps {
  remuneracoes: RemuneracaoInput[]
  onChange: (remuneracoes: RemuneracaoInput[]) => void
  disabled?: boolean
}

function emptyRemuneracao(): RemuneracaoInput {
  return {
    competencia: '',
    valor: 0,
    indicadores: [],
  }
}

export function RemuneracoesEditor({ remuneracoes, onChange, disabled }: RemuneracoesEditorProps) {
  const [collapsed, setCollapsed] = useState(remuneracoes.length > 10)

  const handleUpdate = (index: number, field: keyof RemuneracaoInput, value: unknown) => {
    const updated = [...remuneracoes]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const handleRemove = (index: number) => {
    onChange(remuneracoes.filter((_, i) => i !== index))
  }

  const handleAdd = () => {
    onChange([...remuneracoes, emptyRemuneracao()])
    setCollapsed(false)
  }

  const handleAddBulk = () => {
    // Add 12 empty rows for a full year
    const newItems = Array.from({ length: 12 }, () => emptyRemuneracao())
    onChange([...remuneracoes, ...newItems])
    setCollapsed(false)
  }

  const displayItems = collapsed ? remuneracoes.slice(0, 5) : remuneracoes
  const hiddenCount = collapsed ? Math.max(0, remuneracoes.length - 5) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          Remunerações ({remuneracoes.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddBulk}
            disabled={disabled}
            className="px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            +12 meses
          </button>
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
      </div>

      {remuneracoes.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">Nenhuma remuneração adicionada</p>
          <p className="text-xs mt-1">Clique em "Adicionar" ou importe um CNIS</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_32px] gap-2 px-2">
            <span className="text-xs font-medium text-muted-foreground">Competência</span>
            <span className="text-xs font-medium text-muted-foreground">Valor (R$)</span>
            <span />
          </div>

          {/* Rows */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
            {displayItems.map((rem, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
                <input
                  type="month"
                  value={rem.competencia ? rem.competencia.substring(0, 7) : ''}
                  onChange={(e) => handleUpdate(i, 'competencia', e.target.value ? `${e.target.value}-01` : '')}
                  disabled={disabled}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rem.valor || ''}
                  onChange={(e) => handleUpdate(i, 'valor', parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  placeholder="0,00"
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  disabled={disabled}
                  className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Show more / less */}
          {remuneracoes.length > 5 && (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1 mx-auto px-3 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {collapsed ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Mostrar mais {hiddenCount} remunerações
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Recolher
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}
