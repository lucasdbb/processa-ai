import { useEffect } from 'react'
import { useAuthStore } from '../store/auth-store'
import { authService } from '../services/auth-service'
import type { LoginCredentials, RegisterData, UpdateProfileData } from '../types'

export function useAuth() {
  const {
    user,
    isLoading,
    isInitialized,
    setUser,
    setLoading,
    setInitialized,
    logout: clearUser,
  } = useAuthStore()

  useEffect(() => {
    if (!isInitialized) {
      const initAuth = async () => {
        try {
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
        } catch (error) {
          console.error('Failed to initialize auth:', error)
          setUser(null)
        } finally {
          setLoading(false)
          setInitialized(true)
        }
      }

      initAuth()
    }
  }, [isInitialized, setUser, setLoading, setInitialized])

  const login = async (credentials: LoginCredentials) => {
    setLoading(true)
    try {
      await authService.login(credentials)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)

      if (!currentUser) {
        throw new Error('Falha ao carregar usuário após login')
      }

      return currentUser
    } finally {
      setLoading(false)
    }
  }

  const register = async (data: RegisterData) => {
    setLoading(true)
    try {
      await authService.register(data)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)

      if (!currentUser) {
        throw new Error('Falha ao carregar usuário após cadastro')
      }

      return currentUser
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await authService.logout()
      clearUser()
    } catch (error) {
      console.error('Logout failed:', error)
      clearUser()
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (data: UpdateProfileData) => {
    setLoading(true)
    try {
      const updatedUser = await authService.updateProfile(data)
      setUser(updatedUser)
      return updatedUser
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isAuthor: user?.role === 'author' || user?.role === 'admin',
    login,
    register,
    logout,
    updateProfile,
  }
}
