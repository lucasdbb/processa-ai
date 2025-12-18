'use client'

import dynamic from 'next/dynamic'
import '@uiw/react-markdown-preview/markdown.css'

const MDPreview = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false })

interface MarkdownPreviewProps {
  source: string
  className?: string
}

export function MarkdownPreview({ source, className }: MarkdownPreviewProps) {
  return (
    <div data-color-mode="light">
      <MDPreview
        source={source}
        className={className}
        wrapperElement={{
          'data-color-mode': 'light'
        }}
      />
    </div>
  )
}
