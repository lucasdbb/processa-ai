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
3. Abra uma conversa no WhatsApp Web. O painel lê sozinho o nome, o telefone e as mensagens
   visíveis, e se atualiza quando você troca de conversa.
4. Confira os dados e escreva o briefing. Se quiser mais histórico, clique em **Buscar
   mensagens mais antigas**: a extensão rola a conversa até juntar o limite (50 ou 100) e
   volta para o fim.
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

A extensão só lê a página quando o painel pede e **nunca envia mensagens** no WhatsApp.

| Dado | Fonte principal | Reservas |
|---|---|---|
| Conversa aberta | `#main` e o título no `header` | item selecionado na lista de conversas |
| Telefone | número da conversa no `data-id` das mensagens (`5511…@c.us`) | título da conversa (contato não salvo) e botão **Buscar telefone no perfil do contato** |
| ID da mensagem | ID do WhatsApp no `data-id` (`true_<conversa>_<ID>`) | hash SHA-256 de conversa + direção + horário + texto |
| Enviada por você | prefixo `true_`/`false_` do `data-id` | classe `.message-out` |
| Texto | `.selectable-text` dentro de `[data-pre-plain-text]`; emojis viram caractere; o trecho citado em respostas é ignorado; "Ler mais" é expandido | descrição do tipo: `[Áudio]`, `[Imagem]`, `[Vídeo]`, `[Documento: nome]`, `[Figurinha]`, `[Localização]`, `[Mensagem apagada]` |
| Data e hora | `data-pre-plain-text` (`[14:10, 26/11/2026] Nome: `), com dia/mês ou mês/dia deduzido da própria conversa | hora no balão + divisória de data (`HOJE`, `ONTEM`, dia da semana, data) |

O telefone é normalizado para dígitos com código do país (`5511987654321`). Números
brasileiros sem o 55 recebem o código. Celulares antigos registrados no WhatsApp sem o
nono dígito ganham o 9.

Limitações conhecidas:

- **Identificador privado (LID).** Em alguns contatos, o WhatsApp esconde o número na
  conversa (`…@lid`). O painel avisa e oferece buscar o número no perfil do contato;
  se não houver, digite-o.
- **Grupos, canais e listas de transmissão não são sincronizados.** O CRM recebe um lead
  por contato.
- **Troca de conversa durante a leitura.** Se você trocar de conversa enquanto a extensão
  busca mensagens antigas, a leitura é cancelada e refeita na conversa nova, sem misturar
  as duas.
- **"Ler mais".** Mensagens longas são expandidas no próprio WhatsApp Web para capturar o
  texto completo.
- **Mudanças no WhatsApp.** O WhatsApp Web muda o HTML sem aviso. Todos os seletores
  ficam em `SEL`, no início de `content/wa-capture.js`. Em Configurações, o botão **Copiar
  diagnóstico** mostra quais partes da página ainda são reconhecidas, sem incluir o texto
  das conversas.

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

- o ID do card em `booking_id`; também são aceitos `bookingId`, `data.booking_id` e
  `booking.id`;
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

## Testes

```bash
# funções de interpretação (Node 20+)
node --test 'apps/chrome-extension-ana-crm/tests/*.test.mjs'

# ponta a ponta no Chrome, com WhatsApp Web simulado e API do CRM interceptada
npm i playwright   # em qualquer pasta
CHROME_PATH=/caminho/do/chrome NODE_PATH=/pasta/node_modules \
  node apps/chrome-extension-ana-crm/tests/e2e/run-e2e.cjs
```

A simulação (`tests/mock/whatsapp.html`) reproduz a estrutura que a extensão lê e cobre:

- contato salvo, não salvo, com LID, grupo e número sem o nono dígito;
- emojis, respostas citadas, áudio, imagem, mensagem apagada, "Ler mais" e várias linhas;
- divisórias de data e carregamento de mensagens antigas ao rolar.

## Estrutura

```
apps/chrome-extension-ana-crm/
├── manifest.json        # MV3: side panel, storage, activeTab, scripting, hosts
├── background.js        # abre o painel pelo ícone; injeta a captura em abas já abertas
├── content/
│   ├── wa-parse.js      # funções puras: data-id, telefone, datas, IDs estáveis
│   └── wa-capture.js    # leitura do DOM do WhatsApp Web (seletores em SEL)
├── sidepanel.html/.css/.js  # painel: contato, notas, mensagens, envio, configurações
├── base.css             # design system A Nova Advocacia
├── fonts/ icons/
└── tests/               # unitários, simulação do WhatsApp e ponta a ponta
```

## Histórico de versões

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
