import { useState } from 'react'
import { Search, ChevronDown, ChevronUp, Book, Mail } from 'lucide-react'
import { SEO } from '@/components/seo'
import { cn } from '@/lib/utils'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: 'geral' | 'ia' | 'calculadoras' | 'processos' | 'documentos'
}

const faqItems: FAQItem[] = [
  // Geral
  {
    id: '1',
    category: 'geral',
    question: 'Por onde começo dentro do app?',
    answer:
      'Após o login, você chega ao Dashboard. O fluxo recomendado é: cadastrar clientes, registrar processos e prazos, e organizar documentos. Em seguida, explore as ferramentas de IA Jurídica e as Calculadoras no menu lateral.',
  },
  {
    id: '2',
    category: 'geral',
    question: 'Como funcionam as notificações e os prazos?',
    answer:
      'Você recebe avisos de prazos, atualizações de processos e eventos importantes. Todas as notificações ficam no ícone de sino do header e as preferências podem ser ajustadas em Configurações.',
  },
  {
    id: '3',
    category: 'geral',
    question: 'Posso usar a plataforma em dispositivos móveis?',
    answer:
      'Sim! A plataforma é totalmente responsiva e funciona em smartphones e tablets. Você pode acessar através do navegador do seu dispositivo móvel sem necessidade de instalar aplicativos.',
  },

  // IA
  {
    id: '4',
    category: 'ia',
    question: 'Como usar as ferramentas de IA Jurídica?',
    answer:
      'Acesse IA Jurídica no menu, escolha a ferramenta e envie as informações ou arquivos necessários. A IA gera análises e documentos com base nos dados fornecidos, e você pode revisar antes de salvar.',
  },
  {
    id: '5',
    category: 'ia',
    question: 'A IA analisa CNIS e gera resumo processual?',
    answer:
      'Sim. Você pode enviar um PDF de CNIS para análise automática e também gerar resumos processuais com pontos-chave e inconsistências. O resultado fica disponível no próprio fluxo de trabalho.',
  },
  {
    id: '6',
    category: 'ia',
    question: 'Como funcionam os créditos de IA?',
    answer:
      'Cada execução de IA consome créditos. Os créditos da assinatura são renovados mensalmente e os créditos extras não expiram. Você pode acompanhar o consumo no painel da plataforma.',
  },

  // Calculadoras
  {
    id: '7',
    category: 'calculadoras',
    question: 'Quais calculadoras estão disponíveis?',
    answer:
      'A lista de calculadoras fica na página de Calculadoras e é atualizada constantemente. O acesso pode variar por plano, então verifique as opções liberadas no seu perfil.',
  },
  {
    id: '8',
    category: 'calculadoras',
    question: 'Posso salvar os cálculos realizados?',
    answer:
      'Sim. Os cálculos podem ficar vinculados ao cliente e são acessíveis depois na página de Calculadoras ou no perfil do cliente relacionado.',
  },
  {
    id: '9',
    category: 'calculadoras',
    question: 'Os cálculos seguem a legislação atualizada?',
    answer:
      'Sim, nossas calculadoras são atualizadas regularmente para refletir mudanças na legislação, índices de correção (INPC, TR, IPCA-E) e tabelas oficiais como salário mínimo e teto do INSS.',
  },

  // Processos
  {
    id: '10',
    category: 'processos',
    question: 'Como cadastro um novo processo?',
    answer:
      'Acesse "Processos" no menu lateral e clique em "+ Novo processo". Informe número, tipo, vara, partes e valor da causa. Depois, você pode anexar documentos e criar prazos vinculados.',
  },
  {
    id: '11',
    category: 'processos',
    question: 'Como acompanho prazos e alertas?',
    answer:
      'Os prazos ficam organizados na página "Prazos" e também dentro de cada processo. Você recebe notificações automáticas antes do vencimento para evitar perdas de prazo.',
  },
  {
    id: '12',
    category: 'processos',
    question: 'Posso importar processos automaticamente?',
    answer:
      'Em breve! Estamos desenvolvendo integração com sistemas dos tribunais para importação automática de processos e andamentos processuais. Por enquanto, o cadastro é manual.',
  },

  // Documentos
  {
    id: '13',
    category: 'documentos',
    question: 'Onde ficam salvos os documentos gerados?',
    answer:
      'Os documentos gerados ficam na seção "Documentos", organizados por data e tipo. Eles também podem ser acessados a partir do cliente ou processo relacionado.',
  },
  {
    id: '14',
    category: 'documentos',
    question: 'Posso editar ou baixar os documentos?',
    answer:
      'Sim. Você pode editar o conteúdo diretamente na plataforma ou fazer download para ajustar no seu editor preferido antes de usar.',
  },
  {
    id: '15',
    category: 'documentos',
    question: 'Os documentos ficam armazenados na nuvem?',
    answer:
      'Sim, todos os documentos são armazenados de forma segura em servidores na nuvem com criptografia. Você pode acessá-los de qualquer dispositivo e eles contam com backup automático.',
  },
]

const categories = [
  { id: 'todos', label: 'Todos', value: 'todos' as const },
  { id: 'geral', label: 'Geral', value: 'geral' as const },
  { id: 'ia', label: 'IA Jurídica', value: 'ia' as const },
  { id: 'calculadoras', label: 'Calculadoras', value: 'calculadoras' as const },
  { id: 'processos', label: 'Processos', value: 'processos' as const },
  { id: 'documentos', label: 'Documentos', value: 'documentos' as const },
]

export default function AjudaPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<
    'todos' | 'geral' | 'ia' | 'calculadoras' | 'processos' | 'documentos'
  >('todos')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const filteredFAQ = faqItems.filter((item) => {
    const matchesCategory = selectedCategory === 'todos' || item.category === selectedCategory
    const matchesSearch =
      search === '' ||
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="space-y-6">
      <SEO title="Ajuda" noindex />
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Central de Ajuda</h1>
        <p className="text-muted-foreground mt-1">
          Encontre respostas para suas dúvidas sobre a plataforma
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por palavra-chave..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.value)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedCategory === category.value
                ? 'bg-slate-900 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {filteredFAQ.length === 0 ? (
          <div className="p-12 text-center">
            <Book className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">
              Nenhuma pergunta encontrada
            </h3>
            <p className="text-muted-foreground text-sm">
              Tente buscar com outros termos ou selecione outra categoria
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredFAQ.map((item) => {
              const isExpanded = expandedItems.has(item.id)

              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full p-4 sm:p-5 text-left hover:bg-muted/50 transition-colors flex items-center justify-between gap-4"
                  >
                    <span className="text-sm font-medium text-foreground flex-1">
                      {item.question}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Contact Support */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Ainda precisa de ajuda?</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Nossa equipe responde por e-mail em até 24 horas úteis.
          </p>
          <a
            href="mailto:suporte@processai.app.br"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            <Mail className="h-4 w-4" />
            suporte@processai.app.br
          </a>
        </div>
      </div>
    </div>
  )
}
