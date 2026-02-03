import { useLocation } from 'react-router-dom'
import { useAiTools } from '@/features/ai/context'

export interface BreadcrumbItem {
  label: string
  href: string
}

const ROUTE_LABELS: Record<string, string> = {
  app: 'Dashboard',
  clientes: 'Clientes',
  processos: 'Processos',
  prazos: 'Prazos',
  calculadoras: 'Calculadoras',
  rescisao: 'Rescisão Trabalhista',
  aposentadoria: 'Aposentadoria',
  ia: 'IA Jurídica',
  documentos: 'Documentos',
  materiais: 'Materiais',
  configuracoes: 'Configurações',
  ajuda: 'Ajuda',
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation()
  const { getToolBySlug } = useAiTools()

  // Split pathname and filter empty strings
  const pathSegments = location.pathname.split('/').filter(Boolean)

  // If we're on the dashboard root, return empty array (no breadcrumbs needed)
  if (pathSegments.length === 1 && pathSegments[0] === 'app') {
    return []
  }

  // Build breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = []
  let currentPath = ''
  let previousSegment = ''

  pathSegments.forEach((segment) => {
    currentPath += `/${segment}`

    let label: string

    // If previous segment was 'ia', this segment is an AI tool slug
    if (previousSegment === 'ia') {
      const tool = getToolBySlug(segment)
      label = tool?.name || segment.charAt(0).toUpperCase() + segment.slice(1)
    } else {
      // Get label from static mapping, or capitalize as fallback
      label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    }

    breadcrumbs.push({
      label,
      href: currentPath,
    })

    previousSegment = segment
  })

  return breadcrumbs
}
