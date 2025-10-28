# Processa AI - Monorepo

Uma plataforma moderna para cálculos trabalhistas e assistência com IA, desenvolvida com React, TypeScript, Tailwind CSS e Supabase em arquitetura de monorepo.

## 🏗️ Estrutura do Monorepo

```
processa-ai/
├── apps/
│   ├── web/           # Frontend React + Vite
│   └── api/           # Backend Vercel Functions
├── packages/
│   ├── types/         # Tipos TypeScript compartilhados
│   ├── ui/            # Componentes UI reutilizáveis
│   └── utils/         # Utilitários compartilhados
├── tools/
│   ├── eslint-config/ # Configuração ESLint compartilhada
│   └── tsconfig/      # Configurações TypeScript base
└── package.json       # Workspace raiz
```

## 🚀 Funcionalidades

- **Calculadoras Trabalhistas**: Cálculos precisos de rescisão e aposentadoria
- **Assistente IA**: Geração de textos e análises com inteligência artificial
- **Interface Moderna**: Design responsivo e intuitivo
- **Autenticação Segura**: Sistema completo de login e registro via API
- **Blog Integrado**: Artigos e conteúdo educativo
- **API Backend**: Vercel Functions para autenticação e lógica de negócio

## 🛠️ Tecnologias

### Frontend (apps/web)
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Roteamento**: React Router DOM
- **Ícones**: Lucide React

### Backend (apps/api)
- **Runtime**: Vercel Functions
- **Database**: Supabase
- **Auth**: Supabase Auth
- **Language**: TypeScript

### Packages
- **types**: Tipos TypeScript compartilhados
- **ui**: Componentes React reutilizáveis
- **utils**: Funções utilitárias

## 📦 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/processa-ai.git
cd processa-ai
```

2. Instale as dependências de todos os workspaces:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Inicie o desenvolvimento:
```bash
# Frontend
npm run web:dev

# API (em outro terminal)
npm run api:dev

# Ou ambos
npm run dev
```

## 🔧 Scripts Disponíveis

### Scripts Globais
- `npm run dev` - Inicia o frontend
- `npm run build` - Build de todos os projetos
- `npm run lint` - Lint de todos os projetos
- `npm run type-check` - Verificação de tipos
- `npm run clean` - Limpa builds

### Scripts Específicos
- `npm run web:dev` - Frontend em modo desenvolvimento
- `npm run web:build` - Build do frontend
- `npm run api:dev` - API em modo desenvolvimento
- `npm run api:build` - Build da API
- `npm run types:build` - Build dos tipos

## 🌐 Desenvolvimento

### Frontend (localhost:3000)
```bash
cd apps/web
npm run dev
```

### API (Vercel Dev)
```bash
cd apps/api
npm run dev
```

## 📱 Aplicações

### Frontend (apps/web)
- **Home**: Página inicial com apresentação da plataforma
- **Calculadoras**: Ferramentas de cálculo trabalhista
- **Ferramentas**: Assistente IA para geração de textos
- **Blog**: Artigos e conteúdo educativo
- **Sobre**: Informações sobre a plataforma

### API (apps/api)
- **POST /api/auth/login** - Autenticação de usuário
- **POST /api/auth/register** - Registro de novo usuário
- **POST /api/auth/logout** - Logout do usuário
- **POST /api/auth/refresh** - Renovação de token
- **GET /api/auth/me** - Informações do usuário

## 📦 Packages

### @processa-ai/types
Tipos TypeScript compartilhados entre frontend e backend:
- Tipos de autenticação
- Tipos de calculadoras
- Tipos de blog
- Tipos comuns (API responses, estados, etc.)

### @processa-ai/ui (Futuro)
Componentes React reutilizáveis:
- Botões, inputs, modais
- Layouts e grids
- Componentes de formulário

### @processa-ai/utils (Futuro)
Funções utilitárias compartilhadas:
- Validações
- Formatações
- Helpers de data/hora

## 🔐 Autenticação

Sistema completo de autenticação com Supabase:
- **Login/Registro**: Via API Vercel Functions
- **JWT Tokens**: Access e refresh tokens
- **Middleware**: Proteção de rotas da API
- **CORS**: Configurado para frontend

## 🚀 Deploy

### Frontend (Vercel)
```bash
cd apps/web
vercel --prod
```

### API (Vercel Functions)
```bash
cd apps/api
vercel --prod
```

### Variáveis de Ambiente
Configure no Vercel:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL`

## 🔧 Configuração do Workspace

O projeto usa npm workspaces para gerenciar dependências:

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

## 📊 Calculadoras

### Rescisão Trabalhista
- Cálculo de verbas rescisórias
- Diferentes tipos de rescisão
- Relatório detalhado

### Aposentadoria
- Cálculo de tempo de contribuição
- Diferentes modalidades
- Projeções futuras

## 🤖 Assistente IA

- Geração de textos jurídicos
- Análise de documentos
- Sugestões personalizadas
- Interface conversacional

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
