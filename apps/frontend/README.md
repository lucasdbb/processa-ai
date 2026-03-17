# Processa AI - Frontend App

O frontend do **Processa AI** é uma Single Page Application (SPA) moderna, desenvolvida para fornecer uma experiência fluida de gestão de escritórios de advocacia, ferramentas de Inteligência Artificial e um portal para clientes finais.

## 🚀 Tecnologias e Arquitetura

*   **Framework:** React 19 (SPA)
*   **Bundler:** Vite 7
*   **Linguagem:** TypeScript 5.9
*   **Roteamento:** React Router v7 (Client-side routing)
*   **Estilização:** Tailwind CSS 4
*   **Componentes UI:** shadcn/ui (Radix UI primitives)
*   **Gerenciamento de Estado:** Zustand 5
*   **Formulários & Validação:** react-hook-form + Zod
*   **Autenticação e DB:** `@supabase/supabase-js` (Client-side integration)
*   **Analytics:** PostHog
*   **Notificações:** Sonner (Toasts)

O código segue a **Feature-first architecture**, agrupando componentes, hooks, tipos e serviços de API por domínio de negócio (`features/`), facilitando a manutenção e o desenvolvimento de novas funcionalidades.

## 📂 Estrutura de Diretórios

```
apps/frontend/
├── docs/                # Documentações internas do frontend
├── public/              # Ativos estáticos (imagens, ícones)
├── src/
│   ├── components/      # Componentes de UI reutilizáveis (botões, modais, layouts, charts)
│   │   ├── auth/        # Route guards (AuthGuard, AdminGuard, PortalGuard)
│   │   ├── ui/          # Componentes primitivos do shadcn/ui
│   │   └── ...          # Kanbans, formulários genéricos, skeletons
│   ├── features/        # Módulos por domínio de negócio (IA, Autenticação, Calculadoras, Onboarding)
│   ├── hooks/           # Custom hooks globais (useGlobalSearch, useBreadcrumbs)
│   ├── lib/             # Utils, analytics, cliente do Supabase e formatação (máscaras)
│   ├── pages/           # Views/Páginas mapeadas pelas rotas
│   │   ├── admin/       # Dashboard administrativo
│   │   ├── app/         # Área autenticada do usuário (escritório)
│   │   ├── auth/        # Páginas de login/callback
│   │   └── portal/      # Portal read-only para clientes do escritório
│   ├── services/        # Serviços de comunicação com a API backend (fetch/axios)
│   ├── stores/          # Zustand stores globais (Billing, CommandPalette, Sidebar, Créditos)
│   ├── App.tsx          # Ponto de entrada da aplicação React
│   ├── index.css        # Estilos globais Tailwind
│   ├── main.tsx         # Renderização do root e provedores
│   └── router.tsx       # Definição e mapeamento das rotas da SPA
├── index.html           # Template HTML base
├── vite.config.ts       # Configuração do Vite (plugins, aliases)
└── tsconfig.json        # Configurações do TypeScript
```

## ⚙️ Configuração Local

### 1. Pré-requisitos
*   Node.js 20+
*   npm (ou pnpm/yarn)

### 2. Instalação

```bash
cd apps/frontend
npm install
```

### 3. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do `frontend/` (baseado no `.env.example`):

```env
# URL do seu projeto Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
# Chave pública anônima do Supabase
VITE_SUPABASE_ANON_KEY=sua-chave-anon

# URL do Backend API (FastAPI)
VITE_BACKEND_URL=http://localhost:8000

# Chave para chamadas internas protegidas
VITE_INTERNAL_TOKEN=seu-token-interno
```

### 4. Executando o Frontend

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

O app estará disponível em `http://localhost:5173`. O Vite possui Hot Module Replacement (HMR) ativado por padrão.

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento local (porta 5173) |
| `npm run build` | Faz o build de produção da aplicação |
| `npm run preview` | Sobe um servidor para visualizar o build de produção localmente |
| `npm run lint` | Executa o ESLint no código TypeScript/React |

## 🛡️ Roteamento e Proteção (Guards)

A navegação da SPA é gerenciada pelo React Router v7. Existem quatro níveis principais de proteção nas rotas:
1.  **Públicas:** Rotas como `/`, `/blog`, `/sobre`, etc. Não exigem autenticação.
2.  **App (`/app/*`):** Rotas protegidas pelo `<AuthGuard />`. Exigem um usuário logado no Supabase. O layout carrega a Sidebar e o Header.
3.  **Admin (`/admin/*`):** Rotas protegidas pelo `<AdminGuard />`. Exigem a role de `admin` ou `author`.
4.  **Portal (`/portal/*`):** Rotas protegidas pelo `<PortalGuard />`. Permitem que clientes do escritório acessem seus processos.

Além disso, algumas páginas podem ser bloqueadas pelo `<RequirePlan />` dependendo do plano de assinatura (ex: calculadoras premium).
