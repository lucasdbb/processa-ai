# Páginas Salvas — A Nova Advocacia

Extensão do Google Chrome (Manifest V3) para **parar de se perder em abas**: clique no
ícone, salve a página atual (título, link e uma nota opcional) e a aba continua aberta.
Depois encontre tudo numa página própria, com busca, filtros e lido/não lido,
**sincronizado entre seus computadores** pela sua conta Google.

Terceira extensão da família, com o mesmo design system da A Nova Advocacia:

| Extensão | Pasta | Para quê |
|---|---|---|
| Biblioteca de Prompts | `apps/chrome-extension` | o que você envia para a IA |
| Cofre de Conhecimento | `apps/chrome-extension-cofre` | o que a IA responde |
| Páginas Salvas | `apps/chrome-extension-paginas` | páginas da web para voltar depois |

## Como usar

1. Em qualquer site, clique no ícone da extensão (ou `Alt+Shift+S`).
2. Confira o título, adicione categoria e nota se quiser e clique em **Salvar página**
   (ou só aperte `Enter`). A aba continua aberta.
3. Para ver tudo: **Ver páginas salvas** no rodapé do popup, ou botão direito no ícone
   da extensão → **Ver páginas salvas**.

Se a página já estiver salva, o popup avisa e o botão vira **Atualizar página**.

## Funcionalidades da lista

- Agrupada por data (Hoje, Ontem, Últimos 7 dias, Este mês, meses anteriores)
- Busca por título, site, link, nota e categoria (atalho `/`)
- Filtros **Todas / Não lidas / Lidas** e por categoria; ordenação por data ou A–Z
- Abrir uma página pela lista a marca como lida automaticamente
- Editar título, categoria e nota direto na linha; excluir com confirmação
- **Excluir lidas** em lote, para liberar espaço de sincronização
- Exportar/importar JSON (backup ou migração)
- Atualiza ao vivo quando você salva algo em outra janela ou em outro computador

## Sincronização entre computadores

As páginas ficam em `chrome.storage.sync`, que o Chrome sincroniza entre os
computadores conectados na **mesma conta Google**, com a sincronização ligada e
**Extensões** marcado em *Configurações → Você e o Google → Sincronização*. A extensão
precisa estar instalada em cada computador.

O Chrome limita esse armazenamento a **100 KB** (cerca de 400 a 500 páginas, dependendo
do tamanho das notas). A extensão trata o limite assim:

- Cada página é uma chave separada, então dois computadores não sobrescrevem a lista um
  do outro.
- O medidor no topo da lista mostra quanto do espaço já foi usado.
- Quando o espaço acaba, a página é salva **só neste computador** (selo amarelo na lista),
  então nada se perde. Ao excluir páginas, as que ficaram de fora voltam a sincronizar
  sozinhas.

> O Chrome sincroniza os dados **pelo ID da extensão**. Normalmente, uma extensão
> carregada em modo desenvolvedor ganha um ID diferente em cada computador (o ID vem do
> caminho da pasta), e aí nada sincronizaria. Por isso o manifest traz o campo `key`,
> que fixa o ID em `mopgokmilkjmehcefifgibmiaejkjhaf` em qualquer máquina.
>
> Ao publicar na Chrome Web Store, **remova o campo `key`** antes de gerar o ZIP (a loja
> recusa itens novos com ele). A versão da loja terá outro ID; para levar as páginas
> salvas, use **Exportar** na versão atual e **Importar** na da loja.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` (Chrome 116 ou superior) e ative o **Modo do desenvolvedor**.
2. **Carregar sem compactação** → selecione esta pasta (deixe-a num local permanente,
   fora de pastas gerenciadas pelo iCloud).
3. Fixe o ícone na barra pelo ícone de quebra-cabeça.

O atalho de teclado pode ser trocado em `chrome://extensions/shortcuts`.

## Permissões

Nenhuma permissão gera aviso na instalação:

- `activeTab`: lê o título e o link **só da aba ativa e só quando você clica** no ícone
- `storage`: guarda as páginas (sync e local)
- `favicon`: mostra o ícone dos sites na lista, a partir do cache do Chrome
- `contextMenus`: item "Ver páginas salvas" no botão direito do ícone

## Estrutura

```
apps/chrome-extension-paginas/
├── manifest.json   # MV3: popup na action, atalho, permissões sem aviso
├── background.js   # Menu de contexto do ícone → abre a lista
├── store.js        # Armazenamento: uma chave por página, sync com transbordo local
├── popup.html/css/js  # Salvar/atualizar a página atual
├── pages.html/css/js  # Lista completa
├── base.css        # Tokens e componentes do design system A Nova Advocacia
├── fonts/          # Sora e Inter empacotadas
└── icons/          # Ícones com o gradiente neural
```
