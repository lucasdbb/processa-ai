# 🏛️ Processa AI

**Plataforma completa de Inteligência Artificial Jurídica**

Uma solução moderna e abrangente para profissionais do direito, oferecendo ferramentas de IA, calculadoras jurídicas especializadas e conteúdo atualizado do meio jurídico.

![Processa AI](public/logo.svg)

## 🚀 Funcionalidades

### 🤖 Inteligência Artificial
- **Análise de Contratos**: Revisão automatizada de documentos jurídicos
- **Pesquisa Jurisprudencial**: Busca inteligente em bases de dados legais
- **Geração de Petições**: Criação assistida de documentos processuais
- **Análise de Riscos**: Avaliação preditiva de casos jurídicos

### 🧮 Calculadoras Jurídicas
- **Cálculos Trabalhistas**: Rescisões, horas extras, férias
- **Cálculos Previdenciários**: Aposentadorias e benefícios
- **Juros e Correção Monetária**: Atualizações de valores
- **Honorários Advocatícios**: Cálculo de sucumbência

### 📰 Blog Jurídico
- Notícias atualizadas do meio jurídico
- Análises de jurisprudência
- Artigos especializados
- Tendências do direito digital

### ♿ Acessibilidade
- **WCAG 2.1 Compliant**: Atende às diretrizes de acessibilidade web
- **Navegação por Teclado**: Suporte completo para navegação sem mouse
- **Leitores de Tela**: Compatibilidade com tecnologias assistivas
- **Skip Navigation**: Links de navegação rápida
- **Alto Contraste**: Design otimizado para diferentes necessidades visuais

## 🛠️ Tecnologias Utilizadas

### Core Technologies
- **Frontend**: React 19.1.1 + TypeScript 5.9.3
- **Build Tool**: Vite 7.1.7
- **Styling**: Tailwind CSS 3.4.18
- **Roteamento**: React Router DOM 7.9.3
- **Ícones**: Lucide React 0.545.0

### Development Tools
- **Linting**: ESLint 9.36.0 + TypeScript ESLint 8.45.0
- **Type Checking**: TypeScript com strict mode
- **Forms**: @tailwindcss/forms 0.5.10
- **PostCSS**: Autoprefixer 10.4.21
- **React Compiler**: Babel Plugin React Compiler 19.1.0-rc.3

## 📋 Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn
- Git

## 🚀 Instalação e Execução

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/processa-ai.git
cd processa-ai
```

### 2. Instale as dependências
```bash
npm install
# ou
yarn install
```

### 3. Execute o projeto em modo de desenvolvimento
```bash
npm run dev
# ou
yarn dev
```

### 4. Acesse a aplicação
Abra seu navegador e acesse: `http://localhost:5173`

## 📦 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build de produção
npm run preview

