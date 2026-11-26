# ANA CRM — WhatsApp Sync

Extensão do Google Chrome (Manifest V3) para sócios e closers sincronizarem a conversa
aberta no **WhatsApp Web** com o **ANA CRM**. Em um clique, ela envia:

- o contato (nome, telefone e e-mail opcional);
- as notas rápidas do atendimento;
- as últimas 50 ou 100 mensagens da conversa.

A interface é um painel lateral com o design system da A Nova Advocacia.

## Como usar

1. Abra `web.whatsapp.com` e clique no ícone do ANA CRM: o painel lateral abre.
2. Na primeira vez, clique na engrenagem e preencha:
   - **URL da API** (padrão `https://crm.anovaadvocacia.ai/api/public/whatsapp-extension-lead`);
   - **Chave de integração**, enviada no cabeçalho `x-extension-key`;
   - **seu e-mail** (sócio ou closer).
3. Abra uma conversa no WhatsApp Web. O painel puxa sozinho o nome, o telefone e as últimas
   50 ou 100 mensagens, e se atualiza quando você troca de conversa ou chega mensagem nova.
4. Confira os dados e escreva o briefing.
5. Clique em **Sincronizar Lead no CRM** (ou `Ctrl/⌘ + Enter`). Quando der certo, aparece o
   link para o card do lead: `https://crm.anovaadvocacia.ai/admin/pipeline?booking=<booking_id>`.

Detalhes do dia a dia:

- **Rascunho por contato:** as notas e os campos que você editar ficam salvos por contato
  enquanto você troca de conversa. Rascunhos sem uso por 30 dias são apagados.
