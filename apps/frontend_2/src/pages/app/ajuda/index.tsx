import { useState } from 'react'
import { Search, ChevronDown, ChevronUp, Book, MessageCircle, Mail, Phone } from 'lucide-react'
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
    question: 'Como faço para começar a usar a plataforma?',
    answer:
      'Após fazer login, você terá acesso ao dashboard principal. Recomendamos começar cadastrando seus clientes em "Clientes", depois registrar os processos em "Processos". Você também pode explorar as ferramentas de IA e calculadoras jurídicas disponíveis no menu lateral.',
  },
  {
    id: '2',
    category: 'geral',
    question: 'Como funciona o sistema de notificações?',
    answer:
      'O sistema envia notificações para prazos próximos do vencimento, atualizações de processos e quando novos documentos são gerados. Você pode visualizar todas as notificações clicando no ícone de sino no header e gerenciar suas preferências em Configurações.',
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
    question: 'Como funciona a ferramenta de IA para petições?',
    answer:
      'Nossa IA foi treinada com milhares de peças processuais. Você fornece as informações básicas do caso (partes, fatos, pedidos) e a IA gera uma petição completa seguindo as normas técnicas e jurídicas. Você pode revisar e editar o documento antes de salvá-lo.',
  },
  {
    id: '5',
    category: 'ia',
    question: 'A IA pode analisar documentos CNIS?',
    answer:
      'Sim! Você pode fazer upload de um arquivo CNIS e nossa IA fará a análise automática, identificando períodos contributivos, inconsistências, lacunas e sugerindo as melhores estratégias para ações previdenciárias.',
  },
  {
    id: '6',
    category: 'ia',
    question: 'As respostas da IA têm validade jurídica?',
    answer:
      'A IA é uma ferramenta de apoio que auxilia na redação e pesquisa, mas não substitui a análise jurídica profissional. Todos os documentos gerados devem ser revisados por um advogado antes de serem utilizados.',
  },

  // Calculadoras
  {
    id: '7',
    category: 'calculadoras',
    question: 'Quais calculadoras estão disponíveis?',
    answer:
      'Atualmente oferecemos calculadoras de Rescisão Trabalhista e Aposentadoria. Em breve adicionaremos calculadoras para atualização de débitos, juros, honorários advocatícios e outras demandas comuns.',
  },
  {
    id: '8',
    category: 'calculadoras',
    question: 'Posso salvar os cálculos realizados?',
    answer:
      'Sim! Todos os cálculos são automaticamente salvos e vinculados ao cliente correspondente. Você pode acessá-los posteriormente através da aba "Cálculos" no perfil do cliente ou na página de Calculadoras.',
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
      'Clique em "Processos" no menu lateral e depois no botão "+ Novo processo". Preencha as informações básicas como número do processo, tipo, vara, partes envolvidas e valor da causa. Você pode adicionar documentos e prazos posteriormente.',
  },
  {
    id: '11',
    category: 'processos',
    question: 'Como faço para acompanhar os prazos?',
    answer:
      'Os prazos são exibidos na página "Prazos" do menu lateral, organizados cronologicamente. Você receberá notificações automáticas 7 dias antes, 3 dias antes e no dia do vencimento. Também pode visualizar os prazos de um processo específico na aba "Prazos" do detalhe do processo.',
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
      'Todos os documentos gerados pela IA ou outras ferramentas são salvos automaticamente na seção "Documentos". Eles ficam organizados por data e tipo, e também podem ser acessados através do perfil do cliente ou processo relacionado.',
  },
  {
    id: '14',
    category: 'documentos',
    question: 'Posso editar documentos gerados pela IA?',
    answer:
      'Sim! Após a geração, você pode editar o documento diretamente na plataforma ou fazer download para editar em seu editor preferido (Word, Google Docs, etc.).',
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
        <h2 className="text-lg font-semibold text-foreground mb-4">Ainda precisa de ajuda?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Nossa equipe de suporte está pronta para ajudá-lo
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <a
            href="mailto:suporte@processa.ai"
            className="flex items-center gap-3 p-4 bg-muted rounded-lg hover:bg-slate-900/5 hover:border-slate-900/10 border border-transparent transition-all hover:shadow-sm"
          >
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Email</p>
              <p className="text-xs text-muted-foreground">suporte@processa.ai</p>
            </div>
          </a>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-muted rounded-lg hover:bg-green-50 hover:border-green-200 border border-transparent transition-all hover:shadow-sm"
          >
            <div className="p-2 bg-green-500/10 rounded-lg">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">WhatsApp</p>
              <p className="text-xs text-muted-foreground">(11) 99999-9999</p>
            </div>
          </a>
          <a
            href="tel:+551133333333"
            className="flex items-center gap-3 p-4 bg-muted rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all hover:shadow-sm"
          >
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Phone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Telefone</p>
              <p className="text-xs text-muted-foreground">(11) 3333-3333</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
