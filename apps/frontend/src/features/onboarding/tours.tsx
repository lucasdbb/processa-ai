import type { TourConfig } from './types'

const openDropdownByTrigger = (selector: string) => {
  if (typeof document === 'undefined') return

  const trigger = document.querySelector(selector) as HTMLButtonElement | null
  if (!trigger) return

  if (trigger.getAttribute('aria-expanded') !== 'true') {
    trigger.click()
  }
}

const openUserMenu = () => openDropdownByTrigger('[data-tour="user-menu"]')
const openCreditsMenu = () => openDropdownByTrigger('[data-tour="header-credits"]')
const openNotificationsMenu = () => openDropdownByTrigger('[data-tour="header-notifications"]')

export const TOURS: Record<string, TourConfig> = {
  welcome: {
    id: 'welcome',
    steps: [
      {
        selector: 'body',
        placement: 'center',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Bem-vindo ao Processa AI</h3>
            <p className="text-sm">
              Em menos de dois minutos você vai conhecer o caminho completo: gestão do escritório, IA,
              calculadoras e ações rápidas no header.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="dashboard-link"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Entrada do painel</h3>
            <p className="text-sm">
              Este atalho leva direto para o ambiente de trabalho. Sempre que quiser retomar as missões,
              comece por aqui.
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
        placement: 'center',
        content: (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Missão guiada do painel</h3>
            <p className="text-sm">
              Vamos fazer um giro estratégico pela plataforma para você dominar o fluxo diário.
            </p>
            <p className="text-sm text-muted-foreground">Roteiro completo: gestão, execução e controle.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-dashboard"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Centro de comando</h3>
            <p className="text-sm">O dashboard concentra visão geral, atividade recente e atalhos de produtividade.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-clientes"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Clientes</h3>
            <p className="text-sm">Cadastre sua base e mantenha contexto completo para cada caso.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-processos"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Processos</h3>
            <p className="text-sm">Acompanhe status, andamentos e documentos em um fluxo único por processo.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-servicos"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Serviços</h3>
            <p className="text-sm">Estruture entregas, responsáveis e acompanhamento operacional por serviço.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-calendario"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Calendário e prazos</h3>
            <p className="text-sm">Aqui ficam audiências, lembretes e prazos críticos para execução segura.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-calculadoras"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Calculadoras</h3>
            <p className="text-sm">Simule cenários trabalhistas e previdenciários com memória de cálculo auditável.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-ia"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">IA Jurídica</h3>
            <p className="text-sm">Resumo, análise e geração de peças para acelerar produção com governança.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-materiais"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Materiais</h3>
            <p className="text-sm">Acesse conteúdos de apoio para acelerar estudos, revisão e prática diária.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-configuracoes"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Configurações</h3>
            <p className="text-sm">Personalize preferências da conta, segurança e comportamento da plataforma.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-feedback"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Feedback</h3>
            <p className="text-sm">Compartilhe melhorias de produto para ajudar a evoluir seu fluxo de trabalho.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-ajuda"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Ajuda</h3>
            <p className="text-sm">Acesse suporte e orientações rápidas para resolver dúvidas no fluxo diário.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-search"]',
        placement: 'bottom',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Busca global</h3>
            <p className="text-sm">Use para navegar por clientes, processos e páginas sem sair do contexto atual.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-credits"]',
        placement: 'bottom',
        action: openCreditsMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Saldo de créditos</h3>
            <p className="text-sm">Acompanhe consumo e planeje sua cadência de uso das ferramentas avançadas.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="credits-dropdown"]',
        placement: 'left',
        action: openCreditsMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Detalhamento do saldo</h3>
            <p className="text-sm">Você visualiza assinatura, créditos extras e total disponível em um só lugar.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-theme-toggle"]',
        placement: 'bottom',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Modo claro e escuro</h3>
            <p className="text-sm">Alterne o tema para adaptar leitura e conforto visual durante sua rotina.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-notifications"]',
        placement: 'bottom',
        action: openNotificationsMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Central de notificações</h3>
            <p className="text-sm">Receba alertas operacionais para não perder prazos, atualizações e avisos importantes.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="notifications-dropdown"]',
        placement: 'left',
        action: openNotificationsMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Leitura rápida de alertas</h3>
            <p className="text-sm">Aqui você marca itens como lidos e acessa a página completa de notificações.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="user-menu"]',
        placement: 'bottom',
        action: openUserMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Menu do usuário</h3>
            <p className="text-sm">Este dropdown reúne ações de missão guiada e sessão.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="user-menu-dropdown"]',
        placement: 'left',
        action: openUserMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Área de ações rápidas</h3>
            <p className="text-sm">Aqui você executa tarefas de suporte e navegação sem perder foco no trabalho.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="user-menu-profile"]',
        placement: 'left',
        action: openUserMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Resumo do perfil</h3>
            <p className="text-sm">Confira rapidamente conta ativa e e-mail antes de acionar opções avançadas.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="user-menu-guided-mission"]',
        placement: 'left',
        action: openUserMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Reiniciar missão guiada</h3>
            <p className="text-sm">Sempre que quiser treinar um novo membro da equipe, reinicie o tour por aqui.</p>
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
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Missão IA Jurídica</h3>
            <p className="text-sm">Parta do hub de IA para escolher o fluxo ideal por tipo de demanda.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-search"]',
        placement: 'bottom',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Pesquisa de contexto</h3>
            <p className="text-sm">Use a busca para alternar rapidamente entre páginas de apoio e casos relacionados.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-credits"]',
        placement: 'bottom',
        action: openCreditsMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Métrica de consumo</h3>
            <p className="text-sm">Valide o saldo antes de processamentos longos para evitar interrupções.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-feedback"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Loop de melhoria</h3>
            <p className="text-sm">Envie sugestões sobre respostas da IA para calibrar melhor o produto ao seu uso.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="user-menu-guided-mission"]',
        placement: 'left',
        action: openUserMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Treino recorrente</h3>
            <p className="text-sm">Reative a missão guiada quando quiser revisar o fluxo com novos integrantes.</p>
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
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Missão Calculadoras</h3>
            <p className="text-sm">Comece no hub para decidir entre cálculos trabalhistas e previdenciários.</p>
          </div>
        ),
      },
      {
        selector: '#sidebar-desktop [data-tour="menu-processos"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Contexto processual</h3>
            <p className="text-sm">Conecte os resultados dos cálculos com os processos para tomada de decisão mais rápida.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="header-credits"]',
        placement: 'bottom',
        action: openCreditsMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Controle de execução</h3>
            <p className="text-sm">Monitore o saldo para manter previsibilidade de uso nas rotinas intensas.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="credits-dropdown"]',
        placement: 'left',
        action: openCreditsMenu,
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Leitura financeira rápida</h3>
            <p className="text-sm">Este painel permite checar rapidamente se vale comprar créditos extras.</p>
          </div>
        ),
      },
    ],
  },
  clients: {
    id: 'clients',
    steps: [
      {
        selector: '#sidebar-desktop [data-tour="menu-clientes"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Módulo de clientes</h3>
            <p className="text-sm">Seu CRM jurídico começa aqui, com dados estruturados para cada atendimento.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="new-client-btn"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Novo cliente</h3>
            <p className="text-sm">Cadastre o primeiro cliente para ativar o fluxo completo de gestão.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="search-clients"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Busca inteligente</h3>
            <p className="text-sm">Encontre clientes por nome, documento ou contato sem navegar por listas longas.</p>
          </div>
        ),
      },
    ],
  },
  processes: {
    id: 'processes',
    steps: [
      {
        selector: '#sidebar-desktop [data-tour="menu-processos"]',
        placement: 'right',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Módulo de processos</h3>
            <p className="text-sm">Organize o ciclo de cada caso com rastreabilidade e visão operacional.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="new-process-btn"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Novo processo</h3>
            <p className="text-sm">Registre número, partes e detalhes essenciais para começar o acompanhamento.</p>
          </div>
        ),
      },
      {
        selector: '[data-tour="process-filters"]',
        content: (
          <div className="space-y-2">
            <h3 className="font-semibold">Filtros operacionais</h3>
            <p className="text-sm">Separe ativos, arquivados e prioridades para priorização semanal do escritório.</p>
          </div>
        ),
      },
    ],
  },
}
