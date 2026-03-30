import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BrainCircuit,
  Calculator,
  Users,
  BookOpen,
  Shield,
  Zap,
  ChevronDown,
  Check,
  Mail,
  Gift,
  Copy,
  Share2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function WaitlistSuccessModal({
  open,
  onClose,
  referralCode,
  referralLink,
  isAlreadyRegistered,
}: {
  open: boolean
  onClose: () => void
  referralCode: string | null
  referralLink: string | null
  isAlreadyRegistered: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  const handleWhatsAppShare = () => {
    if (!referralLink) return
    const text = `Conheça o Processa AI – a plataforma de IA para advogados brasileiros! Use meu link para se inscrever: ${referralLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center">
          <DialogHeader className="items-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
              <Gift className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-2xl">
              {isAlreadyRegistered
                ? 'Você já está na lista!'
                : 'Inscrição confirmada!'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {isAlreadyRegistered
                ? 'Seu link de indicação continua ativo.'
                : 'Você está na lista de espera do Processa AI.'}
            </DialogDescription>
          </DialogHeader>

          {referralCode && referralLink && (
            <div className="w-full mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Promoção de pré-lançamento:</strong>{' '}
                indique colegas e ganhe{' '}
                <strong className="text-foreground">5 créditos</strong> para
                cada pessoa que assinar a plataforma.
              </p>

              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Seu código</p>
                <p className="text-lg font-mono font-bold tracking-wider">
                  {referralCode}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 text-xs bg-muted rounded-md px-3 py-2 truncate border border-border"
                />
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={handleCopy}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar link
                </Button>
                <Button className="flex-1" onClick={handleWhatsAppShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="w-full mt-4">
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function WaitlistForm({ id, isDark }: { id?: string; isDark: boolean }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referralLink, setReferralLink] = useState<string | null>(null)
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      toast.error('Informe seu e-mail')
      return
    }

    setIsSubmitting(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const utmSource = params.get('utm_source')
      const refCode = params.get('ref')

      const response = await fetchWithCredentials(`${API_URL}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          name: name.trim() || null,
          utm_source: utmSource,
          ref_code: refCode,
        }),
      })

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as {
          detail?: string
        } | null
        throw new Error(error?.detail || 'Erro ao se inscrever')
      }

      const data = (await response.json()) as {
        status: string
        referral_code?: string
        referral_link?: string
      }

      setReferralCode(data.referral_code || null)
      setReferralLink(data.referral_link || null)
      setIsAlreadyRegistered(data.status === 'already_registered')
      setShowSuccessModal(true)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao se inscrever',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form id={id} onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
        <div className="flex flex-col gap-2.5 sm:gap-2 mb-2">
          <input
            type="text"
            placeholder="Seu nome (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-4 py-3.5 sm:py-3 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
            }`}
            disabled={isSubmitting}
          />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Seu melhor e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-4 py-3.5 sm:py-3 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
            }`}
            disabled={isSubmitting}
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 sm:py-3 px-6 rounded-xl font-semibold text-base sm:text-sm transition-all duration-200 shadow-lg hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isDark
                ? 'bg-white text-slate-900 hover:bg-slate-100'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {isSubmitting ? (
              'Inscrevendo...'
            ) : (
              <>
                Garantir minha vaga
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
        <p
          className={`text-xs text-center mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        >
          Sem spam. Avisaremos quando estiver pronto.
        </p>
      </form>
      <WaitlistSuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        referralCode={referralCode}
        referralLink={referralLink}
        isAlreadyRegistered={isAlreadyRegistered}
      />
    </>
  )
}

function FAQItem({
  question,
  answer,
  isDark,
}: {
  question: string
  answer: string
  isDark: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={`border-b last:border-b-0 ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span
          className={`text-sm sm:text-base font-medium pr-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
        >
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <p
          className={`pb-5 text-sm leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          {answer}
        </p>
      )}
    </div>
  )
}