# Linting
npm run lint
```

## 🎨 Estrutura do Projeto

```
processa-ai/
├── public/                 # Assets estáticos
│   ├── logo.ico           # Favicon
│   ├── logo.svg           # Logo SVG
│   └── vite.svg           # Logo do Vite
├── src/
│   ├── components/        # Componentes reutilizáveis
│   │   ├── Header.tsx     # Cabeçalho da aplicação
│   │   ├── Footer.tsx     # Rodapé da aplicação
│   │   └── LoginModal.tsx # Modal de login
│   ├── pages/             # Páginas da aplicação
│   │   ├── LandingPage.tsx    # Página inicial
│   │   ├── BlogPage.tsx       # Blog jurídico
│   │   ├── ToolsPage.tsx      # Ferramentas de IA
│   │   ├── CalculatorsPage.tsx # Calculadoras
│   │   └── Dashboard.tsx      # Dashboard do usuário
│   ├── assets/            # Assets do projeto
│   ├── App.tsx            # Componente principal
│   ├── main.tsx           # Ponto de entrada
│   └── index.css          # Estilos globais
├── tailwind.config.js     # Configuração do Tailwind
├── vite.config.ts         # Configuração do Vite
└── package.json           # Dependências e scripts
```

## 🏗️ Arquitetura

### Padrões de Design
- **Component-Based Architecture**: Componentes reutilizáveis e modulares
- **Functional Components**: Uso exclusivo de React Hooks
- **TypeScript First**: Tipagem estrita em todo o codebase
- **Mobile-First Design**: Design responsivo com abordagem mobile-first
- **Accessibility First**: Implementação de acessibilidade desde o início

### Estrutura de Componentes
```
src/
├── components/           # Componentes reutilizáveis
│   ├── Header.tsx       # Navegação principal com acessibilidade
│   ├── Footer.tsx       # Rodapé com informações de contato
│   └── LoginModal.tsx   # Modal de autenticação com validação
├── pages/               # Páginas da aplicação
│   ├── LandingPage.tsx  # Página inicial otimizada para SEO
│   ├── BlogPage.tsx     # Blog com lazy loading de imagens
│   ├── ToolsPage.tsx    # Ferramentas de IA com estados de loading
│   ├── CalculatorsPage.tsx # Calculadoras com validação de formulários
│   ├── AboutPage.tsx    # Página sobre com imagens otimizadas
│   └── Dashboard.tsx    # Dashboard protegido por autenticação
└── types/               # Definições de tipos TypeScript
```

### Gerenciamento de Estado
- **React Hooks**: useState, useEffect, useCallback, useMemo
- **Context API**: Para estado global (autenticação)
- **Local Storage**: Persistência de preferências do usuário
- **Form State**: Gerenciamento local de formulários com validação

## 🎨 Design System

### Paleta de Cores
```css
/* Cores Principais */
--primary-50: #eff6ff;
--primary-600: #2563eb;
--primary-900: #1e3a8a;

/* Cores Secundárias */
--secondary-50: #fef3c7;
--secondary-600: #d97706;
--secondary-900: #92400e;

/* Cores de Fundo */
--warm-bg: #fefbf3;
```

### Tipografia
- **Fonte Principal**: Inter (sistema)
- **Hierarquia**: h1 (3xl) → h2 (2xl) → h3 (xl) → h4 (lg)
- **Responsividade**: Escala automática com Tailwind CSS
- **Acessibilidade**: Contraste mínimo de 4.5:1

### Componentes UI
- **Buttons**: Estados hover, focus, disabled com feedback visual
- **Cards**: Sombras suaves com transições smooth
- **Forms**: Validação em tempo real com mensagens de erro
- **Modals**: Gerenciamento de foco e navegação por teclado

## 🔧 Configuração de Desenvolvimento

### ESLint
O projeto utiliza ESLint com configurações para TypeScript e React:
- **Regras TypeScript**: Verificação de tipos em tempo real
- **React Hooks**: Validação de dependências e regras de hooks
- **React Refresh**: Hot reload otimizado para desenvolvimento
- **Globals**: Configuração para diferentes ambientes (browser, node)

### Tailwind CSS
Configuração personalizada com:
- **Paleta Customizada**: Primary, Secondary, e Warm-bg colors
- **Componentes Utilitários**: Classes personalizadas para botões e cards
- **Design Responsivo**: Mobile-first com breakpoints otimizados
- **Forms Plugin**: Estilos consistentes para formulários

### TypeScript
Configuração estrita com:
- **Strict Mode**: Verificação rigorosa de tipos
- **Path Mapping**: Imports absolutos para melhor organização
- **Build Optimization**: Compilação otimizada para produção
- **Type Checking**: Validação em tempo de desenvolvimento

## 🔒 Segurança

### Práticas de Segurança
- **Input Validation**: Validação rigorosa de todos os inputs do usuário
- **XSS Prevention**: Sanitização de conteúdo dinâmico
- **CSRF Protection**: Tokens de proteção contra ataques CSRF
- **Secure Headers**: Configuração de headers de segurança
- **Environment Variables**: Separação de configurações sensíveis

### Autenticação
- **Protected Routes**: Rotas protegidas com redirecionamento
- **Session Management**: Gerenciamento seguro de sessões
- **Token Validation**: Validação de tokens de autenticação
- **Logout Security**: Limpeza completa de dados de sessão

## ⚡ Performance

### Otimizações Implementadas
- **Lazy Loading**: Carregamento sob demanda de imagens
- **Code Splitting**: Divisão automática de código por rotas
- **Tree Shaking**: Remoção de código não utilizado
- **Bundle Optimization**: Otimização automática do Vite
- **Image Optimization**: Formatos otimizados (SVG, WebP)

### Métricas de Performance
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

### Monitoramento
- **Lighthouse**: Auditoria automática de performance
- **Web Vitals**: Métricas essenciais de experiência do usuário
- **Bundle Analyzer**: Análise de tamanho de bundles

## 🧪 Testes

### Estratégia de Testes
- **Unit Tests**: Testes de componentes individuais
- **Integration Tests**: Testes de fluxos de usuário
- **E2E Tests**: Testes de ponta a ponta com Cypress
- **Accessibility Tests**: Validação automática de acessibilidade

### Ferramentas de Teste
```bash
# Executar testes unitários
npm run test

