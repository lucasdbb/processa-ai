import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { RouteLoadingBar } from './route-loading-bar'
import { Header } from './header'
import { Footer } from './footer'
import { PageTransition } from './page-transition'
import { LoginModal } from '@/features/auth/components/login-modal'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { usePageTracking } from '@/lib/analytics/hooks'
import { createClient } from '@/lib/supabase/client'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

type BlogCachePayload = {
  cachedAt: number
  posts: unknown[]
}

const BLOG_CACHE_KEY = 'processa_blog_posts_cache_v1'
const BLOG_CACHE_MAX_AGE_MS = 5 * 60 * 1000

function normalizeBlogPosts(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const value = payload as Record<string, unknown>
  const candidates = [value.items, value.posts, value.data]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

type RootLayoutOutletContext = {
  openLoginModal: () => void
  openRegisterModal: () => void
}

export function RootLayout() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginModalView, setLoginModalView] = useState<'login' | 'register' | 'reset_password'>('login')
  const location = useLocation()
  const supabase = createClient()

  // Initialize auth on app load
  useAuth()
  
  // Initialize analytics tracking
  usePageTracking()

  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    if (location.hash) return
    window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (isAdminRoute) return

    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection
    if (connection?.saveData) return
    if (connection?.effectiveType?.includes('2g')) return

    try {
      const cachedRaw = window.sessionStorage.getItem(BLOG_CACHE_KEY)
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as BlogCachePayload
        const isFresh =
          Number.isFinite(cached.cachedAt) &&
          Date.now() - cached.cachedAt <= BLOG_CACHE_MAX_AGE_MS &&
          Array.isArray(cached.posts)
        if (isFresh) return
      }
    } catch {
      // Ignore cache read errors and continue to prefetch.
    }

    let cancelled = false
    const prefetchBlog = async () => {
      if (cancelled) return
      try {
        const response = await fetchWithCredentials(`${API_URL}/blog/posts?published=true`)
        if (!response.ok || cancelled) return

        const payload: unknown = await response.json()
        const posts = normalizeBlogPosts(payload)

        const cachePayload: BlogCachePayload = {
          cachedAt: Date.now(),
          posts,
        }
        window.sessionStorage.setItem(BLOG_CACHE_KEY, JSON.stringify(cachePayload))
      } catch {
        // Ignore prefetch failures.
      }
    }

    const win = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }

    let timeoutId: number | null = null
    let idleId: number | null = null

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(() => void prefetchBlog(), { timeout: 3000 })
    } else {
      timeoutId = window.setTimeout(() => void prefetchBlog(), 1500)
    }

    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId)
      }
    }
  }, [isAdminRoute])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLoginModalView('reset_password')
        setIsLoginModalOpen(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const openLoginModal = () => {
    setLoginModalView('login')
    setIsLoginModalOpen(true)
  }

  const openRegisterModal = () => {
    setLoginModalView('register')
    setIsLoginModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-slate-700 selection:text-white flex flex-col">
      <RouteLoadingBar />
      {isAdminRoute ? null : <Header onLoginClick={openLoginModal} />}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet context={{ openLoginModal, openRegisterModal } satisfies RootLayoutOutletContext} />
          </PageTransition>
        </AnimatePresence>
      </main>
      {isAdminRoute ? null : <Footer />}
      {isLoginModalOpen && (
        <LoginModal
          key={loginModalView}
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          initialView={loginModalView}
        />
      )}
    </div>
  )
}

export type { RootLayoutOutletContext }
