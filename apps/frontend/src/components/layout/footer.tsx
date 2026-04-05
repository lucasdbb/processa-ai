import { Link } from 'react-router-dom'
import { useTheme } from 'next-themes'

export function Footer() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const logoSrc = isDark ? '/logo_dark.png' : '/logo_light.png'

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="bg-background border-t border-border py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              onClick={scrollToTop}
              className="flex items-center gap-2 group"
            >
              <img
                src={logoSrc}
                alt=""
                className="h-8 w-auto object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
              />
            </Link>
            <span className="hidden md:block w-px h-4 bg-muted"></span>
            <p className="text-sm text-muted-foreground">
              © 2026. Todos os direitos reservados.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              to="/termos"
              onClick={scrollToTop}
              className="hover:text-foreground transition-colors"
            >
              Termos
            </Link>
            <Link
              to="/privacidade"
              onClick={scrollToTop}
              className="hover:text-foreground transition-colors"
            >
              Privacidade
            </Link>
            <Link
              to="/transparencia-ia"
              onClick={scrollToTop}
              className="hover:text-foreground transition-colors"
            >
              Transparência de IA
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
