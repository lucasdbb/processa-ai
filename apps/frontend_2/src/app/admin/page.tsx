'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { AdminPanel } from '@/features/admin/components/admin-panel'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function AdminPage() {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

  useEffect(() => {
    // Timeout de segurança: se após 5 segundos ainda estiver carregando,
    // considerar não autenticado e redirecionar
    const timeout = setTimeout(() => {
      if (isLoading && !user) {
        router.push('/')
      }
    }, 5000)

    return () => clearTimeout(timeout)
  }, [isLoading, user, router])

  useEffect(() => {
    if (!isLoading) {
      setHasCheckedAuth(true)
      if (!user || user.role !== 'admin') {
        router.push('/')
      }
    }
  }, [user, isLoading, router])

  // Mostrar loading apenas enquanto está realmente verificando
  if (isLoading && !hasCheckedAuth) {
    return <LoadingSpinner fullScreen size="lg" text="Carregando painel..." />
  }

  if (!user || user.role !== 'admin') {
    return null
  }

  return (
    <Suspense fallback={<LoadingSpinner fullScreen size="lg" text="Carregando painel..." />}>
      <AdminPanel user={user} />
    </Suspense>
  )
}