function FeatureRow({
  icon: Icon,
  title,
  description,
  image,
  isDark,
  reverse,
}: {
  icon: LucideIcon
  title: string
  description: string
  image: string
  isDark: boolean
  reverse?: boolean
}) {
  return (
    <div
      className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 md:gap-16`}
    >
      <div className="flex-1 text-center md:text-left">
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 ${
            isDark
              ? 'bg-slate-800 border border-slate-700'
              : 'bg-slate-100 border border-slate-200'
          }`}
        >
          <Icon
            className={`w-6 h-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            strokeWidth={1.5}
          />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
          {title}
        </h3>
        <p
          className={`text-sm sm:text-base leading-relaxed max-w-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
        >
          {description}
        </p>
      </div>
      <div className="flex-1 w-full max-w-sm">
        <img
          src={image}
          alt={title}
          className={`w-full rounded-2xl shadow-lg border ${
            isDark ? 'border-slate-700/50' : 'border-slate-200'
          }`}
          loading="lazy"
        />
      </div>
    </div>
  )
}

export default function WaitlistPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const features = [
    {
      icon: Users,
      title: 'Gestão completa do escritório',
      description:
        'Clientes, processos, prazos, honorários, documentos e calendário. Chega de alternar entre planilhas, WhatsApp e sistemas diferentes.',
      image: '/images/waitlist/painel_gestao.png',
    },
    {
      icon: BrainCircuit,
      title: 'IA treinada para o direito brasileiro',
      description:
        'Análise de CNIS, resumos de processos, petições trabalhistas, chat jurídico com RAG e muito mais. Resultados em minutos, não em horas.',
      image: '/images/waitlist/analise_cnis.png',
    },
    {
      icon: Calculator,
      title: 'Calculadoras com relatório em PDF',
      description:
        'Rescisão trabalhista, simulações previdenciárias, correção monetária e muito mais. Cálculos precisos e relatórios prontos para apresentar ao cliente.',
      image: '/images/waitlist/calculadora_rescisao.png',
    },
    {
      icon: BookOpen,
      title: 'Biblioteca de materiais jurídicos',
      description:
        'E-books, planilhas, modelos de petições e guias práticos. Tudo o que você precisa para não começar do zero.',
      image: '/images/waitlist/materiais.png',
    },
  ]

  const benefits = [
    'Acesso antecipado antes do lançamento público',
    'Condições especiais para os primeiros usuários',
    'Participação direta no desenvolvimento do produto',
    'Suporte prioritário da equipe',
  ]

  const faqs = [
    {
      question: 'Quando o Processa AI será lançado?',
      answer:
        'Estamos nos preparativos finais. Quem está na lista de espera será o primeiro a ter acesso.',
    },
    {
      question: 'A inscrição na lista é gratuita?',
      answer:
        'Sim, a inscrição é totalmente gratuita e sem compromisso. Você será notificado por e-mail quando tiver acesso.',
    },
    {
      question: 'Meus dados estão seguros?',
      answer:
        'Sim. Usamos criptografia de ponta a ponta e seguimos as melhores práticas de segurança. Seus dados são armazenados de forma segura e nunca compartilhados com terceiros.',
    },
    {
      question: 'O Processa AI funciona para qualquer área do direito?',
      answer:
        'No lançamento, teremos foco em direito trabalhista e previdenciário, com expansão para outras áreas em breve.',
    },
    {
      question: 'Quanto vai custar?',
      answer:
        'Teremos planos acessíveis para estudantes e advogados, com planos para escritórios chegando em breve. Quem entrar pela lista de espera garante condições especiais de lançamento.',
    },
  ]

  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-center pt-16 sm:pt-20 pb-8 sm:pb-0 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[1000px] h-[400px] sm:h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10 text-center flex-grow flex flex-col justify-center">
          <div
            className={`inline-flex items-center gap-2 mx-auto px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold mb-6 sm:mb-8 ${
              isDark
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Vagas limitadas para acesso antecipado
          </div>

          <h1 className="text-[2.25rem] sm:text-5xl md:text-6xl lg:text-8xl font-bold tracking-tight text-foreground mb-5 sm:mb-8 leading-[1.15] sm:leading-[1.1]">
            A inteligência artificial{' '}
            <br className="hidden sm:block" />
            do{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground via-muted-foreground to-foreground">
              advogado brasileiro
            </span>
            .
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2 sm:px-0">
            Gestão do escritório, IA jurídica, calculadoras e muito mais. Tudo
            num só lugar. Garanta seu acesso antecipado.
          </p>

          <div id="waitlist-form" className="px-1 sm:px-0">
            <WaitlistForm isDark={isDark} />
          </div>
        </div>
      </section>

      {/* Problema / Solução — texto direto, sem card */}
      <section className={`py-24 ${isDark ? '' : 'bg-white'}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p
            className={`text-xl sm:text-2xl md:text-3xl font-medium leading-snug tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
          >
            Advogados perdem{' '}
            <span
              className={
                isDark ? 'text-white font-bold' : 'text-slate-900 font-bold'
              }
            >
              horas por semana
            </span>{' '}
            com tarefas que a tecnologia resolve em minutos.
          </p>
          <div
            className={`w-16 h-0.5 my-8 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}
          />
          <p
            className={`text-base sm:text-lg leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
          >
            Planilhas, WhatsApp, sistemas que não se conectam. O Processa AI
            reúne gestão, inteligência artificial e cálculos jurídicos em uma
            única plataforma feita para o direito brasileiro.
          </p>
        </div>
      </section>

      {/* Features — layout alternado, sem grid de cards */}
      <section
        className={`py-24 ${isDark ? 'bg-slate-900/50' : 'bg-slate-100'}`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p
            className={`text-xs font-semibold uppercase tracking-widest mb-16 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          >
            O que você terá acesso
          </p>

          <div className="space-y-20 sm:space-y-28">
            {features.map((feature, i) => (
              <FeatureRow
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                image={feature.image}
                isDark={isDark}
                reverse={i % 2 !== 0}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Benefits — lista simples com checks, sem cards */}
      <section className={`py-24 ${isDark ? '' : 'bg-white'}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-start md:gap-16">
            <div className="md:flex-1 mb-10 md:mb-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                Por que entrar agora?
              </h2>
              <p
                className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                Quem chega primeiro tem vantagens que não estarão disponíveis
                depois do lançamento.
              </p>
            </div>
            <ul className="md:flex-1 space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <Check
                    className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`}
                  />
                  <span
                    className={`text-sm sm:text-base ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                  >
                    {benefit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ — sem card wrapper, direto no fundo */}
      <section
        className={`py-24 ${isDark ? 'bg-slate-900/50' : 'bg-slate-100'}`}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-10 text-center">
            Perguntas frequentes
          </h2>
          <div>
            {faqs.map((faq) => (
              <FAQItem key={faq.question} {...faq} isDark={isDark} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            className={`rounded-[2.5rem] p-8 md:p-16 text-center relative overflow-hidden shadow-2xl ${
              isDark ? 'bg-muted' : 'bg-slate-900'
            }`}
          >
            <div className="absolute inset-0">
              <div
                className={`absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 ${
                  isDark ? 'bg-background/10' : 'bg-white/5'
                }`}
              />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <div
                className={`inline-flex items-center gap-2 mx-auto px-3 py-1.5 rounded-full text-xs font-semibold mb-6 ${
                  isDark
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-white/10 text-white/80'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Lista de espera aberta
              </div>

              <h2
                className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight leading-tight ${
                  isDark ? 'text-foreground' : 'text-white'
                }`}
              >
                Não fique de fora.
              </h2>
              <p
                className={`text-sm sm:text-base md:text-lg mb-8 leading-relaxed font-light ${
                  isDark ? 'text-muted-foreground' : 'text-slate-300'
                }`}
              >
                Garanta seu lugar entre os primeiros advogados a usar o Processa
                AI.
              </p>

              <WaitlistForm id="waitlist-form-bottom" isDark={!isDark} />

              <div className="flex items-center justify-center gap-4 mt-6">
                <div className="flex items-center gap-1.5">
                  <Shield
                    className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  />
                  <span
                    className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  >
                    Dados protegidos
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap
                    className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  />
                  <span
                    className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  >
                    Acesso gratuito na lista
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog CTA — inline, sem card */}
      <section
        className={`py-10 ${isDark ? 'bg-slate-900/50' : 'bg-slate-100'}`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground text-sm mb-3">
            Enquanto espera, conheça nosso conteúdo jurídico
          </p>
          <Link
            to="/blog"
            className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${
              isDark
                ? 'text-slate-300 hover:text-slate-100'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Acessar o Blog
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
