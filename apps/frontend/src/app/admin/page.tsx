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
    if (!isLoading) {
      setHasCheckedAuth(true)
      if (!user || (user.role !== 'admin' && user.role !== 'author')) {
        router.push('/')
      }
    }
  }, [user, isLoading, router])

  // Mostrar loading apenas enquanto está realmente verificando
  if (isLoading && !hasCheckedAuth) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!user || (user.role !== 'admin' && user.role !== 'author')) {
    return null
  }

  return (
    <Suspense fallback={<LoadingSpinner fullScreen size="lg" />}>
      <AdminPanel user={user} />
    </Suspense>
  )
}
