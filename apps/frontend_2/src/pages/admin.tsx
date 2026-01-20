import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useUser } from '@/features/auth/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { toast } from 'sonner'

interface Post {
  id: string
  slug: string
  title: string
  status: 'draft' | 'published'
  created_at: string
  published_at?: string
}

export default function AdminPage() {
  const { user, isAdmin, isAuthor, isLoading: authLoading } = useUser()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAdmin && !isAuthor) {
      navigate('/')
    }
  }, [authLoading, isAdmin, isAuthor, navigate])

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await fetchWithCredentials(`${API_URL}/blog/posts/admin`)
        if (response.ok) {
          const data = await response.json()
          setPosts(data)
        }
      } catch (error) {
        console.error('Error loading posts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (isAdmin || isAuthor) {
      loadPosts()
    }
  }, [isAdmin, isAuthor])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este post?')) return

    try {
      const response = await fetchWithCredentials(`${API_URL}/blog/posts/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id))
        toast.success('Post excluído com sucesso!')
      } else {
        throw new Error('Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      toast.error('Erro ao excluir post.')
    }
  }

  if (authLoading || isLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (!isAdmin && !isAuthor) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel Admin</h1>
          <p className="mt-2 text-muted-foreground">
            Olá, {user?.name || user?.email}! Gerencie os posts do blog.
          </p>
        </div>
        <Button asChild className="bg-slate-900 hover:bg-slate-800">
          <Link to="/admin/posts/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Post
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                Título
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                Data
              </th>
              <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                  Nenhum post encontrado.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <span className="font-medium text-foreground">{post.title}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        post.status === 'published'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}
                    >
                      {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {formatDate(post.published_at || post.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {post.status === 'published' && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/blog/${post.slug}`} target="_blank">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/posts/${post.id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(post.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
