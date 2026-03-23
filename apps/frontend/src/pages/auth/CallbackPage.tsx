import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'

export default function CallbackPage() {
  const navigate = useNavigate()
  const supabase = createClient()

  useEffect(() => {
    // Handle OAuth / magic-link callback
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate('/')
        return
      }

      try {
        // Check the user's role to decide where to redirect
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (profile?.role === 'office_client') {
          navigate('/portal', { replace: true })
        } else {
          navigate('/app', { replace: true })
        }
      } catch {
        // Profile fetch failed — redirect to app as default
        navigate('/app', { replace: true })
      }
    }).catch(() => {
      // Session retrieval failed — redirect to home
      navigate('/')
    })
  }, [navigate, supabase])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-gray-600">Autenticando...</p>
      </div>
    </div>
  )
}
