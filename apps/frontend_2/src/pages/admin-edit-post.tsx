import { useNavigate, useParams } from 'react-router-dom'
import { useUser } from '@/features/auth/hooks/use-user'
import { useEffect } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function AdminEditPostPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin, isAuthor, isLoading } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAdmin && !isAuthor) {
      navigate('/')
    }
  }, [isLoading, isAdmin, isAuthor, navigate])

  if (isLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-8">Editar Post</h1>
      <div className="bg-card rounded-2xl border border-border p-8">
        <p className="text-muted-foreground text-center">
          Editando post ID: {id}
        </p>
        <p className="text-muted-foreground text-center mt-2">
          Editor de posts em desenvolvimento.
        </p>
      </div>
    </div>
  )
}
