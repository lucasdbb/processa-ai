import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

let MDEditor: typeof import('@uiw/react-md-editor').default | null = null

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Escreva o conteúdo aqui...',
  minHeight = '500px',
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const { resolvedTheme } = useTheme()

  const dataColorMode = resolvedTheme === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    // Lazy load the editor component
    import('@uiw/react-md-editor').then((mod) => {
      MDEditor = mod.default
      setIsLoaded(true)
    })
  }, [])

  if (!isLoaded) {
    return (
      <div className="border border-input rounded-lg overflow-hidden bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Carregando editor...</p>
      </div>
    )
  }

  const Editor = MDEditor
  if (!Editor) return null

  return (
    <div
      className="border border-input rounded-lg overflow-hidden bg-background"
      data-color-mode={dataColorMode}
      ref={editorRef}
    >
      <Editor
        value={value}
        onChange={(val?: string) => onChange(val || '')}
        preview="live"
        height={minHeight}
        textareaProps={{
          placeholder: placeholder,
        }}
        previewOptions={{
          className:
            'prose prose-lg max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground dark:prose-invert dark:prose-headings:text-foreground dark:prose-p:text-foreground/90',
        }}
      />
      <div className="bg-muted/30 border-t border-input px-4 py-2 text-xs text-muted-foreground">
        <p>
          <strong>Dica:</strong> Use os botões acima para formatar o texto. A visualização é
          atualizada automaticamente ao lado.
        </p>
        <p>
          <strong>Quebra de linha:</strong> Para criar um novo parágrafo, deixe uma linha em branco
          entre os textos (pressione Enter duas vezes).
        </p>
      </div>
    </div>
  )
}
