'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Linkedin } from 'lucide-react'

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="bg-background border-t border-border py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Brand & Copyright */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              onClick={scrollToTop}
              className="flex items-center gap-2 group"
            >
              <Image
                src="/logo_v2.png"
                alt=""
                width={96}
                height={24}
                className="h-6 w-auto object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
              />
            </Link>
            <span className="hidden md:block w-px h-4 bg-muted"></span>
            <p className="text-sm text-muted-foreground">
              © 2025. Todos os direitos reservados.
            </p>
          </div>

          {/* Minimal Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/termos"
              onClick={scrollToTop}
              className="hover:text-foreground transition-colors"
            >
              Termos
            </Link>
            <Link
              href="/privacidade"
              onClick={scrollToTop}
              className="hover:text-foreground transition-colors"
            >
              Privacidade
            </Link>
            <Link
              href="/contato"
              onClick={scrollToTop}
              className="hover:text-foreground transition-colors"
            >
              Contato
            </Link>
          </div>

          {/* Social Icons Minimal */}
          <div className="flex gap-4">
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
