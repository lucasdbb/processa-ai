import { useEffect } from 'react'

const BASE_TITLE = 'Processa AI'
const DEFAULT_DESCRIPTION =
  'Plataforma completa para advogados: gestão de escritório, ferramentas de IA jurídica, calculadoras trabalhistas e previdenciárias.'
const SITE_URL = 'https://processai.app.br'
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-image.png`

interface SEOProps {
  title?: string
  description?: string
  ogImage?: string
  ogUrl?: string
  noindex?: boolean
}

/**
 * Lightweight SEO component that updates document.title and meta tags.
 * Works with any router setup (no provider needed).
 */
export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  ogImage = DEFAULT_OG_IMAGE,
  ogUrl,
  noindex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE

  useEffect(() => {
    document.title = fullTitle

    setMeta('description', description)
    setMeta('og:title', fullTitle)
    setMeta('og:description', description)
    setMeta('og:image', ogImage)
    if (ogUrl) setMeta('og:url', ogUrl)
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', description)
    setMeta('twitter:image', ogImage)

    if (noindex) {
      setMeta('robots', 'noindex, nofollow')
    } else {
      removeMeta('robots')
    }

    return () => {
      // Reset to defaults on unmount so stale tags don't persist
      document.title = BASE_TITLE
      setMeta('description', DEFAULT_DESCRIPTION)
      setMeta('og:title', BASE_TITLE)
      setMeta('og:description', DEFAULT_DESCRIPTION)
      setMeta('og:image', DEFAULT_OG_IMAGE)
      removeMeta('og:url')
      setMeta('twitter:title', BASE_TITLE)
      setMeta('twitter:description', DEFAULT_DESCRIPTION)
      setMeta('twitter:image', DEFAULT_OG_IMAGE)
      removeMeta('robots')
    }
  }, [fullTitle, description, ogImage, ogUrl, noindex])

  return null
}

function setMeta(nameOrProperty: string, content: string) {
  const isOg = nameOrProperty.startsWith('og:') || nameOrProperty.startsWith('twitter:')
  const attr = isOg ? 'property' : 'name'
  let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, nameOrProperty)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeMeta(nameOrProperty: string) {
  const isOg = nameOrProperty.startsWith('og:') || nameOrProperty.startsWith('twitter:')
  const attr = isOg ? 'property' : 'name'
  const el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`)
  if (el) el.remove()
}
