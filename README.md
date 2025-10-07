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

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Roteamento**: React Router DOM
- **Ícones**: Lucide React
- **Linting**: ESLint + TypeScript ESLint

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

## 🎨 Design System

### Cores Principais
- **Navy**: `#1e3a8a` - Cor principal (confiança, profissionalismo)
- **Gold**: `#f59e0b` - Cor de destaque (prestígio, qualidade)
- **White**: `#ffffff` - Cor neutra (clareza, simplicidade)

### Tipografia
- **Fonte Principal**: Inter (sistema)
- **Tamanhos**: Escala responsiva com Tailwind CSS

## 🔧 Configuração de Desenvolvimento

### ESLint
O projeto utiliza ESLint com configurações para TypeScript e React:
- Regras recomendadas do TypeScript
- Regras específicas para React
- Verificação de tipos em tempo real

### Tailwind CSS
Configuração personalizada com:
- Paleta de cores customizada (Navy, Gold)
- Componentes utilitários personalizados
- Design responsivo mobile-first

## 🚀 Deploy

### Build de Produção
```bash
npm run build
```

### Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
VITE_API_URL=https://api.processa-ai.com
VITE_APP_NAME=Processa AI
```

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Contato

- **Website**: [processa-ai.com](https://processa-ai.com)
- **Email**: contato@processa-ai.com
- **LinkedIn**: [Processa AI](https://linkedin.com/company/processa-ai)
