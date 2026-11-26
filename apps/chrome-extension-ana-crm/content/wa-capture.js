// ANA CRM — leitura da conversa aberta no WhatsApp Web (content script).
//
// Só lê a página quando o painel pede (ANA_CAPTURE) e nunca envia mensagens.
// Todos os seletores do WhatsApp ficam em SEL: quando o WhatsApp mudar o
// layout, é aqui que se ajusta. ANA_DIAGNOSE conta quantos elementos cada
// seletor encontra, sem expor o conteúdo das conversas.
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
    headerText: 'span[dir="auto"], span[title]',
    selectedChat: '#pane-side [aria-selected="true"]',
    dataId: '[data-id]',
    messageId: '[data-id^="true_"], [data-id^="false_"]',
    row: '[role="row"]',
    prePlain: '[data-pre-plain-text]',
    selectableText: '.selectable-text',
    quoted: '.quoted-mention, [aria-label*="citada" i], [aria-label*="quoted" i], [aria-label*="citado" i]',
    outgoing: '.message-out',
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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isMessageDataId = (value) => /^(true|false)_/i.test(value || '');
  const pageLocale = () => document.documentElement.lang || navigator.language || '';

  // ─── Cabeçalho da conversa ───

  function headerTitleElement() {
    const header = document.querySelector(SEL.header);
    if (!header) return null;
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

  // Conversa aberta agora: jid da última mensagem visível + título do cabeçalho
  function currentChatIdentity() {
    const nodes = messageNodes();
    const id = nodes.length ? W.parseDataId(nodes[nodes.length - 1].getAttribute('data-id')) : null;
    return { jid: id ? id.chatJid : '', title: headerTitle() };
  }

  // ─── Mensagens ───

  function messageNodes() {
    const main = document.querySelector(SEL.main);
    if (!main) return [];
    return [...main.querySelectorAll(SEL.dataId)].filter((el) =>
      isMessageDataId(el.getAttribute('data-id'))
      && !(el.parentElement && el.parentElement.closest(SEL.messageId)));
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

  function readMessage(el, dateOrder) {
    const id = W.parseDataId(el.getAttribute('data-id'));
    const fromMe = id ? id.fromMe : Boolean(el.matches(SEL.outgoing) || el.querySelector(SEL.outgoing));
    const pre = el.querySelector(SEL.prePlain);

    let date = null;
    if (pre) {
      const parsed = W.parsePrePlainText(pre.getAttribute('data-pre-plain-text'), dateOrder);
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
      messageId: id ? id.messageId : '',
      fromMe,
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
  async function readDom() {
    const main = document.querySelector(SEL.main);
    if (!main) return [];
    const nodes = messageNodes();
    await expandReadMore(nodes);

    let rows = [...main.querySelectorAll(SEL.row)];
    const rowsHaveMessages = rows.some((r) => isMessageDataId(r.getAttribute('data-id')) || r.querySelector(SEL.messageId));
    if (!rowsHaveMessages) rows = nodes;

    const dateOrder = W.inferDateOrder([...main.querySelectorAll(SEL.prePlain)]
      .map((e) => e.getAttribute('data-pre-plain-text'))) || pageLocale();

    const out = [];
    const seen = new Set();
    let knownDay = null; // dia confiável: de uma divisória ou de mensagem com data completa
    for (const row of rows) {
      const el = isMessageDataId(row.getAttribute('data-id')) ? row : row.querySelector(SEL.messageId);
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
      const msg = readMessage(el, dateOrder);
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

  // ─── Captura completa ───

  async function capture({ limit = 100, loadOlder = false } = {}) {
    if (!document.querySelector(SEL.main)) {
      return { ok: true, chat: null, messages: [], reason: document.querySelector('canvas, [data-ref]') ? 'login' : 'sem-conversa' };
    }
    const collected = new Map();
    let pass = 0;

    // Se o usuário trocar de conversa no meio da leitura (ex.: durante a busca de
    // mensagens antigas), a captura é abortada para não misturar duas conversas.
    const start = currentChatIdentity();
    const view = viewToken();
    const sameChat = () => {
      const now = currentChatIdentity();
      if (now.title !== start.title) return false;
      return !(start.jid && now.jid && now.jid !== start.jid);
    };
    const chatChanged = () => ({ ok: false, code: 'chat-changed', error: 'A conversa mudou durante a leitura.' });

    const scan = async () => {
      if (!sameChat()) return -1;
      pass++;
      const list = (await readDom()).filter((m) => !start.jid || !m.chatJid || m.chatJid === start.jid);
      const chatKeyForHash = start.jid || start.title;
      const occurrences = new Map();
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
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
    const kind = W.jidKind(jid);
    const title = start.title;
    let phone = '';
    let phoneSource = '';
    if (kind === 'user') {
      phone = W.normalizePhone(W.phoneFromJid(jid), { international: true });
      phoneSource = 'jid';
    }
    if (!phone && W.looksLikePhone(title)) {
      phone = W.normalizePhone(title);
      phoneSource = 'header';
    }

    return {
      ok: true,
      chat: {
        key: jid || (title ? `title:${title}` : ''),
        title,
        name: W.looksLikePhone(title) ? '' : title,
        phone,
        phoneSource,
        jidKind: kind,
        isGroup: kind === 'group',
        isLid: kind === 'lid',
        unsupported: { group: 'group', newsletter: 'channel', broadcast: 'broadcast' }[kind] || null,
        viewToken: view,
      },
      messages: kept.map(({ external_id, from_me, text, timestamp, approx }) => ({ external_id, from_me, text, timestamp, approx })),
      stats: {
        found: all.length,
        older,
      },
    };
  }

  // ─── Telefone pelo perfil do contato (fallback acionado pelo usuário) ───

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

  function diagnose() {
    const main = document.querySelector(SEL.main);
    const nodes = messageNodes();
    const kinds = {};
    for (const el of nodes) {
      const id = W.parseDataId(el.getAttribute('data-id'));
      const kind = id ? W.jidKind(id.chatJid) : 'sem-data-id';
      kinds[kind] = (kinds[kind] || 0) + 1;
    }
    const pre = main ? main.querySelector(SEL.prePlain) : null;
    return {
      ok: true,
      extensionVersion: chrome.runtime.getManifest().version,
      locale: pageLocale(),
      userAgent: navigator.userAgent,
      main: Boolean(main),
      header: Boolean(document.querySelector(SEL.header)),
      headerTitleChars: headerTitle().length,
      selectedChat: Boolean(document.querySelector(SEL.selectedChat)),
      rows: main ? main.querySelectorAll(SEL.row).length : 0,
      messageNodes: nodes.length,
      jidKinds: kinds,
      incoming: main ? main.querySelectorAll('.message-in').length : 0,
      outgoing: main ? main.querySelectorAll('.message-out').length : 0,
      prePlainText: main ? main.querySelectorAll(SEL.prePlain).length : 0,
      selectableText: main ? main.querySelectorAll(SEL.selectableText).length : 0,
      scrollContainer: Boolean(scrollContainer()),
      samplePrePlainFormat: pre ? W.maskText(pre.getAttribute('data-pre-plain-text')) : null,
      sampleDataIdFormat: nodes[0] ? W.maskText(nodes[0].getAttribute('data-id')) : null,
    };
  }

  // ─── Mensagens do painel ───

  async function handle(msg) {
    switch (msg.type) {
      case 'ANA_PING':
        return { ok: true, version: chrome.runtime.getManifest().version };
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

  // ─── Aviso de troca de conversa para o painel ───

  function isAlive() {
    try {
      return Boolean(RUNTIME && RUNTIME.id);
    } catch {
      return false;
    }
  }

  let lastSignature = null;
  const watcher = setInterval(() => {
    if (!isAlive()) {
      // a extensão foi atualizada ou recarregada: este script antigo para de observar
      clearInterval(watcher);
      return;
    }
    try {
      const { jid, title } = document.querySelector(SEL.main) ? currentChatIdentity() : { jid: '', title: '' };
      const signature = document.querySelector(SEL.main) ? `${title}|${jid}` : '';
      if (signature === lastSignature) return;
      const first = lastSignature === null;
      lastSignature = signature;
      if (!first) chrome.runtime.sendMessage({ type: 'ANA_CHAT_CHANGED', signature }).catch(() => {});
    } catch {
      clearInterval(watcher);
    }
  }, 1000);

  globalThis.__anaCrmCapture = { isAlive, stop: () => clearInterval(watcher) };
})();
