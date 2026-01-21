import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  DollarSign,
  FileText,
  Clock,
  AlertCircle,
  Edit,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock process data
const mockProcess = {
  id: '1',
  number: '0001234-12.2025.5.02.0001',
  type: 'Reclamação Trabalhista',
  court: '2ª Vara do Trabalho de São Paulo',
  status: 'active',
  client: {
    name: 'João Silva',
    cpf: '123.456.789-00',
  },
  defendant: 'Empresa ABC Ltda',
  cnpj: '12.345.678/0001-90',
  value: 45000,
  filingDate: '10/01/2025',
  lawyer: 'Dr. Carlos Mendes - OAB/SP 123456',
  description:
    'Ação trabalhista pleiteando verbas rescisórias não pagas, incluindo aviso prévio, férias proporcionais, 13º salário e FGTS.',
  deadlines: [
    {
      id: '1',
      title: 'Contestação',
      date: '23/01/2026',
      daysLeft: 3,
      status: 'pending',
      priority: 'high',
    },
    {
      id: '2',
      title: 'Audiência Inicial',
      date: '15/02/2026',
      daysLeft: 26,
      status: 'scheduled',
      priority: 'medium',
    },
  ],
  timeline: [
    {
      id: '1',
      title: 'Processo distribuído',
      description: 'Processo distribuído para a 2ª Vara do Trabalho',
      date: '10/01/2025',
      type: 'info',
    },
    {
      id: '2',
      title: 'Petição inicial recebida',
      description: 'Petição inicial protocolada e recebida pelo juízo',
      date: '10/01/2025',
      type: 'success',
    },
    {
      id: '3',
      title: 'Citação expedida',
      description: 'Expedida citação para a parte ré',
      date: '12/01/2025',
      type: 'info',
    },
    {
      id: '4',
      title: 'Prazo para contestação',
      description: 'Prazo de 15 dias para apresentação de contestação',
      date: '15/01/2025',
      type: 'warning',
    },
  ],
  documents: [
    { id: '1', name: 'Petição Inicial.pdf', date: '10/01/2025', size: '245 KB', type: 'Petição' },
    { id: '2', name: 'Documentos do Cliente.pdf', date: '10/01/2025', size: '890 KB', type: 'Anexo' },
    { id: '3', name: 'Procuração.pdf', date: '10/01/2025', size: '120 KB', type: 'Procuração' },
  ],
}

type Tab = 'resumo' | 'andamentos' | 'prazos' | 'documentos'

export default function ProcessoDetalhePage() {
  const [activeTab, setActiveTab] = useState<Tab>('resumo')

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-500/10 text-green-500',
      archived: 'bg-gray-500/10 text-gray-500',
      suspended: 'bg-yellow-500/10 text-yellow-500',
    }
    const labels = {
      active: 'Ativo',
      archived: 'Arquivado',
      suspended: 'Suspenso',
    }
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium', styles[status as keyof typeof styles])}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'text-destructive',
      medium: 'text-orange-500',
      low: 'text-blue-500',
    }
    return colors[priority as keyof typeof colors] || 'text-muted-foreground'
  }

  const getTimelineIcon = (type: string) => {
    const colors = {
      success: 'bg-green-500',
      warning: 'bg-orange-500',
      info: 'bg-blue-500',
      error: 'bg-destructive',
    }
    return colors[type as keyof typeof colors] || 'bg-gray-500'
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'andamentos', label: 'Andamentos' },
    { id: 'prazos', label: 'Prazos' },
    { id: 'documentos', label: 'Documentos' },
  ]

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/app/processos"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos Processos
      </Link>

      {/* Process Header */}
      <div className="p-6 rounded-lg border border-border bg-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{mockProcess.number}</h1>
              {getStatusBadge(mockProcess.status)}
            </div>
            <p className="text-lg text-muted-foreground">{mockProcess.type}</p>
            <p className="text-sm text-muted-foreground">{mockProcess.court}</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors">
            <Edit className="h-4 w-4" />
            Editar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{mockProcess.client.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Réu:</span>
              <span className="font-medium">{mockProcess.defendant}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Valor da causa:</span>
              <span className="font-medium">{formatCurrency(mockProcess.value)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Distribuição:</span>
              <span className="font-medium">{mockProcess.filingDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-6">
        {activeTab === 'resumo' && (
          <div className="space-y-6">
            {/* Description */}
            <div className="p-6 rounded-lg border border-border bg-card">
              <h3 className="font-semibold text-foreground mb-3">Objeto da ação</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mockProcess.description}
              </p>
            </div>

            {/* Upcoming Deadlines */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">Próximos prazos</h3>
              <div className="space-y-3">
                {mockProcess.deadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className="p-4 rounded-lg border border-border bg-card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className={cn('h-5 w-5', getPriorityColor(deadline.priority))} />
                      <div>
                        <h4 className="font-medium text-foreground">{deadline.title}</h4>
                        <p className="text-sm text-muted-foreground">{deadline.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          deadline.daysLeft <= 3 ? 'text-destructive' : 'text-muted-foreground'
                        )}
                      >
                        {deadline.daysLeft === 0
                          ? 'HOJE'
                          : `${deadline.daysLeft} ${deadline.daysLeft === 1 ? 'dia' : 'dias'}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-sm text-muted-foreground mb-2">Advogado responsável</h4>
                <p className="text-sm font-medium text-foreground">{mockProcess.lawyer}</p>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-sm text-muted-foreground mb-2">CNPJ do réu</h4>
                <p className="text-sm font-medium text-foreground">{mockProcess.cnpj}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'andamentos' && (
          <div className="space-y-4">
            {mockProcess.timeline.map((event, index) => (
              <div key={event.id} className="flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={cn('h-3 w-3 rounded-full', getTimelineIcon(event.type))} />
                  {index < mockProcess.timeline.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-semibold text-foreground">{event.title}</h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {event.date}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'prazos' && (
          <div className="space-y-3">
            {mockProcess.deadlines.map((deadline) => (
              <div
                key={deadline.id}
                className="p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className={cn('h-5 w-5', getPriorityColor(deadline.priority))} />
                    <div>
                      <h3 className="font-semibold text-foreground">{deadline.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">Data: {deadline.date}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: {deadline.status === 'pending' ? 'Pendente' : 'Agendado'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        deadline.daysLeft <= 3 ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {deadline.daysLeft === 0
                        ? 'HOJE'
                        : `${deadline.daysLeft} ${deadline.daysLeft === 1 ? 'dia' : 'dias'}`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'documentos' && (
          <div className="space-y-3">
            {mockProcess.documents.map((doc) => (
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
                        {doc.type} · {doc.date} · {doc.size}
                      </p>
                    </div>
                  </div>
                  <button className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Download className="h-4 w-4" />
                    Baixar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
