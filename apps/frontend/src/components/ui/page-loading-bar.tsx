'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function PageLoadingBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(false)
  }, [pathname, searchParams])

  useEffect(() => {
    const handleStart = () => setLoading(true)

    // Listen to route changes
    window.addEventListener('beforeunload', handleStart)

    return () => {
      window.removeEventListener('beforeunload', handleStart)
    }
  }, [])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
      <div
        className="h-full bg-gray-900 animate-pulse transition-all duration-300"
        style={{
          width: '70%',
          animation: 'loading 1s ease-in-out infinite',
        }}
      />
      <style jsx>{`
        @keyframes loading {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
