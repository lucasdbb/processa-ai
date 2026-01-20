import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface AdminGuardProps {
  children: React.ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  useAuth()

  const { isAuthenticated, isAdmin, isAuthor, isLoading } = useUser()

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (!isAdmin && !isAuthor) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
