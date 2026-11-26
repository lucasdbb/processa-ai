// ANA CRM — leitura da conversa aberta no WhatsApp Web (content script).
//
// Só lê a página quando o painel pede (ANA_CAPTURE) e nunca envia mensagens.
// Todos os seletores do WhatsApp ficam em SEL: quando o WhatsApp mudar o
// layout, é aqui que se ajusta. ANA_DIAGNOSE conta quantos elementos cada
// seletor encontra, sem expor o conteúdo das conversas.
(() => {
  'use strict';
  if (globalThis.__anaCrmCaptureLoaded) return;
  globalThis.__anaCrmCaptureLoaded = true;

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
  const TIME_ONLY_RE = /^\s*\d{1,2}[:.]\d{2}(\s*[ap]\.?\s?m\.?)?\s*$/i;
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
      const text = (el.getAttribute('title') || el.textContent || '').trim();
      if (text && !STATUS_RE.test(text)) return el;
    }
    return null;
  }

  function headerTitle() {
    const el = headerTitleElement();
    if (el) return (el.getAttribute('title') || el.textContent || '').trim();
    const selected = document.querySelector(SEL.selectedChat);
    const span = selected && selected.querySelector('span[title]');
    return span ? span.getAttribute('title').trim() : '';
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
    return out
      .replace(/[‎‏]/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function metaTime(el) {
    const times = [...el.querySelectorAll('span')]
      .map((s) => (s.textContent || '').trim())
      .filter((t) => TIME_ONLY_RE.test(t));
    return times.length ? times[times.length - 1] : '';
  }

  function documentName(el) {
    const titled = [...el.querySelectorAll('[title]')].map((e) => e.getAttribute('title'));
    return titled.find((t) => /\.[a-z0-9]{2,5}$/i.test(t || '')) || '';
  }

  // Mensagens sem texto: descreve o tipo em vez de enviar vazio
  function placeholderFor(el) {
    if (W.isDeletedText(W.fold(el.textContent))) return '[Mensagem apagada]';
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
    const leftover = (el.innerText || el.textContent || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !TIME_ONLY_RE.test(s))
      .join(' ')
      .trim();
    return leftover ? leftover.slice(0, 500) : '[Mensagem sem texto]';
  }

  // "Ler mais" em mensagens longas: expande para capturar o texto completo
  async function expandReadMore(nodes) {
    let clicked = 0;
    for (const el of nodes) {
      for (const btn of el.querySelectorAll('[role="button"], span, div')) {
        if (btn.children.length > 1) continue;
        if (READ_MORE_RE.test((btn.textContent || '').trim())) {
          btn.click();
          clicked++;
        }
      }
    }
    if (clicked) await sleep(200);
    return clicked;
  }

  function readMessage(el, dateOrder, currentDay) {
    const id = W.parseDataId(el.getAttribute('data-id'));
    const fromMe = id ? id.fromMe : Boolean(el.matches(SEL.outgoing) || el.querySelector(SEL.outgoing));
    const pre = el.querySelector(SEL.prePlain);

    let date = null;
    let approx = false;
    if (pre) {
      const parsed = W.parsePrePlainText(pre.getAttribute('data-pre-plain-text'), dateOrder);
      if (parsed) date = parsed.date;
    }
    if (!date) {
      const t = W.parseTimeOnly(metaTime(el));
      if (t) {
        const base = currentDay || W.startOfDay(new Date());
        date = new Date(base.getFullYear(), base.getMonth(), base.getDate(), t.h, t.m);
        approx = !currentDay;
      }
    }

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
      approx,
    };
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
    let currentDay = null;
    for (const row of rows) {
      const el = isMessageDataId(row.getAttribute('data-id')) ? row : row.querySelector(SEL.messageId);
      if (!el) {
        const label = (row.textContent || '').trim();
        if (label && label.length <= 40) {
          const day = W.parseDateLabel(label, new Date(), dateOrder);
          if (day) currentDay = day;
        }
        continue;
      }
      if (seen.has(el)) continue;
      seen.add(el);
      const msg = readMessage(el, dateOrder, currentDay);
      if (!msg.date) {
        // sem horário legível: herda o da mensagem anterior para manter a ordem
        const prev = out[out.length - 1];
        msg.date = prev ? new Date(prev.date.getTime()) : new Date();
        msg.approx = true;
      }
      currentDay = W.startOfDay(msg.date);
      out.push(msg);
    }
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

  // Rola a conversa para o topo até carregar `target` mensagens (ou parar de vir mais)
  async function loadOlderMessages(target, onRound) {
    const box = scrollContainer();
    if (!box) return { rounds: 0, stopped: 'sem-rolagem' };
    let count = await onRound();
    let rounds = 0;
    let stale = 0;
    while (count < target && rounds < MAX_OLDER_ROUNDS && stale < 3) {
      rounds++;
      box.scrollTop = 0;
      box.dispatchEvent(new Event('scroll'));
      await sleep(OLDER_WAIT_MS);
      const next = await onRound();
      if (next > count) {
        count = next;
        stale = 0;
      } else {
        stale++;
      }
    }
    box.scrollTop = box.scrollHeight;
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

    const scan = async () => {
      pass++;
      const list = await readDom();
      const lastJid = [...list].reverse().find((m) => m.chatJid);
      const chatKeyForHash = (lastJid && lastJid.chatJid) || headerTitle();
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

    await scan();
    let older = null;
    if (loadOlder && collected.size < limit) {
      older = await loadOlderMessages(limit, scan);
      await scan();
    }

    const all = [...collected.values()].sort((a, b) =>
      a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.pos - b.pos);
    const kept = all.slice(-limit);

    const jid = ([...all].reverse().find((m) => m.chatJid) || {}).chatJid || '';
    const kind = W.jidKind(jid);
    const title = headerTitle();
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
      },
      messages: kept.map(({ external_id, from_me, text, timestamp, approx }) => ({ external_id, from_me, text, timestamp, approx })),
      stats: {
        found: all.length,
        older,
      },
    };
  }

  // ─── Telefone pelo perfil do contato (fallback acionado pelo usuário) ───

  function phoneTextsOutsideConversation() {
    const found = [];
    for (const el of document.querySelectorAll('span, div')) {
      if (el.children.length) continue;
      if (el.closest('#main, #pane-side')) continue;
      const text = (el.textContent || '').trim();
      if (text.length >= 8 && text.length <= 26 && PROFILE_PHONE_RE.test(text)) found.push(text);
    }
    return found;
  }

  function closeContactDrawer() {
    const close = [...document.querySelectorAll(SEL.drawerClose)].find((e) => !e.closest('#main, #pane-side'));
    if (close) {
      (close.closest('[role="button"], button') || close).click();
      return;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }

  async function lookupPhoneInProfile() {
    const already = phoneTextsOutsideConversation();
    if (already.length) return { ok: true, phone: W.normalizePhone(already[0]) };

    const titleEl = headerTitleElement();
    const header = document.querySelector(SEL.header);
    if (!header) return { ok: true, phone: '' };
    const target = (titleEl && (titleEl.closest('[role="button"]') || titleEl.closest('[tabindex]'))) || header;
    target.click();

    let found = '';
    for (let i = 0; i < 20 && !found; i++) {
      await sleep(150);
      found = phoneTextsOutsideConversation()[0] || '';
    }
    closeContactDrawer();
    return { ok: true, phone: found ? W.normalizePhone(found) : '' };
  }

  // ─── Diagnóstico (sem conteúdo das mensagens) ───

  function mask(value) {
    return String(value || '').replace(/[A-Za-zÀ-ÿ]/g, 'a').replace(/\d/g, '9').slice(0, 60);
  }

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
      samplePrePlainFormat: pre ? mask(pre.getAttribute('data-pre-plain-text')) : null,
      sampleDataIdFormat: nodes[0] ? mask(nodes[0].getAttribute('data-id')) : null,
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

  let lastSignature = null;
  const watcher = setInterval(() => {
    try {
      const nodes = document.querySelector(SEL.main) ? messageNodes() : [];
      const id = nodes.length ? W.parseDataId(nodes[nodes.length - 1].getAttribute('data-id')) : null;
      const signature = document.querySelector(SEL.main) ? `${headerTitle()}|${id ? id.chatJid : ''}` : '';
      if (signature === lastSignature) return;
      const first = lastSignature === null;
      lastSignature = signature;
      if (!first) chrome.runtime.sendMessage({ type: 'ANA_CHAT_CHANGED', signature }).catch(() => {});
    } catch {
      // a extensão foi recarregada: este script antigo para de observar
      clearInterval(watcher);
    }
  }, 1000);
})();
