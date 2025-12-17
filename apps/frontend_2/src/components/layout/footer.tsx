/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { Linkedin, Instagram, Facebook } from 'lucide-react'

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="bg-white border-t border-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Brand & Copyright */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              onClick={scrollToTop}
              className="flex items-center gap-2 group"
            >
              <img
                src="/logo.png"
                alt=""
                className="h-6 w-auto object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
              />
            </Link>
            <span className="hidden md:block w-px h-4 bg-gray-300"></span>
            <p className="text-sm text-gray-400">
              © 2025. Todos os direitos reservados.
            </p>
          </div>

          {/* Minimal Links */}
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link
              href="/termos"
              onClick={scrollToTop}
              className="hover:text-gray-900 transition-colors"
            >
              Termos
            </Link>
            <Link
              href="/privacidade"
              onClick={scrollToTop}
              className="hover:text-gray-900 transition-colors"
            >
              Privacidade
            </Link>
            <Link
              href="/contato"
              onClick={scrollToTop}
              className="hover:text-gray-900 transition-colors"
            >
              Contato
            </Link>
          </div>

          {/* Social Icons Minimal */}
          <div className="flex gap-4">
            <a
              href="#"
              className="text-gray-400 hover:text-gray-900 transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-pink-600 transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-blue-600 transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