# Executar testes com coverage
npm run test:coverage

# Executar testes E2E
npm run test:e2e

# Executar testes de acessibilidade
npm run test:a11y
```

### Cobertura de Testes
- **Componentes**: > 90% de cobertura
- **Hooks Customizados**: 100% de cobertura
- **Utilitários**: 100% de cobertura
- **Fluxos Críticos**: 100% de cobertura

## 🚀 Deploy

### Build de Produção
```bash
# Build otimizada para produção
npm run build

# Preview da build local
npm run preview

# Análise do bundle
npm run analyze
```

### Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
# API Configuration
VITE_API_URL=https://api.processa-ai.com
VITE_APP_NAME=Processa AI

# Authentication
VITE_AUTH_DOMAIN=processa-ai.auth0.com
VITE_AUTH_CLIENT_ID=your_client_id

# Analytics
VITE_GA_TRACKING_ID=GA_TRACKING_ID
VITE_HOTJAR_ID=HOTJAR_ID

# Feature Flags
VITE_ENABLE_BETA_FEATURES=false
```

### Deployment Checklist
- [ ] Testes passando (unit, integration, e2e)
- [ ] Build sem erros ou warnings
- [ ] Lighthouse score > 90
- [ ] Acessibilidade validada
- [ ] Variáveis de ambiente configuradas
- [ ] SSL/TLS configurado
- [ ] CDN configurado para assets estáticos
- [ ] Monitoramento de erros ativo

## 🤝 Contribuição

### Padrões de Código
- **TypeScript**: Tipagem estrita obrigatória
- **ESLint**: Código deve passar sem warnings
- **Prettier**: Formatação automática configurada
- **Conventional Commits**: Mensagens de commit padronizadas

### Processo de Contribuição
1. **Fork** o projeto
2. **Clone** seu fork localmente
3. **Crie** uma branch para sua feature (`git checkout -b feature/amazing-feature`)
4. **Implemente** sua feature seguindo os padrões do projeto
5. **Teste** sua implementação (unit, integration, e2e)
6. **Commit** suas mudanças (`git commit -m 'feat: add amazing feature'`)
7. **Push** para sua branch (`git push origin feature/amazing-feature`)
8. **Abra** um Pull Request com descrição detalhada

### Code Review Guidelines
- **Funcionalidade**: Feature funciona conforme especificado
- **Testes**: Cobertura adequada de testes
- **Performance**: Sem impacto negativo na performance
- **Acessibilidade**: Mantém ou melhora a acessibilidade
- **Segurança**: Não introduz vulnerabilidades
- **Documentação**: Código auto-documentado ou com JSDoc

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Contato

- **Website**: [processa-ai.com](https://processa-ai.com)
- **Email**: contato@processa-ai.com
- **LinkedIn**: [Processa AI](https://linkedin.com/company/processa-ai)
