'use client'

import dynamic from 'next/dynamic'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

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
  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden" data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        preview="live"
        height={minHeight}
        textareaProps={{
          placeholder: placeholder,
        }}
        previewOptions={{
          className: 'prose prose-lg prose-gray max-w-none',
        }}
      />
      <div className="bg-gray-50 border-t border-gray-300 px-4 py-2 text-xs text-gray-600">
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
