import type { TourConfig } from './types'

export const TOURS: Record<string, TourConfig> = {
  welcome: {
    id: 'welcome',
    steps: [
      {
        selector: 'body',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Bem-vindo ao Processa AI! 🎉</h3>
            <p className="text-sm">
              Obrigado por se cadastrar! Vamos começar sua jornada.
            </p>
            <p className="text-sm text-muted-foreground">
              Clique em <strong>"Próximo"</strong> para ver onde acessar seu painel.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="dashboard-link"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Acesse seu Painel 🏠</h3>
            <p className="text-sm">
              Clique aqui em <strong>"Meu Painel"</strong> para acessar todas as funcionalidades da plataforma.
            </p>
            <p className="text-sm text-muted-foreground">
              Você também pode clicar no logo no topo para voltar ao dashboard a qualquer momento.
            </p>
          </div>
        ),
      },
    ],
  },
  dashboard: {
    id: 'dashboard',
    steps: [
      {
        selector: 'body',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Bem-vindo ao Processa AI! 🎉</h3>
            <p className="text-sm">
              Vamos fazer um tour rápido pelas principais funcionalidades da plataforma.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="stats"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Estatísticas</h3>
            <p className="text-sm">
              Acompanhe aqui um resumo dos seus clientes, processos ativos e cálculos realizados.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="deadlines"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Prazos Próximos</h3>
            <p className="text-sm">
              Fique atento aos próximos prazos para não perder nenhum vencimento importante.
            </p>
          </div>
        ),
      },
      {
        selector: 'body',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Navegação 🧭</h3>
            <p className="text-sm">
              Use o <strong>menu lateral esquerdo</strong> para acessar todas as funcionalidades:
            </p>
            <ul className="text-sm space-y-1.5 ml-2">
              <li>📋 <strong>Clientes</strong> - Gerencie seus clientes</li>
              <li>⚖️ <strong>Processos</strong> - Acompanhe processos e prazos</li>
              <li>🧮 <strong>Calculadoras</strong> - Ferramentas de cálculo</li>
              <li>🤖 <strong>IA Jurídica</strong> - Análise com inteligência artificial</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Pronto para começar! Explore a plataforma. 🚀
            </p>
          </div>
        ),
      },
    ],
  },
  clients: {
    id: 'clients',
    steps: [
      {
        selector: '[data-tour="new-client-btn"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Novo Cliente</h3>
            <p className="text-sm">
              Clique aqui para adicionar um novo cliente ao seu cadastro.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="search-clients"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Busca</h3>
            <p className="text-sm">
              Use a busca para encontrar clientes rapidamente por nome, email ou documento.
            </p>
          </div>
        ),
      },
    ],
  },
  processes: {
    id: 'processes',
    steps: [
      {
        selector: '[data-tour="new-process-btn"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Novo Processo</h3>
            <p className="text-sm">
              Cadastre novos processos e vincule-os aos seus clientes.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="process-filters"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Filtros</h3>
            <p className="text-sm">
              Filtre processos por status: todos, ativos ou arquivados.
            </p>
          </div>
        ),
      },
    ],
  },
}
