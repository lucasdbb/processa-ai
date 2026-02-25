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
        selector: '#sidebar-desktop [data-tour="menu-dashboard"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Dashboard 📊</h3>
            <p className="text-sm">
              Aqui você tem uma visão geral do seu escritório, estatísticas e prazos.
            </p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-clientes"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Clientes 👥</h3>
            <p className="text-sm">
              Cadastre e gerencie seus clientes de forma organizada.
            </p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-processos"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Processos ⚖️</h3>
            <p className="text-sm">
              Acompanhe seus processos, andamentos e prazos.
            </p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-servicos"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Serviços 💼</h3>
            <p className="text-sm">
              Gerencie os serviços prestados e contratos.
            </p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-calendario"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Calendário 📅</h3>
            <p className="text-sm">
              Visualize seus prazos e compromissos em uma agenda integrada.
            </p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-calculadoras"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Calculadoras 🧮</h3>
            <p className="text-sm">
              Ferramentas para realizar cálculos jurídicos complexos em instantes.
            </p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-ia"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">IA Jurídica 🤖</h3>
            <p className="text-sm">
              Utilize nossa Inteligência Artificial para analisar documentos e peças.
            </p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-documentos"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Documentos 📄</h3>
            <p className="text-sm">
              Acesse e gerencie seus documentos gerados e armazenados.
            </p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-materiais"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Materiais 📚</h3>
            <p className="text-sm">
              Consulte materiais de apoio e modelos.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-credits"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Seus Créditos 🪙</h3>
            <p className="text-sm">
              Acompanhe aqui seu saldo de créditos para utilizar as ferramentas de IA.
            </p>
          </div>
        ),
      },
      {
        selector: 'body',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Tudo pronto! 🚀</h3>
            <p className="text-sm">
              Agora você já conhece a plataforma. Aproveite para explorar!
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
