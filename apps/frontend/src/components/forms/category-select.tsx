const CATEGORIES = [
  { name: 'Direito Trabalhista', slug: 'direito-trabalhista' },
  { name: 'Direito Previdenciário', slug: 'direito-previdenciario' },
  { name: 'Direito Civil', slug: 'direito-civil' },
  { name: 'Direito do Consumidor', slug: 'direito-do-consumidor' },
  { name: 'Direito Penal', slug: 'direito-penal' },
  { name: 'Direito Tributário', slug: 'direito-tributario' },
  { name: 'Direito Empresarial', slug: 'direito-empresarial' },
  { name: 'Direito Imobiliário', slug: 'direito-imobiliario' },
  { name: 'Direito de Família', slug: 'direito-de-familia' },
  { name: 'Direito Administrativo', slug: 'direito-administrativo' },
]

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
}

export function CategorySelect({ value, onChange }: CategorySelectProps) {
  const selectedCategory = CATEGORIES.find((cat) => cat.slug === value)

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground h-10"
      >
        <option value="" className="bg-popover text-popover-foreground">
          Selecione uma categoria
        </option>
        {CATEGORIES.map((category) => (
          <option
            key={category.slug}
            value={category.slug}
            className="bg-popover text-popover-foreground"
          >
            {category.name}
          </option>
        ))}
      </select>
      {selectedCategory && (
        <p className="text-xs text-muted-foreground">
          Slug da categoria:{' '}
          <code className="bg-muted text-foreground px-1 rounded">{selectedCategory.slug}</code>
        </p>
      )}
    </div>
  )
}
