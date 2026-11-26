# Cofre de Conhecimento — A Nova Advocacia

Extensão do Google Chrome (Manifest V3) para **não perder respostas valiosas de IA**:
selecione o trecho no ChatGPT, Claude, Gemini (ou qualquer site), salve com um gesto
e reencontre tudo depois — em Markdown, com o prompt que gerou a resposta vinculado.

É a extensão-irmã da **Biblioteca de Prompts** (`apps/chrome-extension`): uma guarda o
que você *envia* para a IA, a outra guarda o que a IA *devolve*.

## Como funciona

1. Na página da IA, **selecione o texto** da resposta que quer guardar.
2. Clique com o botão direito → **"Salvar no Cofre de Conhecimento"**
   (ou use o atalho `Ctrl+Shift+S` / `⌘+Shift+S`).
3. O side panel abre com tudo pré-preenchido:
   - **Conteúdo convertido para Markdown** (negrito, listas, código, tabelas preservados);
   - **Prompt detectado automaticamente** no ChatGPT, Claude e Gemini (o turno do
     usuário imediatamente anterior à seleção) — editável, ou colado manualmente;
   - **Origem** (qual IA + link da conversa) e título sugerido.
4. Ajuste título/categoria e salve.

## Funcionalidades

- Captura por seleção em **qualquer site**, sem permissão fixa de host (usa `activeTab`,
  concedida apenas no momento do gesto — menu de contexto ou atalho)
- Conversão HTML → **Markdown** própria (headings, negrito/itálico, listas aninhadas,
  blocos de código com linguagem, citações, tabelas, links)
- **Prompt vinculado** à resposta (badge "com prompt" na lista, seção própria no detalhe)
- Busca por texto (inclui o conteúdo e o prompt), filtros por **origem** (ChatGPT/Claude/
  Gemini...), **categoria** e **favoritos**
- Vista de **detalhe** com cópia da resposta e do prompt separadamente + link para a
  conversa original
- **Exportar em Markdown** (um único `.md` organizado) e **backup/restauração em JSON**
- `unlimitedStorage`: pensado para respostas longas salvas com frequência

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` (Chrome 116+) e ative o **Modo do desenvolvedor**.
2. **Carregar sem compactação** → selecione esta pasta (`apps/chrome-extension-cofre`).
3. Selecione um texto em qualquer página → botão direito → "Salvar no Cofre de Conhecimento".

> O atalho de teclado pode ser ajustado em `chrome://extensions/shortcuts`.

## Estrutura

```
apps/chrome-extension-cofre/
├── manifest.json     # MV3: side_panel, contextMenus, scripting, activeTab, unlimitedStorage
├── background.js     # Menu de contexto + atalho → injeta capture.js → abre o panel
├── capture.js        # Roda na página: seleção → Markdown + detecção do prompt/origem
├── sidepanel.html    # UI: lista, formulário de captura/edição e detalhe
├── sidepanel.css     # Design system A Nova Advocacia
├── sidepanel.js      # CRUD, filtros, captura pendente, export MD/JSON
├── fonts/            # Sora e Inter empacotadas
└── icons/            # Ícones com gradiente neural invertido + glifo de marcador
```

## Detalhes técnicos

- A captura pendente trafega por `chrome.storage.session` (efêmera); os itens salvos
  ficam em `chrome.storage.local` (nada sai da sua máquina).
- A detecção do prompt usa seletores por site (`[data-message-author-role="user"]` no
  ChatGPT etc.) com *fallback* silencioso: se o site mudar o layout, o campo apenas
  vem vazio para preenchimento manual — a captura nunca quebra.
- Páginas restritas do Chrome (`chrome://`, Web Store) não aceitam injeção; a extensão
  avisa com um toast em vez de falhar.
