import { useAuthStore } from '../store/auth-store'

export function useUser() {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isAuthor: user?.role === 'author' || user?.role === 'admin',
  }
}
