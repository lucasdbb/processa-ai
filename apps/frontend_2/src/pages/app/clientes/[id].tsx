import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, FileText, Calculator, FolderKanban, DollarSign, StickyNote, Edit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// Mock client data
const mockClient = {
  id: '1',
  name: 'João Silva',
  cpf: '123.456.789-00',
  phone: '(11) 99999-0000',
  email: 'joao@email.com',
  address: 'Rua das Flores, 123 - São Paulo, SP',
  registeredAt: '15/03/2024',
  avatar: null,
  processes: [
    {
      id: '1',
      number: '0001234-12.2025.5.02.0001',
      type: 'Reclamação Trabalhista',
      status: 'active',
      value: 45000,
      nextDeadline: '3 dias',
    },
    {
      id: '2',
      number: '0009876-54.2024.5.02.0001',
      type: 'Recurso Ordinário',
      status: 'active',
      value: 32000,
      nextDeadline: '10 dias',
    },
  ],
  calculations: [
    {
      id: '1',
      type: 'Rescisão Trabalhista',
      date: '15/01/2026',
      value: 15000,
    },
    {
      id: '2',
      type: 'Rescisão Trabalhista',
      date: '10/01/2026',
      value: 12500,
    },
    {
      id: '3',
      type: 'Aposentadoria',
      date: '05/01/2026',
      value: null,
    },
  ],
  documents: [
    { id: '1', name: 'Petição Inicial.pdf', date: '15/01/2026', size: '245 KB' },
    { id: '2', name: 'Procuração.pdf', date: '10/01/2026', size: '120 KB' },
    { id: '3', name: 'Documentos Pessoais.pdf', date: '05/01/2026', size: '890 KB' },
  ],
  fees: {
    total: 8500,
    paid: 5000,
    pending: 3500,
  },
  notes: [
    { id: '1', content: 'Cliente prefere contato por WhatsApp', date: '15/01/2026' },
    { id: '2', content: 'Agendar reunião para próxima semana', date: '10/01/2026' },
  ],
}

type Tab = 'resumo' | 'processos' | 'calculos' | 'documentos' | 'honorarios' | 'notas'

export default function ClienteDetalhePage() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState<Tab>('resumo')

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const tabs: { id: Tab; label: string; icon: typeof FolderKanban }[] = [
    { id: 'resumo', label: 'Resumo', icon: FileText },
    { id: 'processos', label: 'Processos', icon: FolderKanban },
    { id: 'calculos', label: 'Cálculos', icon: Calculator },
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'honorarios', label: 'Honorários', icon: DollarSign },
    { id: 'notas', label: 'Notas', icon: StickyNote },
  ]

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/app/clientes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos Clientes
      </Link>

      {/* Client Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-6 rounded-lg border border-border bg-card">
        <div className="flex items-start gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={mockClient.avatar || undefined} alt={mockClient.name} />
            <AvatarFallback className="bg-slate-900 text-white text-xl">
              {getInitials(mockClient.name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{mockClient.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>CPF: {mockClient.cpf}</span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {mockClient.phone}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {mockClient.email}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Cliente desde: {mockClient.registeredAt}
            </p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Edit className="h-4 w-4" />
          Editar
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-6">
        {activeTab === 'resumo' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-2">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Processos</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">{mockClient.processes.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Ativos</p>
            </div>
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-2">
                <Calculator className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Cálculos</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">{mockClient.calculations.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Salvos</p>
            </div>
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Documentos</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">{mockClient.documents.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Anexados</p>
            </div>
          </div>
        )}

        {activeTab === 'processos' && (
          <div className="space-y-3">
            {mockClient.processes.map((process) => (
              <div
                key={process.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{process.number}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{process.type}</p>
                    <p className="text-sm text-muted-foreground">Valor: {formatCurrency(process.value)}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex px-2 py-1 rounded text-xs bg-green-500/10 text-green-500">
                      Ativo
                    </span>
                    <p className="text-xs text-muted-foreground mt-2">
                      Próximo prazo: {process.nextDeadline}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'calculos' && (
          <div className="space-y-3">
            {mockClient.calculations.map((calc) => (
              <div
                key={calc.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{calc.type}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{calc.date}</p>
                  </div>
                  {calc.value && (
                    <p className="font-semibold text-foreground">{formatCurrency(calc.value)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'documentos' && (
          <div className="space-y-3">
            {mockClient.documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium text-foreground">{doc.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.date} · {doc.size}
                      </p>
                    </div>
                  </div>
                  <button className="text-sm text-primary hover:underline">Baixar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'honorarios' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-sm text-muted-foreground mb-2">Total</h3>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(mockClient.fees.total)}
                </p>
              </div>
              <div className="p-6 rounded-lg border border-green-500/20 bg-green-500/10">
                <h3 className="text-sm text-green-600 dark:text-green-400 mb-2">Pago</h3>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(mockClient.fees.paid)}
                </p>
              </div>
              <div className="p-6 rounded-lg border border-orange-500/20 bg-orange-500/10">
                <h3 className="text-sm text-orange-600 dark:text-orange-400 mb-2">Pendente</h3>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(mockClient.fees.pending)}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notas' && (
          <div className="space-y-3">
            {mockClient.notes.map((note) => (
              <div
                key={note.id}
                className="p-4 rounded-lg border border-border bg-card"
              >
                <p className="text-sm text-foreground">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-2">{note.date}</p>
              </div>
            ))}
            <button className="w-full p-4 rounded-lg border border-dashed border-border hover:bg-accent transition-colors text-sm text-muted-foreground">
              + Adicionar nova nota
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
