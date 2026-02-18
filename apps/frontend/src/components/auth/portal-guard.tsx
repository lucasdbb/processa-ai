import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface PortalGuardProps {
  children: React.ReactNode
}

/**
 * Protects /portal routes: only office_client users can access them.
 * Any other authenticated user is redirected to /app.
 */
export function PortalGuard({ children }: PortalGuardProps) {
  useAuth()

  const { user, isLoading, isAuthenticated } = useUser()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAuthenticated) {
    return <Navigate to={`/?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (user?.role !== 'office_client') {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
