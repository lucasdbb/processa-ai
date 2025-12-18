'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Lock, Sparkles, CheckCircle2 } from 'lucide-react'
import { LoginModal } from '@/features/auth/components/login-modal'
import Image from 'next/image'

interface ProtectedFeaturePreviewProps {
  title: string
  description: string
  benefits: string[]
  imageSrc?: string
  imageAlt?: string
}

export function ProtectedFeaturePreview({
  title,
  description,
  benefits,
  imageSrc,
  imageAlt,
}: ProtectedFeaturePreviewProps) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginModalView, setLoginModalView] = useState<'login' | 'register'>('login')

  const handleLoginClick = () => {
    setLoginModalView('login')
    setIsLoginModalOpen(true)
  }

  const handleRegisterClick = () => {
    setLoginModalView('register')
    setIsLoginModalOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <Header onLoginClick={handleLoginClick} />

      <main className="flex-1 pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-full text-sm font-semibold mb-6 border border-gray-200">
              <Lock className="h-4 w-4" />
              Recurso Exclusivo para Usuários
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
              {title}
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              {description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={handleLoginClick}
                className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Fazer Login
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleRegisterClick}
                className="border-2 border-gray-900 text-gray-900 hover:bg-gray-50 px-8 py-4 text-lg rounded-2xl transition-all duration-200 font-semibold"
              >
                Criar Conta Grátis
              </Button>
            </div>
          </div>

          {/* Preview Image/Screenshot */}
          {imageSrc && (
            <div className="mb-16 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent z-10 pointer-events-none" />
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-gray-200">
                <Image
                  src={imageSrc}
                  alt={imageAlt || title}
                  width={1200}
                  height={675}
                  sizes="100vw"
                  className="w-full h-auto opacity-60 blur-sm"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm">
                  <div className="text-center">
                    <Lock className="h-16 w-16 text-white mx-auto mb-4 drop-shadow-lg" />
                    <p className="text-white text-xl font-semibold drop-shadow-lg">
                      Faça login para desbloquear
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benefits Section */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 md:p-10 mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center tracking-tight">
              O que você terá acesso
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  <CheckCircle2 className="h-5 w-5 text-gray-900 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700 text-base leading-relaxed">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gray-900 rounded-3xl shadow-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 opacity-50" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                Pronto para começar?
              </h2>
              <p className="text-xl mb-8 text-gray-300">
                Crie sua conta gratuitamente e acesse todas as ferramentas
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button
                  size="lg"
                  onClick={handleRegisterClick}
                  className="bg-white text-gray-900 hover:bg-gray-100 px-8 py-4 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                >
                  Criar Conta Grátis
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleLoginClick}
                  className="border-2 border-white text-white hover:bg-white/10 px-8 py-4 text-lg rounded-2xl transition-all duration-200 font-semibold"
                >
                  Já tenho conta
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        initialView={loginModalView}
      />
    </div>
  )
}
