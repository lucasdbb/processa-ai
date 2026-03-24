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
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Missão de reconhecimento</h3>
            <p className="text-sm">
              Objetivo: entender em 1 minuto onde ficam suas funções centrais.
            </p>
            <p className="text-xs text-muted-foreground">Passo 1 de 4</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-ia"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold">IA Jurídica 🤖</h3>
            <p className="text-sm">
              Aqui ficam as ferramentas para análise de documentos e geração de peças com IA.
            </p>
            <p className="text-xs text-muted-foreground">Passo 2 de 4</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-calendario"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold">Gestão do Escritório 📅</h3>
            <p className="text-sm">
              Gerencie clientes, processos, prazos e documentos no menu lateral. Nunca mais perca um prazo.
            </p>
            <p className="text-xs text-muted-foreground">Passo 3 de 4</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-credits"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold">Seus Créditos 🪙</h3>
            <p className="text-sm">
              Acompanhe aqui seu saldo de créditos para utilizar as ferramentas de IA e calculadoras.
            </p>
            <p className="text-xs text-muted-foreground">Passo 4 de 4</p>
          </div>
        ),
      },
    ],
  },
  'ai-tools': {
    id: 'ai-tools',
    steps: [
      {
        selector: '#sidebar-desktop [data-tour="menu-ia"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Missão IA Jurídica</h3>
            <p className="text-sm">Comece abrindo o hub de IA para escolher a ferramenta ideal para o seu caso.</p>
            <p className="text-xs text-muted-foreground">Passo 1 de 3</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-ia"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold">Ação recomendada</h3>
            <p className="text-sm">Execute uma tarefa prática: resumo processual, scanner ou criação de peça.</p>
            <p className="text-xs text-muted-foreground">Passo 2 de 3</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-credits"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold">Conquista</h3>
            <p className="text-sm">Acompanhe seus créditos para manter ritmo de uso e evolução nas próximas missões.</p>
            <p className="text-xs text-muted-foreground">Passo 3 de 3</p>
          </div>
        ),
      },
    ],
  },
  calculators: {
    id: 'calculators',
    steps: [
      {
        selector: '#sidebar-desktop [data-tour="menu-calculadoras"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Missão Calculadoras</h3>
            <p className="text-sm">Abra o hub de calculadoras para acessar os fluxos trabalhista e previdenciário.</p>
            <p className="text-xs text-muted-foreground">Passo 1 de 3</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-calculadoras"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold">Ação recomendada</h3>
            <p className="text-sm">Rode uma simulação completa e valide os campos de entrada e resultado.</p>
            <p className="text-xs text-muted-foreground">Passo 2 de 3</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-credits"]',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold">Conquista</h3>
            <p className="text-sm">Revise créditos disponíveis para planejar uso contínuo das funcionalidades avançadas.</p>
            <p className="text-xs text-muted-foreground">Passo 3 de 3</p>
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
