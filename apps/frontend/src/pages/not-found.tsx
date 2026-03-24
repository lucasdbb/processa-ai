import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <FileQuestion className="h-20 w-20 text-muted-foreground" />
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-lg text-muted-foreground">
          Página não encontrada
        </p>
        <p className="text-sm text-muted-foreground max-w-md">
          A página que você está procurando não existe ou foi movida.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild variant="default">
          <Link to="/">Voltar ao início</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app">Ir para o painel</Link>
        </Button>
      </div>
    </div>
  )
}
