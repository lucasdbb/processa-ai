// ANA CRM — leitura da conversa aberta no WhatsApp Web (content script).
//
// Só lê a página quando o painel pede (ANA_CAPTURE) e nunca envia mensagens.
//
// Fonte principal: os dados internos do WhatsApp, pela ponte content/wa-bridge.js
// (mundo MAIN da página). Ela traz o número real do contato, inclusive com LID, e
// as mensagens com data e hora exatas, sem rolar a tela.
//
// Reserva: a leitura da tela. Todos os seletores ficam em SEL; quando o WhatsApp
// mudar o layout, é aqui que se ajusta. Desde out/2026 o data-id das mensagens traz
// só o ID (sem a conversa e sem a direção) e as classes .message-in/.message-out
// sumiram; os dois formatos são aceitos. ANA_DIAGNOSE conta o que cada parte
// encontra, sem expor o conteúdo das conversas.
(() => {
  'use strict';

  // Ao atualizar a extensão, o script antigo fica órfão no mesmo mundo isolado.
  // A trava só bloqueia uma nova injeção se a instância anterior ainda estiver viva.
  const RUNTIME = chrome.runtime;
  const previous = globalThis.__anaCrmCapture;
  if (previous && typeof previous.isAlive === 'function' && previous.isAlive()) return;
  if (previous && typeof previous.stop === 'function') previous.stop();

  const W = globalThis.AnaWa;

  const SEL = {
    main: '#main',
    header: '#main header',
    headerTitle: '[data-testid="conversation-info-header-chat-title"]',
    headerText: 'span[dir="auto"], span[title]',
    selectedChat: '#pane-side [aria-selected="true"]',
    dataId: '[data-id]',
    row: '[role="row"]',
    prePlain: '[data-pre-plain-text]',
    selectableText: '.selectable-text, [data-testid="selectable-text"]',
    quoted: '[data-testid="quoted-message"], .quoted-mention, [aria-label*="citada" i], [aria-label*="quoted" i], [aria-label*="citado" i]',
    outgoing: '.message-out',
    incoming: '.message-in',
    // marcas que só as SUAS mensagens têm: rabicho da primeira de uma sequência,
    // status de entrega clicável e os tiques de enviada/entregue/lida
    outgoingMarks: '[data-testid="tail-out"], [data-testid="msg-meta"][role="button"], [data-icon^="msg-check"], [data-icon^="msg-dblcheck"], [data-icon="msg-time"]',
    groupAuthor: '[data-testid="author"]',
    media: 'img, video, audio, canvas, [data-icon], a[href]',
    drawerClose: '[aria-label="Fechar"], [aria-label="Close"], [aria-label="Cerrar"], [data-icon="x"], [data-icon="close"], [data-icon="x-alt"]',
  };

  const STATUS_RE = /^(online|digitando|typing|escribiendo|gravando|recording|grabando|visto por [uú]ltimo|last seen|[uú]lt\. vez|clique |click |toque |tap |haz clic|dados do contato|contact info)/i;
  const READ_MORE_RE = /^(ler mais|read more|leer m[aá]s|mostrar mais)$/i;
  const READ_MORE_SEL = '[role="button"], button, [class*="read-more" i]';
  const TIME_ONLY_RE = /^\s*\d{1,2}[:.]\d{2}(\s*[ap]\.?\s?m\.?)?\s*$/i;
  const TRAILING_TIME_RE = /\s*\d{1,2}[:.]\d{2}(\s*[ap]\.?\s?m\.?)?\s*$/i;
  const PROFILE_PHONE_RE = /^\+\d[\d\s().\-]{7,}$/;
  const MAX_OLDER_ROUNDS = 15;
  const OLDER_WAIT_MS = 900;
  const UNSUPPORTED = { group: 'group', newsletter: 'channel', broadcast: 'broadcast' };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isMessageDataId = (value) => Boolean(W.messageIdFromDataId(value));
  const pageLocale = () => document.documentElement.lang || navigator.language || '';
  const chatChanged = () => ({ ok: false, code: 'chat-changed', error: 'A conversa mudou durante a leitura.' });

  // ─── Ponte com os dados internos do WhatsApp (content/wa-bridge.js) ───

  const BRIDGE_IN = 'ana-crm:cs';
  const BRIDGE_OUT = 'ana-crm:page';
  const pending = new Map();
  let bridgeActive = '';
  let bridgeTick = 0;

  function onBridgeMessage(event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== BRIDGE_OUT) return;
    if (data.event === 'active-chat') {
      bridgeActive = String(data.id || '');
      return;
    }
    if (data.event === 'messages') {
      bridgeTick++;
      return;
    }
    const waiting = pending.get(data.reqId);
    if (!waiting) return;
    pending.delete(data.reqId);
    clearTimeout(waiting.timer);
    if (data.ok) waiting.resolve(data.result);
    else waiting.reject(new Error(data.error || 'erro na ponte'));
  }
  window.addEventListener('message', onBridgeMessage);

  const bridgePresent = () => document.documentElement.hasAttribute('data-ana-crm-bridge');

  function bridgeCall(type, payload, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const reqId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        pending.delete(reqId);
        reject(new Error('a ponte não respondeu'));
      }, timeoutMs);
      pending.set(reqId, { resolve, reject, timer });
      window.postMessage({ source: BRIDGE_IN, reqId, type, payload }, location.origin);
    });
  }

  // ─── Cabeçalho da conversa ───

  function headerTitleElement() {
    const header = document.querySelector(SEL.header);
    if (!header) return null;
    const marked = header.querySelector(SEL.headerTitle);
    if (marked && W.stripMarks(marked.getAttribute('title') || marked.textContent).trim()) return marked;
    for (const el of header.querySelectorAll(SEL.headerText)) {
      const text = W.stripMarks(el.getAttribute('title') || el.textContent).trim();
      if (text && !STATUS_RE.test(text)) return el;
    }
    return null;
  }

  function headerTitle() {
    const el = headerTitleElement();
    if (el) return W.stripMarks(el.getAttribute('title') || el.textContent).trim();
    const selected = document.querySelector(SEL.selectedChat);
    const span = selected && selected.querySelector('span[title]');
    return span ? W.stripMarks(span.getAttribute('title')).trim() : '';
  }

  // Cada #main recebe um número: trocar de conversa recria o elemento, o que distingue
  // duas conversas de mesmo nome quando a primeira ainda não tem mensagens.
  const viewIds = new WeakMap();
  let nextViewId = 1;
  function viewToken() {
    const main = document.querySelector(SEL.main);
    if (!main) return 0;
    if (!viewIds.has(main)) viewIds.set(main, nextViewId++);
    return viewIds.get(main);
  }

  // Conversa aberta agora: jid da última mensagem visível (só no formato antigo do
  // data-id) + título do cabeçalho
  function currentChatIdentity() {
    const nodes = messageNodes();
    const id = nodes.length ? W.parseDataId(nodes[nodes.length - 1].getAttribute('data-id')) : null;
    return { jid: id ? id.chatJid : '', title: headerTitle() };
  }

  function loginOrEmpty() {
    return document.querySelector('canvas, [data-ref]') ? 'login' : 'sem-conversa';
  }

  // ─── Leitura pelos dados internos ───

  // A ponte já respondeu com uma conversa nesta página. Uma falha isolada depois disso
  // ganha uma nova tentativa rápida antes de cair para a leitura da tela, porque a tela
  // identifica a conversa de outro jeito (pelo título) e o painel a trataria como outra.
  let storeWorked = false;

  async function storeSnapshot(limit, loadOlder) {
    const maxMs = loadOlder ? 20000 : 6000;
    try {
      return await bridgeCall('snapshot', { limit, maxMs, force: loadOlder }, maxMs + 10000);
    } catch {
      if (!storeWorked) return null;
    }
    try {
      return await bridgeCall('snapshot', { limit, maxMs: 0 }, 6000);
    } catch {
      return null;
    }
  }

  async function captureFromStore({ limit, loadOlder }) {
    if (!bridgePresent()) return null;
    const startTitle = headerTitle();
    let snap = await storeSnapshot(limit, loadOlder);
    if (!snap || !snap.store) return null;
    if (snap.changed) return chatChanged();
    if (!snap.chat && storeWorked && document.querySelector(SEL.main)) {
      // conversa trocando bem nesta hora: espera um instante e pergunta de novo
      await sleep(400);
      snap = await storeSnapshot(limit, false);
      if (!snap || !snap.store) return null;
      if (snap.changed) return chatChanged();
    }
    if (!snap.chat) {
      // sem conversa ativa nos dados internos, mas com conversa na tela: a tela decide
      if (document.querySelector(SEL.main)) return null;
      return { ok: true, chat: null, messages: [], reason: loginOrEmpty(), source: 'store' };
    }
    storeWorked = true;
    if (startTitle && headerTitle() && headerTitle() !== startTitle) return chatChanged();

    const c = snap.chat;
    const list = [];
    const occurrences = new Map();
    for (let i = 0; i < (snap.messages || []).length; i++) {
      const m = snap.messages[i];
      const text = W.storeMessageText(m);
      if (text == null || !m.t) continue;
      const parsed = W.parseDataId(m.ser);
      const fromMe = typeof m.fromMe === 'boolean' ? m.fromMe : Boolean(parsed && parsed.fromMe);
      const iso = new Date(m.t * 1000).toISOString();
      let externalId = m.id || (parsed && parsed.messageId) || '';
      if (!externalId) {
        const base = `${fromMe ? 1 : 0}|${iso}|${text}`;
        const n = occurrences.get(base) || 0;
        occurrences.set(base, n + 1);
        externalId = await W.stableId([c.id, String(fromMe), iso, text, String(n)]);
      }
      list.push({ external_id: externalId, from_me: fromMe, text, timestamp: iso, approx: false, pos: i });
    }
    const unique = new Map();
    for (const m of list) unique.set(m.external_id, m);
    const all = [...unique.values()].sort((a, b) =>
      a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.pos - b.pos);
    const kept = all.slice(-limit);

    const kind = W.jidKind(c.id) !== 'unknown' ? W.jidKind(c.id) : (c.kind || 'unknown');
    const title = W.stripMarks(c.title || headerTitle()).trim();
    let phone = c.phone ? W.normalizePhone(c.phone, { international: true }) : '';
    let phoneSource = phone ? (c.phoneFrom === 'lid' ? 'wa' : 'jid') : '';
    if (!phone && !UNSUPPORTED[kind] && W.looksLikePhone(title)) {
      phone = W.normalizePhone(title);
      phoneSource = 'header';
    }
    // contato não salvo: o título é o número; o nome é o que a pessoa definiu no WhatsApp
    const name = W.looksLikePhone(title) ? W.stripMarks(c.pushname || c.verifiedName || '').trim() : title;

    return {
      ok: true,
      source: 'store',
      chat: {
        key: c.id || (title ? `title:${title}` : ''),
        title,
        name,
        phone,
        phoneSource,
        jidKind: kind,
        isGroup: kind === 'group',
        isLid: kind === 'lid',
        unsupported: UNSUPPORTED[kind] || null,
        viewToken: viewToken(),
      },
      messages: kept.map(({ external_id, from_me, text, timestamp, approx }) => ({ external_id, from_me, text, timestamp, approx })),
      stats: {
        found: all.length,
        loaded: snap.loaded,
        complete: Boolean(snap.complete),
        older: snap.load,
      },
    };
  }

  // ─── Leitura da tela: mensagens ───

  function messageNodes() {
    const main = document.querySelector(SEL.main);
    if (!main) return [];
    return [...main.querySelectorAll(SEL.dataId)].filter((el) => {
      if (!isMessageDataId(el.getAttribute('data-id'))) return false;
      const outer = el.parentElement && el.parentElement.closest(SEL.dataId);
      return !(outer && main.contains(outer) && isMessageDataId(outer.getAttribute('data-id')));
    });
  }

  // Mensagem ainda não desenhada (o WhatsApp deixa vazias as que estão longe da tela)
  function isPlaceholder(el) {
    return !el.querySelector(SEL.prePlain) && !el.querySelector(SEL.selectableText)
      && !el.querySelector(SEL.media) && !W.stripMarks(el.textContent).trim();
  }

  function textFrom(node) {
    if (!node) return '';
    let out = '';
    const walk = (parent) => {
      for (const child of parent.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.nodeValue;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === 'IMG') out += child.getAttribute('alt') || '';
          else if (child.tagName === 'BR') out += '\n';
          else if (child.matches(SEL.quoted)) continue;
          else {
            if (/^(DIV|P|LI)$/.test(child.tagName) && out && !out.endsWith('\n')) out += '\n';
            walk(child);
          }
        }
      }
    };
    walk(node);
    return W.stripMarks(out)
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Hora exibida no canto do balão. É o último texto em formato de hora: antes dele
  // pode haver a duração de um áudio ("0:42"), que não é horário.
  function metaTime(el) {
    const times = [...el.querySelectorAll('span')]
      .map((s) => W.stripMarks(s.textContent).trim())
      .filter((t) => TIME_ONLY_RE.test(t));
    return times.length ? times[times.length - 1] : '';
  }

  function documentName(el) {
    const titled = [...el.querySelectorAll('[title]')].map((e) => e.getAttribute('title'));
    return titled.find((t) => /\.[a-z0-9]{2,5}$/i.test(t || '')) || '';
  }

  // Mensagens sem texto: descreve o tipo em vez de enviar vazio
  function placeholderFor(el) {
    const lines = W.stripMarks(el.innerText || el.textContent)
      .split('\n')
      .map((s) => s.replace(TRAILING_TIME_RE, '').trim())
      .filter((s) => s && !TIME_ONLY_RE.test(s));
    if (lines.some((line) => W.isDeletedText(W.fold(line)))) return '[Mensagem apagada]';
    const has = (selector) => Boolean(el.querySelector(selector));
    if (has('[data-icon*="sticker" i], img[alt*="figurinha" i], img[alt*="sticker" i]')) return '[Figurinha]';
    if (has('audio, [data-icon*="audio" i], [data-icon*="ptt" i], [aria-label*="áudio" i], [aria-label*="audio" i], [aria-label*="mensagem de voz" i], [aria-label*="voice" i]')) return '[Áudio]';
    if (has('video, [data-icon*="video" i], [data-icon*="media-play" i]')) return '[Vídeo]';
    if (has('[data-icon*="document" i], [data-icon*="doc-" i], [data-icon*="pdf" i]')) {
      const name = documentName(el);
      return name ? `[Documento: ${name}]` : '[Documento]';
    }
    if (has('[data-icon*="location" i], a[href*="maps.google"], a[href*="google.com/maps"]')) return '[Localização]';
    if (has('[data-icon*="vcard" i], [data-icon*="contact-card" i]')) return '[Contato compartilhado]';
    if (has('img[src^="blob:"], img[src^="data:image"]:not(.emoji)')) return '[Imagem]';
    const leftover = lines.join(' ').trim();
    return leftover ? leftover.slice(0, 500) : '[Mensagem sem texto]';
  }

  // "Ler mais" em mensagens longas: expande para capturar o texto completo
  async function expandReadMore(nodes) {
    let clicked = 0;
    for (const el of nodes) {
      for (const btn of el.querySelectorAll(READ_MORE_SEL)) {
        if (btn.closest(SEL.quoted)) continue;
        if (READ_MORE_RE.test(W.stripMarks(btn.textContent).trim())) {
          btn.click();
          clicked++;
        }
      }
    }
    if (clicked) await sleep(200);
    return clicked;
  }

  const outsideQuote = (nodes) => [...nodes].some((n) => !n.closest(SEL.quoted));

  // Quem enviou: o prefixo antigo do data-id, as classes antigas, as marcas que só as
  // suas mensagens têm e, sem nenhuma delas, o autor no data-pre-plain-text (numa
  // conversa individual, quem não é o contato é você).
  function directionOf(el, id, pre, ctx) {
    if (id) return id.fromMe;
    if (el.matches(SEL.outgoing) || el.querySelector(SEL.outgoing)) return true;
    if (el.matches(SEL.incoming) || el.querySelector(SEL.incoming)) return false;
    if (outsideQuote(el.querySelectorAll(SEL.outgoingMarks))) return true;
    // em grupos, as mensagens dos outros trazem o nome de quem escreveu
    if (outsideQuote(el.querySelectorAll(SEL.groupAuthor))) return false;
    // o título de um grupo não é o nome de quem escreve: a regra do autor só vale a dois
    // nomes que não dá para comparar (só emojis): na dúvida, a mensagem é do contato
    if (pre && W.nameKey(ctx.title) && !ctx.groupSeen) {
      const parsed = W.parsePrePlainText(pre.getAttribute('data-pre-plain-text'), ctx.dateOrder);
      if (parsed && W.nameKey(parsed.sender)) return !W.sameName(parsed.sender, ctx.title);
    }
    return false;
  }

  function readMessage(el, ctx) {
    const raw = el.getAttribute('data-id');
    const id = W.parseDataId(raw);
    const pre = el.querySelector(SEL.prePlain);
    const fromMe = directionOf(el, id, pre, ctx);

    let date = null;
    if (pre) {
      const parsed = W.parsePrePlainText(pre.getAttribute('data-pre-plain-text'), ctx.dateOrder);
      if (parsed) date = parsed.date;
    }
    const timeOnly = date ? null : W.parseTimeOnly(metaTime(el));

    let text = '';
    if (pre) text = textFrom(pre.querySelector(SEL.selectableText) || pre);
    if (!text) {
      const candidate = [...el.querySelectorAll(SEL.selectableText)].find((s) => !s.closest(SEL.quoted));
      text = textFrom(candidate);
    }
    if (text && W.isDeletedText(W.fold(text))) text = '[Mensagem apagada]';
    if (!text) text = placeholderFor(el);

    return {
      chatJid: id ? id.chatJid : '',
      messageId: W.messageIdFromDataId(raw),
      fromMe,
      groupAuthor: outsideQuote(el.querySelectorAll(SEL.groupAuthor)),
      text,
      date,
      timeOnly,
      approx: false,
    };
  }

  const atTime = (day, t) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m);
  const previousDay = (day) => new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);

  // Mensagens só com a hora (áudio, imagem…) antes de qualquer data conhecida: usa o
  // dia da próxima mensagem datada (ou o dia anterior, se a hora passar dela).
  // Nunca deixa um horário no futuro.
  function resolvePendingDates(out) {
    const now = new Date();
    let next = null;
    for (let i = out.length - 1; i >= 0; i--) {
      const m = out[i];
      if (m.date) {
        next = m.date;
        continue;
      }
      if (!m.timeOnly) continue;
      const limit = next || now;
      let d = atTime(W.startOfDay(limit), m.timeOnly);
      if (d > limit) d = atTime(previousDay(W.startOfDay(limit)), m.timeOnly);
      m.date = d;
      m.approx = true;
      next = d;
    }
    // sem hora legível: herda o horário da vizinha para manter a ordem
    for (let i = 0; i < out.length; i++) {
      if (out[i].date) continue;
      const prev = out[i - 1];
      const after = out.slice(i + 1).find((m) => m.date);
      out[i].date = new Date(((prev && prev.date) || (after && after.date) || now).getTime());
      out[i].approx = true;
    }
  }

  // Lê a conversa na ordem da tela, acompanhando as divisórias de data
  async function readDom(title) {
    const main = document.querySelector(SEL.main);
    if (!main) return [];
    const nodes = messageNodes();
    await expandReadMore(nodes);

    let rows = [...main.querySelectorAll(SEL.row)];
    const rowsHaveMessages = rows.some((r) => isMessageDataId(r.getAttribute('data-id')) || r.querySelector(SEL.dataId));
    if (!rowsHaveMessages) rows = nodes;
    const nodeSet = new Set(nodes);

    const dateOrder = W.inferDateOrder([...main.querySelectorAll(SEL.prePlain)]
      .map((e) => e.getAttribute('data-pre-plain-text'))) || pageLocale();
    const ctx = { title, dateOrder, groupSeen: outsideQuote(main.querySelectorAll(SEL.groupAuthor)) };

    const out = [];
    const seen = new Set();
    let knownDay = null; // dia confiável: de uma divisória ou de mensagem com data completa
    for (const row of rows) {
      const el = nodeSet.has(row) ? row : [...row.querySelectorAll(SEL.dataId)].find((n) => nodeSet.has(n));
      if (!el) {
        const label = W.stripMarks(row.textContent).trim();
        if (label && label.length <= 40) {
          const day = W.parseDateLabel(label, new Date(), dateOrder);
          if (day) knownDay = day;
        }
        continue;
      }
      if (seen.has(el)) continue;
      seen.add(el);
      if (isPlaceholder(el)) continue;
      const msg = readMessage(el, ctx);
      if (msg.date) knownDay = W.startOfDay(msg.date);
      else if (msg.timeOnly && knownDay) msg.date = atTime(knownDay, msg.timeOnly);
      out.push(msg);
    }
    resolvePendingDates(out);
    return out;
  }

  function scrollContainer() {
    const first = messageNodes()[0];
    let el = first ? first.parentElement : null;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 10) return el;
      el = el.parentElement;
    }
    return null;
  }

  // Rola a conversa para o topo até carregar `target` mensagens (ou parar de vir mais).
  // No fim, devolve a rolagem para o ponto em que o usuário estava lendo.
  async function loadOlderMessages(target, onRound) {
    const box = scrollContainer();
    if (!box) return { rounds: 0, stopped: 'sem-rolagem' };
    const fromBottom = box.scrollHeight - box.scrollTop;
    let count = await onRound();
    let rounds = 0;
    let stale = 0;
    while (count < target && rounds < MAX_OLDER_ROUNDS && stale < 3) {
      rounds++;
      box.scrollTop = 0;
      box.dispatchEvent(new Event('scroll'));
      await sleep(OLDER_WAIT_MS);
      const next = await onRound();
      if (next < 0) return { rounds, stopped: 'conversa-trocada' };
      if (next > count) {
        count = next;
        stale = 0;
      } else {
        stale++;
      }
    }
    box.scrollTop = Math.max(0, box.scrollHeight - fromBottom);
    box.dispatchEvent(new Event('scroll'));
    return { rounds, stopped: count >= target ? 'limite' : stale >= 3 ? 'fim-da-conversa' : 'tentativas' };
  }

  // ─── Leitura da tela: captura completa ───

  async function captureFromDom({ limit, loadOlder }) {
    if (!document.querySelector(SEL.main)) {
      return { ok: true, chat: null, messages: [], reason: loginOrEmpty() };
    }
    const collected = new Map();
    let pass = 0;
    let groupSeen = false;

    // Se o usuário trocar de conversa no meio da leitura (ex.: durante a busca de
    // mensagens antigas), a captura é abortada para não misturar duas conversas.
    // Sem jid (HTML de nov/2026), duas conversas de mesmo nome só se distinguem pela
    // tela da conversa (#main recriado ao trocar).
    const start = currentChatIdentity();
    const view = viewToken();
    const sameChat = () => {
      const now = currentChatIdentity();
      if (now.title !== start.title) return false;
      if (!start.jid && viewToken() !== view) return false;
      return !(start.jid && now.jid && now.jid !== start.jid);
    };

    const scan = async () => {
      if (!sameChat()) return -1;
      pass++;
      const list = (await readDom(start.title)).filter((m) => !start.jid || !m.chatJid || m.chatJid === start.jid);
      const chatKeyForHash = start.jid || start.title;
      const occurrences = new Map();
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.groupAuthor) groupSeen = true;
        const iso = m.date.toISOString();
        let externalId = m.messageId;
        if (!externalId) {
          const base = `${m.fromMe ? 1 : 0}|${iso}|${m.text}`;
          const n = occurrences.get(base) || 0;
          occurrences.set(base, n + 1);
          externalId = await W.stableId([chatKeyForHash, String(m.fromMe), iso, m.text, String(n)]);
        }
        collected.set(externalId, {
          external_id: externalId,
          from_me: m.fromMe,
          text: m.text,
          timestamp: iso,
          approx: m.approx,
          chatJid: m.chatJid,
          pos: pass * 100000 + i,
        });
      }
      return collected.size;
    };

    if ((await scan()) < 0) return chatChanged();
    let older = null;
    if (loadOlder && collected.size < limit) {
      older = await loadOlderMessages(limit, scan);
      if (older.stopped === 'conversa-trocada' || (await scan()) < 0) return chatChanged();
    }

    const all = [...collected.values()].sort((a, b) =>
      a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.pos - b.pos);
    const kept = all.slice(-limit);

    const jid = start.jid || ([...all].reverse().find((m) => m.chatJid) || {}).chatJid || '';
    let kind = W.jidKind(jid);
    if (kind === 'unknown' && groupSeen) kind = 'group';
    const title = start.title;
    let phone = '';
    let phoneSource = '';
    if (kind === 'user') {
      phone = W.normalizePhone(W.phoneFromJid(jid), { international: true });
      phoneSource = 'jid';
    }
    if (!phone && !UNSUPPORTED[kind] && W.looksLikePhone(title)) {
      phone = W.normalizePhone(title);
      phoneSource = 'header';
    }

    return {
      ok: true,
      source: 'dom',
      chat: {
        key: jid || (title ? `title:${title}` : ''),
        title,
        name: W.looksLikePhone(title) ? '' : title,
        phone,
        phoneSource,
        jidKind: kind,
        isGroup: kind === 'group',
        isLid: kind === 'lid',
        unsupported: UNSUPPORTED[kind] || null,
        viewToken: view,
      },
      messages: kept.map(({ external_id, from_me, text, timestamp, approx }) => ({ external_id, from_me, text, timestamp, approx })),
      stats: {
        found: all.length,
        older,
      },
    };
  }

  // ─── Captura: dados internos primeiro, tela como reserva ───

  async function capture({ limit = 100, loadOlder = false } = {}) {
    const fromStore = await captureFromStore({ limit, loadOlder });
    if (fromStore) return fromStore;
    const res = await captureFromDom({ limit, loadOlder });
    if (res && res.ok) res.bridge = bridgePresent() ? 'sem-acesso' : 'ausente';
    return res;
  }

  // ─── Telefone pelo perfil do contato (reserva acionada pelo usuário) ───

  const OUTSIDE_CONVERSATION = '#main, #pane-side, #side';

  // Sobe do elemento até um container que ainda não inclua a conversa (#main):
  // assim o "mesmo bloco" nunca é a página inteira.
  function* ancestorsOutsideMain(el, maxDepth) {
    const main = document.querySelector(SEL.main);
    for (let node = el.parentElement, depth = 0; node && depth < maxDepth; node = node.parentElement, depth++) {
      if (node === document.body || node.id === 'app' || (main && node.contains(main))) return;
      yield node;
    }
  }

  // Telefones exibidos fora da conversa (painel "Dados do contato"). Só vale o número
  // que está no mesmo bloco que o nome do contato, para não pegar o número de outro
  // painel aberto (o seu perfil, por exemplo).
  function profilePhoneCandidates(title) {
    const wanted = W.looksLikePhone(title) ? '' : W.fold(title);
    const found = [];
    for (const el of document.querySelectorAll('span, div')) {
      if (el.children.length) continue;
      if (el.closest(OUTSIDE_CONVERSATION)) continue;
      const text = W.stripMarks(el.textContent).trim();
      if (text.length < 8 || text.length > 26 || !PROFILE_PHONE_RE.test(text)) continue;
      let near = !wanted;
      for (const node of ancestorsOutsideMain(el, 10)) {
        if (near) break;
        if (W.fold(node.textContent).includes(wanted)) near = true;
      }
      if (near) found.push({ text, el });
    }
    return found;
  }

  // Fecha o painel em que o número foi achado (o botão de fechar mais próximo dele).
  // Sem botão por perto, deixa o painel aberto: um Escape poderia fechar a conversa.
  function closeDrawerAround(el) {
    for (const node of ancestorsOutsideMain(el, 15)) {
      const close = [...node.querySelectorAll(SEL.drawerClose)].find((c) => !c.closest(OUTSIDE_CONVERSATION));
      if (close) {
        (close.closest('[role="button"], button') || close).click();
        return true;
      }
    }
    return false;
  }

  async function lookupPhoneInProfile() {
    const title = headerTitle();
    const already = profilePhoneCandidates(title);
    if (already.length) return { ok: true, phone: W.normalizePhone(already[0].text) };

    const header = document.querySelector(SEL.header);
    if (!header) return { ok: true, phone: '' };
    const titleEl = headerTitleElement();
    const target = (titleEl && (titleEl.closest('[role="button"]') || titleEl.closest('[tabindex]'))) || header;
    target.click();

    let found = null;
    for (let i = 0; i < 20 && !found; i++) {
      await sleep(150);
      found = profilePhoneCandidates(title)[0] || null;
    }
    if (found) closeDrawerAround(found.el);
    return { ok: true, phone: found ? W.normalizePhone(found.text) : '' };
  }

  // ─── Diagnóstico (sem conteúdo das mensagens) ───

  async function diagnose() {
    const main = document.querySelector(SEL.main);
    const nodes = messageNodes();
    const formats = {};
    let placeholders = 0;
    for (const el of nodes) {
      const raw = el.getAttribute('data-id');
      const id = W.parseDataId(raw);
      const format = id ? `antigo:${W.jidKind(id.chatJid)}` : 'so-id';
      formats[format] = (formats[format] || 0) + 1;
      if (isPlaceholder(el)) placeholders++;
    }
    const pre = main ? main.querySelector(SEL.prePlain) : null;
    const count = (selector) => (main ? main.querySelectorAll(selector).length : 0);
    let bridge = { present: bridgePresent() };
    if (bridge.present) {
      try {
        bridge = { present: true, ...(await bridgeCall('diagnose', {}, 4000)) };
      } catch (err) {
        bridge = { present: true, error: String((err && err.message) || err) };
      }
    }
    return {
      ok: true,
      extensionVersion: chrome.runtime.getManifest().version,
      locale: pageLocale(),
      userAgent: navigator.userAgent,
      bridge,
      main: Boolean(main),
      header: Boolean(document.querySelector(SEL.header)),
      headerTitleMarked: Boolean(document.querySelector(`${SEL.header} ${SEL.headerTitle}`)),
      headerTitleChars: headerTitle().length,
      selectedChat: Boolean(document.querySelector(SEL.selectedChat)),
      rows: count(SEL.row),
      messageNodes: nodes.length,
      dataIdFormats: formats,
      placeholders,
      testidRows: count('[data-testid^="conv-msg-"]'),
      incomingClass: count(SEL.incoming),
      outgoingClass: count(SEL.outgoing),
      outgoingMarks: count(SEL.outgoingMarks),
      groupAuthors: count(SEL.groupAuthor),
      prePlainText: count(SEL.prePlain),
      selectableText: count(SEL.selectableText),
      scrollContainer: Boolean(scrollContainer()),
      samplePrePlainFormat: pre ? W.maskText(pre.getAttribute('data-pre-plain-text')) : null,
      sampleDataIdFormat: nodes[0] ? W.maskText(nodes[0].getAttribute('data-id')) : null,
    };
  }

  // ─── Mensagens do painel ───

  async function handle(msg) {
    switch (msg.type) {
      case 'ANA_PING':
        return { ok: true, version: chrome.runtime.getManifest().version, bridge: bridgePresent() };
      case 'ANA_CAPTURE':
        return capture({ limit: Number(msg.limit) || 100, loadOlder: Boolean(msg.loadOlder) });
      case 'ANA_LOOKUP_PHONE':
        return lookupPhoneInProfile();
      case 'ANA_DIAGNOSE':
        return diagnose();
      default:
        return { ok: false, error: `Comando desconhecido: ${msg.type}` };
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('ANA_')) return undefined;
    handle(msg).then(sendResponse, (err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  });

  // ─── Aviso de troca de conversa (e de mensagem nova) para o painel ───

  function isAlive() {
    try {
      return Boolean(RUNTIME && RUNTIME.id);
    } catch {
      return false;
    }
  }

  let lastSignature = null;
  let lastTick = 0;
  let watcher = null;

  function stop() {
    clearInterval(watcher);
    window.removeEventListener('message', onBridgeMessage);
  }

  function notify(reason, signature) {
    try {
      chrome.runtime.sendMessage({ type: 'ANA_CHAT_CHANGED', reason, signature }).catch(() => {});
    } catch {
      // extensão recarregada: o próximo ciclo para o vigia
    }
  }

  function watch() {
    if (!isAlive()) {
      // a extensão foi atualizada ou recarregada: este script antigo para de observar
      stop();
      return;
    }
    try {
      const hasMain = Boolean(document.querySelector(SEL.main));
      const { jid, title } = hasMain ? currentChatIdentity() : { jid: '', title: '' };
      const signature = hasMain || bridgeActive ? `${title}|${jid}|${bridgeActive}|${viewToken()}` : '';
      if (signature !== lastSignature) {
        const first = lastSignature === null;
        lastSignature = signature;
        lastTick = bridgeTick;
        if (!first) notify('chat', signature);
      } else if (bridgeTick !== lastTick) {
        lastTick = bridgeTick;
        notify('messages', signature);
      }
    } catch {
      // página no meio de uma troca de tela: tenta no próximo ciclo
    }
  }

  // A referência é tirada já na injeção, antes de o painel conseguir ler a conversa:
  // uma troca logo depois de abrir o painel não pode virar a referência sem aviso.
  watch();
  watcher = setInterval(watch, 1000);

  globalThis.__anaCrmCapture = { isAlive, stop };
})();