- **Mensagens pendentes:** depois da primeira sincronização, o painel mostra quantas
  mensagens da conversa ainda não foram enviadas ao CRM ("3 mensagens ainda não
  enviadas" ou "tudo já enviado").
- **Atalho:** `Alt+Shift+C` abre o painel. Dá para trocar em `chrome://extensions/shortcuts`.

## Como os dados são lidos

A extensão só lê a página quando o painel pede e **nunca envia, apaga ou marca mensagens**
no WhatsApp.

### Fonte principal: os dados internos do WhatsApp Web

Desde outubro de 2026 o HTML do WhatsApp Web não traz mais o número do contato nem quem
enviou cada mensagem. Por isso, a extensão lê os mesmos dados que o próprio WhatsApp Web
usa para desenhar a tela, pelo script `content/wa-bridge.js`, que roda no contexto da
página (`"world": "MAIN"`). É o caminho usado pelas extensões de CRM e de exportação de
conversas.

| Dado | De onde vem |
|---|---|
| Conversa aberta | `WAWebCollections.Chat.getActive()` |
| Nome | nome salvo na agenda (título da conversa); em contato não salvo, o nome que a pessoa definiu no WhatsApp |
| Telefone | número da conversa (`5511…@c.us`); em contatos com identificador privado (`…@lid`), a correspondência LID → número que o WhatsApp guarda (`WAWebApiContact.getPhoneNumber`, `contact.phoneNumber`) |
| Mensagens | `chat.msgs`, com data e hora exatas (com segundos) e quem enviou |
| Mensagens antigas | carregador do próprio WhatsApp (`WAWebChatLoadMessages`), até o limite, sem rolar a tela |
| Mídia | descrição do tipo: `[Imagem]`, `[Vídeo]`, `[Áudio]`, `[Documento: nome]`, `[Figurinha]`, `[Localização] <link do mapa>`, `[Contato compartilhado: nome]`, `[Enquete] …`, `[Mensagem apagada]`; a legenda vem junto |

Avisos do sistema (criptografia, mudanças de grupo etc.) ficam de fora. Para o telefone, a
ponte só usa o que já está no navegador, sem consultar os servidores do WhatsApp. As
mensagens antigas vêm pelo mesmo carregador que o WhatsApp usa quando você rola a conversa
para cima. Numa conversa em que ele não traz mais nada (por exemplo, histórico antigo que
só está no celular), a leitura automática não insiste; o botão **Buscar mensagens mais
antigas** tenta de novo.

### Reserva: a leitura da tela

Se os dados internos não responderem (o WhatsApp renomeia o código interno entre
versões), a extensão lê a tela, nos dois formatos de HTML:

| Dado | Formato de nov/2026 | Formato antigo |
|---|---|---|
| Conversa aberta | título em `[data-testid="conversation-info-header-chat-title"]` | `#main header` e o item selecionado na lista |
| ID da mensagem | `data-id` só com o ID | `data-id` `true_<conversa>_<ID>` |
| Enviada por você | `[data-testid="tail-out"]`, `[data-testid="msg-meta"][role="button"]`, tiques de entrega; sem nenhum deles, o autor no `data-pre-plain-text` | prefixo `true_`/`false_`, classe `.message-out` |
| Telefone | não aparece na tela: título (contato não salvo) ou **Buscar telefone no perfil do contato** | número da conversa no `data-id` |
| Texto e data | `[data-pre-plain-text]` e `.selectable-text`/`[data-testid="selectable-text"]`; citações ignoradas; "Ler mais" expandido | igual |

Mensagens que o WhatsApp ainda não desenhou (vazias, longe da tela) são ignoradas. Grupos
são reconhecidos pelo nome do autor nas mensagens.

O telefone é normalizado para dígitos com código do país (`5511987654321`). Números
brasileiros sem o 55 recebem o código. Celulares antigos registrados no WhatsApp sem o
nono dígito ganham o 9.

### Limitações conhecidas

- **Contato com identificador privado sem número disponível.** Se o WhatsApp não tiver o
  número de um contato com LID (por exemplo, quem nunca compartilhou o número com você),
  o painel avisa e oferece buscar no perfil do contato; se não houver, digite-o.
- **Grupos, canais e listas de transmissão não são sincronizados.** O CRM recebe um lead
  por contato.
- **Troca de conversa durante a leitura.** A leitura é cancelada e refeita na conversa
  nova, sem misturar as duas.
- **Rascunho na leitura da tela.** Sem os dados internos e sem o número na tela, o painel
  só conhece o nome do contato, e dois contatos podem ter o mesmo nome. Por isso, nesse
  modo, o rascunho não é restaurado ao voltar para a conversa. Ele volta quando a mesma
  conversa é reconhecida pelo número.
- **Histórico antigo.** A extensão só alcança o que o WhatsApp Web consegue carregar (ele
  pode pedir para buscar mensagens antigas no celular).
- **Mudanças no WhatsApp.** Os nomes internos ficam em `content/wa-bridge.js` e os
  seletores da tela em `SEL`, no início de `content/wa-capture.js`. Em Configurações, o
  botão **Copiar diagnóstico** mostra o que ainda é reconhecido (módulos internos, formatos
  e contagens), sem nomes, números nem texto das conversas.

## Contrato da API

`POST <URL da API>` com os cabeçalhos `Content-Type: application/json`,
`x-extension-key: <chave>` e `Idempotency-Key: <uuid>` (o mesmo valor numa nova tentativa
automática do mesmo envio):

```json
{
  "partner_email": "lucas@bragaadv.com.br",
  "contact": { "name": "Nome do Lead", "phone": "5511999999999", "email": "lead@email.com" },
  "notes": "Cliente interessado no plano Starter...",
  "messages": [
    { "external_id": "3EB0A1B2C3D4E5F6", "from_me": false, "text": "Olá...", "timestamp": "2026-11-26T14:10:00.000Z" }
  ]
}
```

- `contact.email` é **omitido** quando vazio (em vez de `""` ou `null`).
- `notes` vai sempre como texto (pode ser `""`).
- `messages` vem em ordem cronológica, com `timestamp` em UTC.
- O mesmo `external_id` volta em reenvios. O servidor deve fazer o *upsert* do lead pelo
  telefone e ignorar mensagens com `external_id` já gravado.

Resposta esperada (2xx), em JSON:

- o ID do card em `booking_id`; também são aceitos `bookingId`, `data.booking_id`,
  `booking.id` e `lead.booking_id`;
- opcionalmente, os contadores `messages_inserted` e `messages_skipped`, que aparecem no
  resultado.

Erros tratados com mensagem própria:

| Status | O que o painel mostra |
|---|---|
| 401 / 403 | chave recusada |
| 404 | URL errada |
| 400 / 422 | o motivo enviado pelo servidor em `error`, `message` ou `detail` |
| 429 | aguardar e tentar de novo |
| 5xx | erro interno do CRM |

Em falha de conexão ou resposta 502/503, a extensão **reenvia uma vez sozinha** após 1,5 s,
com a mesma `Idempotency-Key`. Em tempo esgotado (30 s) ou 504 ela **não** reenvia, porque o
CRM pode ter processado o pedido. Nesse caso, o sócio confere o card antes de tentar de novo.
Se o servidor guardar as `notes` a cada envio, recomenda-se usar a `Idempotency-Key` para
não duplicá-las.

O servidor **não precisa de CORS**: a extensão declara permissão de host para
`crm.anovaadvocacia.ai`. Se a URL da API apontar para outro domínio (homologação, por
exemplo), o Chrome pede autorização ao salvar as configurações.

## Instalação (modo desenvolvedor)

1. `chrome://extensions` → ative o **Modo do desenvolvedor**.
2. **Carregar sem compactação** → selecione esta pasta. Deixe-a num local permanente,
   fora de pastas gerenciadas pelo iCloud.
3. Se o WhatsApp Web já estava aberto, não precisa recarregá-lo: a extensão se injeta
   sozinha.

O campo `key` do manifest fixa o ID da extensão em `ocojkokdndcicajefhkigaimonmicmek`
em qualquer computador. Assim, as configurações acompanham a conta do Chrome. Remova o
campo antes de publicar na Chrome Web Store, porque a loja recusa itens novos com ele.

## Privacidade e segurança

- Nada sai do navegador sem o clique em **Sincronizar**, e os dados vão só para a URL
  configurada.
- A chave de integração fica no `chrome.storage.sync` da conta Chrome do usuário. Use uma
  chave por pessoa, para poder revogar uma sem afetar as outras.
- As conversas contêm dados pessoais dos leads (LGPD). O escritório precisa de base legal
  para tratá-los no CRM, e o acesso ao CRM deve seguir a mesma regra de sigilo do
  atendimento.
- A ponte com os dados internos só lê. Ela não envia mensagens, não automatiza ações no
  WhatsApp e não faz requisições aos servidores dele. Ainda assim, ler o código interno do
  WhatsApp Web não é um recurso oficial: o WhatsApp pode mudá-lo a qualquer momento.

## Testes

```bash
# funções de interpretação (Node 20+)
node --test 'apps/chrome-extension-ana-crm/tests/*.test.mjs'

# ponta a ponta no Chrome, com WhatsApp Web simulado e API do CRM interceptada
npm i playwright   # em qualquer pasta
export CHROME_PATH=/caminho/do/chrome NODE_PATH=/pasta/node_modules
node apps/chrome-extension-ana-crm/tests/e2e/run-e2e-2026.cjs  # WhatsApp de nov/2026
node apps/chrome-extension-ana-crm/tests/e2e/run-e2e.cjs       # HTML antigo, sem dados internos
```

A simulação (`tests/mock/whatsapp.html`) reproduz as duas gerações do WhatsApp Web:

- dados internos (`?store=1`): módulos, IDs no formato `$1` de jul/2026 (ou `_serialized`,
  ou só o texto do ID), carregador de mensagens antigas nas formas nova e antiga,
  correspondência LID → número e avisos do sistema;
- HTML de nov/2026 (`?dom=2026`) e o antigo;
- contato salvo, não salvo, com LID (número na correspondência, só no contato ou em lugar
  nenhum), grupo, canal e número sem o nono dígito;
- emojis, respostas citadas, áudio, imagem, documento, localização, mensagem apagada,
  "Ler mais", várias linhas, divisórias de data e mensagens antigas.

## Estrutura

```
apps/chrome-extension-ana-crm/
├── manifest.json        # MV3: side panel, storage, activeTab, scripting, hosts
├── background.js        # abre o painel pelo ícone; injeta a captura em abas já abertas
├── content/
│   ├── wa-bridge.js     # ponte com os dados internos do WhatsApp (mundo da página)
│   ├── wa-parse.js      # funções puras: data-id, telefone, datas, tipos de mensagem
│   └── wa-capture.js    # captura: dados internos primeiro, tela como reserva (SEL)
├── sidepanel.html/.css/.js  # painel: contato, notas, mensagens, envio, configurações
├── base.css             # design system A Nova Advocacia
├── fonts/ icons/
└── tests/               # unitários, simulação do WhatsApp e ponta a ponta
```

## Histórico de versões

- **1.2.0**
  - **Correção principal:** no WhatsApp Web atual (out/2026 em diante), a extensão não
    achava o telefone nem as mensagens, porque o HTML deixou de trazer o número do contato
    e quem enviou cada mensagem. Agora ela lê os dados internos do WhatsApp Web e puxa
    sozinha:
    - o telefone, inclusive de contatos com identificador privado (LID);
    - as últimas 50 ou 100 mensagens, sem rolar a tela, com data e hora exatas.
  - A leitura da tela continua como reserva e entende o HTML novo:
    - ID "puro" no `data-id` e direção pelas marcas `data-testid`;
    - mensagens vazias fora da tela são ignoradas;
    - grupos são reconhecidos pelo autor.
  - Contato não salvo vem com o nome que a pessoa definiu no WhatsApp.
  - Documento com o nome do arquivo, localização com link do mapa, contatos, enquetes e
    legendas de foto e vídeo.
  - O painel se atualiza sozinho quando chega mensagem nova.
  - Corrigido: uma troca de conversa logo depois de abrir o painel podia não ser percebida.
  - Leitura da tela (reserva):
    - dois contatos com o mesmo nome não se misturam (telefone, notas e mensagens);
    - uma falha passageira dos dados internos não apaga mais as notas do contato;
    - um contato com nome só de emojis não tem as mensagens dele marcadas como suas.
  - O carregador de mensagens antigas espera o do próprio WhatsApp e não insiste em
    conversas sem mais histórico.
  - A ponte antiga é sempre substituída ao atualizar a extensão.
  - Diagnóstico inclui a ponte (módulos encontrados, formato dos IDs), ainda sem nomes,
    números ou textos.
- **1.1.0**
  - **Correções**
    - trocar de conversa durante a busca de mensagens antigas não mistura mais as duas conversas;
    - trocas de conversa durante uma leitura entram na fila em vez de serem perdidas;
    - telefones e horários cercados por marcas invisíveis de direção de texto são reconhecidos;
    - a duração de um áudio não é mais confundida com o horário;
    - a busca no perfil só aceita o número que está junto do nome do contato e fecha apenas
      esse painel (nunca envia Escape, que fecharia a conversa);
    - um envio lento não grava mais o telefone do lead anterior na conversa aberta depois;
      ler a conversa fica bloqueado durante o envio;
    - áudios e imagens no topo da conversa, sem divisória de data acima, recebem o dia certo
      e nunca um horário no futuro;
    - "Por que esta mensagem foi apagada?" não é mais tratada como mensagem apagada;
    - uma linha que só começa com um dia da semana não vira divisória de data;
    - telefones com prefixo de operadora (`0 21 11 …`) são normalizados;
    - o diagnóstico mascara nomes em qualquer alfabeto, e as marcas invisíveis saem do texto
      das mensagens;
    - canais e listas de transmissão bloqueados, como os grupos;
    - a captura volta a funcionar depois de atualizar a extensão sem recarregar o WhatsApp;
    - o tempo limite cobre também a leitura da resposta.
  - **Melhorias**
    - mensagens ainda não enviadas;
    - reenvio automático em falhas temporárias, com `Idempotency-Key`;
    - `Ctrl/⌘ + Enter` e atalho `Alt+Shift+C`;
    - "Enviando como" com o e-mail do sócio;
    - rascunho guarda só os campos editados e expira em 30 dias;
    - a busca de mensagens antigas devolve você ao ponto em que estava lendo.
- **1.0.0**: versão inicial.
