import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface PortalGuardProps {
  children: React.ReactNode
}

/**
 * Protects /portal routes.
 * - office_client can access normally
 * - other authenticated users can access only in preview mode (?previewClientId=...)
 */
export function PortalGuard({ children }: PortalGuardProps) {
  useAuth()

  const { user, isLoading, isAuthenticated } = useUser()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAuthenticated) {
    return <Navigate to={`/?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />
  }

  if (user?.role === 'office_client') {
    return <>{children}</>
  }

  const params = new URLSearchParams(location.search)
  const previewClientId = params.get('previewClientId')

  if (!previewClientId) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
