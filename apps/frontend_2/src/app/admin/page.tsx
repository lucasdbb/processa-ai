'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { AdminPanel } from '@/features/admin/components/admin-panel'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function AdminPage() {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" text="Carregando painel..." />
  }

  if (!user || user.role !== 'admin') {
    return null
  }

  return <AdminPanel user={user} />
}
