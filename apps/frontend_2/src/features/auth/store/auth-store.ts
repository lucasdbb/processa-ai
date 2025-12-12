import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isInitialized: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
  logout: () => void
}

/**
 * Auth Store using Zustand
 * Manages global authentication state in memory only
 *
 * Why no persistence?
 * - Authentication uses httpOnly cookies (secure, immune to XSS)
 * - Cookies persist automatically across page reloads
 * - No need to store sensitive tokens in localStorage
 * - On mount, we call /auth/me to restore user state from cookie
 *
 * Why Zustand?
 * - Lightweight (< 1KB)
 * - No boilerplate compared to Redux
 * - Perfect for small to medium apps
 * - Better TypeScript support than Context API
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isInitialized: false,

  setUser: (user) => set({ user }),

  setLoading: (isLoading) => set({ isLoading }),

  setInitialized: (isInitialized) => set({ isInitialized }),

  logout: () => set({ user: null, isLoading: false }),
}))
