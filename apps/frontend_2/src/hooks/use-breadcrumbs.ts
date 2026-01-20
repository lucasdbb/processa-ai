import { useLocation } from 'react-router-dom'

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
  chat: 'Chat',
  peticao: 'Petição',
  cnis: 'Análise CNIS',
  documentos: 'Documentos',
  materiais: 'Materiais',
  configuracoes: 'Configurações',
  ajuda: 'Ajuda',
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation()

  // Split pathname and filter empty strings
  const pathSegments = location.pathname.split('/').filter(Boolean)

  // If we're on the dashboard root, return empty array (no breadcrumbs needed)
  if (pathSegments.length === 1 && pathSegments[0] === 'app') {
    return []
  }

  // Build breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = []
  let currentPath = ''

  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`

    // Get label from mapping, or capitalize the segment as fallback
    const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)

    breadcrumbs.push({
      label,
      href: currentPath,
    })
  })

  return breadcrumbs
}
