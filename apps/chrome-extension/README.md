# Biblioteca de Prompts — A Nova Advocacia

Extensão do Google Chrome (Manifest V3) que funciona como uma biblioteca pessoal de prompts:
cadastre, organize e copie seus prompts para usar em qualquer LLM (ChatGPT, Claude, Gemini...).

A interface abre no **side panel** do Chrome, ao lado da página da LLM, com o visual do
design system oficial da A Nova Advocacia (dark, Electric Cyan + Aurora Purple, Sora/Inter).

## Funcionalidades

- **Cadastro de prompts** com título, categoria e conteúdo
- **Busca** por texto em título, conteúdo e categoria
- **Categorias** com filtros em chips (geradas automaticamente a partir dos prompts)
- **Favoritos** — prompts com estrela aparecem no topo da lista
- **Copiar com 1 clique** para a área de transferência (funciona com qualquer LLM)
- **Exportar/importar JSON** — backup e migração entre computadores
- Dados salvos localmente via `chrome.storage.local` (nada sai da sua máquina)

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` no Chrome (versão 114 ou superior).
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** (Load unpacked).
4. Selecione esta pasta (`apps/chrome-extension`).
5. Clique no ícone da extensão na barra de ferramentas — o side panel abre com a biblioteca.

## Estrutura

```
apps/chrome-extension/
├── manifest.json     # Manifest V3: side_panel + permissões (sidePanel, storage)
├── background.js     # Service worker: abre o panel ao clicar no ícone
├── sidepanel.html    # UI da biblioteca
├── sidepanel.css     # Design system A Nova Advocacia (tokens, glass, glow)
├── sidepanel.js      # CRUD, busca, filtros, cópia, export/import
├── fonts/            # Sora e Inter (variáveis, empacotadas — MV3 proíbe CDN)
└── icons/            # Ícones 16/32/48/128 com o gradiente neural
```

## Backup dos dados

Os prompts ficam em `chrome.storage.local` (apenas neste perfil do Chrome).
Use **Exportar** no rodapé para gerar um `prompts-nova-advocacia-AAAA-MM-DD.json`
e **Importar** para restaurar ou mesclar (prompts com `id` já existente são ignorados).

## Publicação na Chrome Web Store (futuro)

O manifest já contém os campos exigidos pela loja (`description`, `icons`).
Para enviar: compacte o conteúdo desta pasta em um ZIP (com o `manifest.json` na raiz
do ZIP) e faça o upload no Developer Dashboard.
