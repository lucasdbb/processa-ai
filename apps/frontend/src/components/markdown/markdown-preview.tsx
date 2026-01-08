'use client'

import dynamic from 'next/dynamic'
import '@uiw/react-markdown-preview/markdown.css'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

const MDPreview = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false })

interface MarkdownPreviewProps {
  source: string
  className?: string
}

export function MarkdownPreview({ source, className }: MarkdownPreviewProps) {
  const { resolvedTheme } = useTheme()
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const isDark = hasMounted && resolvedTheme === 'dark'
  const mergedClassName = `${className || ''}${isDark ? ' prose-invert' : ''}`.trim()

  return (
    <div data-color-mode={isDark ? 'dark' : 'light'}>
      <MDPreview
        source={source}
        className={mergedClassName}
        style={{ backgroundColor: 'transparent' }}
        wrapperElement={{
          'data-color-mode': isDark ? 'dark' : 'light'
        }}
      />
    </div>
  )
}
