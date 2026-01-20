import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs'

export function Breadcrumbs() {
  const breadcrumbs = useBreadcrumbs()

  // Don't render if we're on the dashboard (no breadcrumbs needed)
  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className="hidden sm:block">
      <ol className="flex items-center gap-2 text-sm">
        {/* Always show Dashboard as first breadcrumb */}
        <li className="flex items-center gap-2">
          <Link
            to="/app"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </li>

        {/* Render each breadcrumb */}
        {breadcrumbs.slice(1).map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 2

          return (
            <li key={breadcrumb.href} className="flex items-center gap-2">
              {isLast ? (
                // Last breadcrumb - current page (not clickable)
                <span
                  className="text-foreground font-medium"
                  aria-current="page"
                >
                  {breadcrumb.label}
                </span>
              ) : (
                // Intermediate breadcrumbs (clickable)
                <>
                  <Link
                    to={breadcrumb.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {breadcrumb.label}
                  </Link>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
