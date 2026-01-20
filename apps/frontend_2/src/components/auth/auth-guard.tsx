import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  useAuth()

  const { isAuthenticated, isLoading } = useUser()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAuthenticated) {
    // Redirect to home with the intended destination
    return <Navigate to={`/?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <>{children}</>
}
