// ANA CRM — ponte com os dados internos do WhatsApp Web.
//
// Roda no JavaScript da própria página (content script com "world": "MAIN"),
// onde ficam os módulos do WhatsApp Web. Lê, sem alterar nada, a conversa aberta:
// o contato, com o número real (inclusive de contatos com identificador privado,
// LID), e as mensagens, com data e hora exatas. Desde out/2026 o HTML do WhatsApp
// não traz mais o número do contato nem a direção das mensagens, então esta é a
// fonte principal; o content script (wa-capture.js) volta a ler a tela se ela falhar.
//
// Conversa com o content script por window.postMessage. Nunca envia, apaga ou
// marca mensagens. Os nomes internos do WhatsApp mudam sem aviso: toda leitura é
// defensiva, e uma falha só faz o content script usar a leitura da tela.
(() => {
  'use strict';

  // Igual à versão do manifest (conferido em tests/wa-parse.test.mjs)
  const VERSION = '1.2.0';
  const IN = 'ana-crm:cs';
  const OUT = 'ana-crm:page';
  const KEY = Symbol.for('ana-crm.bridge');

  // Ao atualizar a extensão, a ponte antiga continua na página: qualquer outra versão
  // é substituída; a mesma versão injetada de novo mantém a que já está rodando.
  const previous = window[KEY];
  if (previous && previous.version === VERSION) return;
  if (previous && typeof previous.dispose === 'function') previous.dispose();

  // ─── Acesso defensivo aos módulos e modelos do WhatsApp ───

  function req(name) {
    try {
      return typeof window.require === 'function' ? window.require(name) : null;
    } catch {
      return null;
    }
  }

  // Atributo de um modelo, onde quer que esta versão do WhatsApp o guarde
  function get(model, key) {
    if (!model) return undefined;
    try {
      let value = model[key];
      if (value !== undefined) return value;
      value = model[`__x_${key}`];
      if (value !== undefined) return value;
      if (model.attributes && model.attributes[key] !== undefined) return model.attributes[key];
    } catch {
      // getter que lança erro
    }
    return undefined;
  }

  const str = (v) => (typeof v === 'string' ? v : '');
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const digitsOnly = (v) => String(v || '').replace(/\D/g, '');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function list(collection) {
    if (!collection) return [];
    try {
      if (typeof collection.getModelsArray === 'function') return collection.getModelsArray() || [];
      return collection.models || collection._models || [];
    } catch {
      return [];
    }
  }

  const collections = () => req('WAWebCollections') || {};

  function chatCollection() {
    return collections().Chat || (req('WAWebChatCollection') || {}).ChatCollection || null;
  }

  function newsletterCollection() {
    const c = collections();
    return c.WAWebNewsletterCollection || c.NewsletterCollection
      || (req('WAWebNewsletterCollection') || {}).NewsletterCollection || null;
  }

  function contactCollection() {
    return collections().Contact || (req('WAWebContactCollection') || {}).ContactCollection || null;
  }

  // Wid ou MsgKey em texto. Em jul/2026 o WhatsApp renomeou _serialized para $1.
  function widString(wid) {
    if (!wid) return '';
    if (typeof wid === 'string') return wid;
    try {
      const direct = wid._serialized || wid.$1;
      if (typeof direct === 'string' && direct) return direct;
      const text = typeof wid.toString === 'function' ? wid.toString() : '';
      if (text && text !== '[object Object]') return text;
      if (typeof wid.user === 'string' && typeof wid.server === 'string') return `${wid.user}@${wid.server}`;
    } catch {
      // sem formato reconhecível
    }
    return '';
  }

  function widParts(wid) {
    const serialized = widString(wid);
    const m = /^([^@\s]+)@([a-z.]+)$/i.exec(serialized);
    return {
      serialized,
      user: (wid && typeof wid.user === 'string' && wid.user) || (m ? m[1] : ''),
      server: ((wid && typeof wid.server === 'string' && wid.server) || (m ? m[2] : '')).toLowerCase(),
    };
  }

  // ─── Conversa aberta ───

  function activeIn(collection) {
    if (!collection) return null;
    try {
      if (typeof collection.getActive === 'function') {
        const active = collection.getActive();
        if (active) return active;
      }
    } catch {
      // segue para a busca pelo atributo
    }
    for (const chat of list(collection)) {
      if (get(chat, 'active')) return chat;
    }
    return null;
  }

  function activeChat() {
    return activeIn(chatCollection()) || activeIn(newsletterCollection());
  }

  function msgsOf(chat) {
    return list(get(chat, 'msgs'));
  }

  function loadState(chat) {
    const msgs = get(chat, 'msgs');
    const state = msgs ? get(msgs, 'msgLoadState') : null;
    return {
      noEarlier: Boolean(state && get(state, 'noEarlierMsgs')),
      loading: Boolean(state && get(state, 'isLoadingEarlierMsgs')),
    };
  }

  function contactOf(chat) {
    const own = get(chat, 'contact');
    if (own) return own;
    const Contact = contactCollection();
    try {
      return Contact && typeof Contact.get === 'function' ? Contact.get(get(chat, 'id')) : null;
    } catch {
      return null;
    }
  }

  function kindOf(chat, server) {
    if (server === 'g.us' || get(chat, 'isGroup') === true) return 'group';
    if (server === 'newsletter' || get(chat, 'newsletterMetadata')) return 'newsletter';
    if (server === 'broadcast') return 'broadcast';
    if (server === 'lid') return 'lid';
    if (server === 'c.us' || server === 's.whatsapp.net') return 'user';
    return 'unknown';
  }

  // Número de telefone do contato. Em contatos com LID, o WhatsApp guarda a
  // correspondência LID → número; só é lida a informação local, sem consultar servidores.
  async function phoneOf(chat, parts) {
    if (parts.server === 'c.us' || parts.server === 's.whatsapp.net') {
      return { phone: digitsOnly(parts.user.split(':')[0]), from: 'jid' };
    }
    if (parts.server !== 'lid') return { phone: '', from: '' };
    const wid = get(chat, 'id');
    const sources = [
      () => {
        const api = req('WAWebApiContact');
        return api && typeof api.getPhoneNumber === 'function' ? api.getPhoneNumber(wid) : null;
      },
      () => get(contactOf(chat), 'phoneNumber'),
      () => {
        const lid = req('WAWebLidMigrationUtils');
        return lid && typeof lid.toPn === 'function' ? lid.toPn(wid) : null;
      },
    ];
    for (const source of sources) {
      let value = null;
      try {
        value = await Promise.race([Promise.resolve(source()), sleep(800).then(() => null)]);
      } catch {
        value = null;
      }
      if (!value) continue;
      const p = widParts(value);
      const raw = p.server === 'c.us' || p.server === 's.whatsapp.net' ? p.user.split(':')[0]
        : typeof value === 'string' && /^\+?\d[\d\s().-]{7,}$/.test(value) ? value : '';
      const d = digitsOnly(raw);
      if (d.length >= 8 && d.length <= 15) return { phone: d, from: 'lid' };
    }
    return { phone: '', from: '' };
  }

  function chatTitle(chat, contact) {
    return str(get(chat, 'formattedTitle')) || str(get(chat, 'name')) || str(get(contact, 'name'))
      || str(get(contact, 'pushname')) || str(get(contact, 'verifiedName')) || str(get(contact, 'formattedName'));
  }

  // ─── Mensagens ───

  // Nestes tipos, o campo "body" traz uma miniatura em base64, nunca texto
  const NO_BODY = new Set(['image', 'video', 'ptv', 'audio', 'ptt', 'document', 'sticker', 'location', 'live_location']);

  function serializeMsg(msg) {
    const key = get(msg, 'id') || {};
    const type = str(get(msg, 'type'));
    return {
      id: typeof key.id === 'string' ? key.id : '',
      ser: widString(key),
      fromMe: typeof key.fromMe === 'boolean' ? key.fromMe : null,
      t: num(Number(get(msg, 't'))) || 0,
      type,
      notification: Boolean(get(msg, 'isNotification')),
      body: NO_BODY.has(type) ? '' : str(get(msg, 'body')).slice(0, 20000),
      caption: str(get(msg, 'caption')).slice(0, 5000),
      filename: str(get(msg, 'filename')).slice(0, 300),
      pollName: str(get(msg, 'pollName')).slice(0, 500),
      eventName: str(get(msg, 'eventName')).slice(0, 500),
      loc: str(get(msg, 'loc')).slice(0, 300),
      lat: num(get(msg, 'lat')),
      lng: num(get(msg, 'lng')),
      isVideoCall: Boolean(get(msg, 'isVideoCall')),
      viewOnce: Boolean(get(msg, 'isViewOnce')),
      isGif: Boolean(get(msg, 'isGif')),
    };
  }

  const countable = (chat) => msgsOf(chat).filter((m) => !get(m, 'isNotification')).length;

  // ─── Mensagens mais antigas, pelo carregador do próprio WhatsApp ───

  function earlierLoader() {
    const mod = req('WAWebChatLoadMessages');
    if (!mod) return null;
    if (typeof mod.loadEarlierMsgs === 'function') return mod.loadEarlierMsgs;
    for (const name of Object.keys(mod)) {
      if (/earlier/i.test(name) && typeof mod[name] === 'function') return mod[name];
    }
    return null;
  }

  // A forma de chamar mudou em jul/2026 ({ chat }); versões anteriores recebiam (chat).
  // Cada forma é tentada até uma trazer mensagens, e a que funcionou é reaproveitada.
  const LOADER_FORMS = ['object', 'chat', 'chat+msgs'];
  let loaderForm = null;
  let loaderBroken = false; // nenhuma forma funcionou nesta página: só tenta de novo se o usuário pedir
  // conversas em que o carregador parou de trazer mensagens nesta página: a leitura
  // automática não insiste (o botão "Buscar mensagens mais antigas" força)
  const exhausted = new Set();

  function loaderArgs(form, chat) {
    if (form === 'object') return [{ chat }];
    if (form === 'chat+msgs') return [chat, get(chat, 'msgs')];
    return [chat];
  }

  async function waitWhileLoading(chat, deadline) {
    while (loadState(chat).loading && Date.now() < deadline) await sleep(100);
  }

  async function loadEarlierOnce(chat, deadline) {
    const loader = earlierLoader();
    if (!loader) return { ok: false, reason: 'sem-carregador' };
    // o próprio WhatsApp pode estar carregando (o usuário rolou a conversa): espera
    await waitWhileLoading(chat, deadline);
    if (loadState(chat).loading) return { ok: false, reason: 'whatsapp-carregando' };
    const forms = loaderForm ? [loaderForm] : LOADER_FORMS;
    let threw = 0;
    for (const form of forms) {
      const before = msgsOf(chat).length;
      try {
        const wait = Math.max(500, Math.min(8000, deadline - Date.now()));
        await Promise.race([Promise.resolve(loader(...loaderArgs(form, chat))), sleep(wait)]);
        await waitWhileLoading(chat, deadline);
      } catch {
        threw++;
        continue;
      }
      const added = msgsOf(chat).length - before;
      if (added > 0 || loadState(chat).noEarlier) {
        loaderForm = form;
        return { ok: true, added };
      }
    }
    // a forma que já funcionou não trouxe nada agora: o histórico pode estar a caminho
    if (loaderForm) return { ok: true, added: 0 };
    // todas as formas deram erro: o carregador mudou nesta versão do WhatsApp
    if (threw === forms.length) {
      loaderBroken = true;
      return { ok: false, reason: 'carregador-com-erro' };
    }
    // nenhuma trouxe nada (ex.: histórico antigo só no celular): vale só para esta conversa
    return { ok: false, reason: 'carregador-sem-efeito' };
  }

  // ─── Pedidos do content script ───

  // force: o usuário clicou em "Buscar mensagens mais antigas"
  async function snapshot({ limit = 100, maxMs = 6000, loadEarlier = true, force = false } = {}) {
    if (!chatCollection()) return { store: false };
    const chat = activeChat();
    if (!chat) return { store: true, chat: null };

    const parts = widParts(get(chat, 'id'));
    const kind = kindOf(chat, parts.server);
    const sameChat = () => widString(get(activeChat(), 'id')) === parts.serialized;
    const deadline = Date.now() + Math.max(0, Math.min(Number(maxMs) || 0, 30000));
    const load = { rounds: 0, stopped: '' };

    // conversa recém-aberta: espera as mensagens recentes chegarem antes de pedir as antigas
    const waitUntil = Math.min(deadline, Date.now() + 1500);
    while (!msgsOf(chat).length && Date.now() < waitUntil) await sleep(100);

    const supported = kind === 'user' || kind === 'lid' || kind === 'unknown';
    const allowed = force || (!loaderBroken && !exhausted.has(parts.serialized));
    if (loadEarlier && supported && allowed && countable(chat) < limit) {
      if (force) {
        loaderBroken = false;
        exhausted.delete(parts.serialized);
      }
      let stale = 0;
      while (countable(chat) < limit && Date.now() < deadline && load.rounds < 12) {
        if (loadState(chat).noEarlier) {
          load.stopped = 'inicio-da-conversa';
          break;
        }
        load.rounds++;
        const r = await loadEarlierOnce(chat, deadline);
        if (!sameChat()) return { store: true, changed: true };
        if (!r.ok) {
          load.stopped = r.reason;
          break;
        }
        stale = r.added ? 0 : stale + 1;
        if (stale >= 2) {
          load.stopped = 'sem-novas';
          break;
        }
      }
      if (!load.stopped) load.stopped = countable(chat) >= limit ? 'limite' : 'tempo';
      if (['sem-novas', 'carregador-sem-efeito', 'carregador-com-erro', 'sem-carregador'].includes(load.stopped)) {
        exhausted.add(parts.serialized);
      }
    }
    if (!sameChat()) return { store: true, changed: true };

    const contact = contactOf(chat);
    const { phone, from } = await phoneOf(chat, parts);
    const models = msgsOf(chat);
    const messages = [];
    for (const m of models.slice(-Math.max(limit * 2, 200))) {
      try {
        messages.push(serializeMsg(m));
      } catch {
        // mensagem ilegível nesta versão: fica de fora
      }
    }
    return {
      store: true,
      chat: {
        id: parts.serialized,
        kind,
        isGroup: kind === 'group',
        title: chatTitle(chat, contact),
        name: str(get(contact, 'name')),
        pushname: str(get(contact, 'pushname')),
        verifiedName: str(get(contact, 'verifiedName')),
        phone,
        phoneFrom: from,
      },
      messages,
      loaded: models.length,
      complete: loadState(chat).noEarlier,
      load,
    };
  }

  // Diagnóstico: só formatos, contagens e sim/não; nenhum nome, número ou texto
  async function diagnose() {
    const chat = activeChat();
    const id = chat ? get(chat, 'id') : null;
    const parts = chat ? widParts(id) : null;
    const phone = chat ? await phoneOf(chat, parts) : { phone: '' };
    let idFormat = null;
    if (id) idFormat = typeof id._serialized === 'string' ? '_serialized' : typeof id.$1 === 'string' ? '$1' : 'outro';
    return {
      version: VERSION,
      whatsappVersion: (window.Debug && typeof window.Debug.VERSION === 'string') ? window.Debug.VERSION : null,
      require: typeof window.require === 'function',
      modules: {
        collections: Boolean(req('WAWebCollections')),
        chat: Boolean(chatCollection()),
        contact: Boolean(contactCollection()),
        apiContact: Boolean(req('WAWebApiContact')),
        loadMessages: Boolean(earlierLoader()),
        lidMigration: Boolean(req('WAWebLidMigrationUtils')),
      },
      activeChat: Boolean(chat),
      kind: chat ? kindOf(chat, parts.server) : null,
      idFormat,
      phoneFound: Boolean(phone.phone),
      loaded: chat ? msgsOf(chat).length : 0,
      complete: chat ? loadState(chat).noEarlier : null,
      loaderForm,
      loaderBroken,
    };
  }

  async function handle(type, payload) {
    if (type === 'ping') return { version: VERSION, store: Boolean(chatCollection()), chat: Boolean(activeChat()) };
    if (type === 'snapshot') return snapshot(payload || {});
    if (type === 'diagnose') return diagnose();
    throw new Error(`pedido desconhecido: ${type}`);
  }

  function post(data) {
    window.postMessage({ source: OUT, ...data }, location.origin);
  }

  function onMessage(event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== IN || typeof data.type !== 'string' || !data.reqId) return;
    handle(data.type, data.payload).then(
      (result) => post({ reqId: data.reqId, ok: true, result }),
      (err) => post({ reqId: data.reqId, ok: false, error: String((err && err.message) || err).slice(0, 200) }),
    );
  }
  window.addEventListener('message', onMessage);

  // Avisa o content script quando a conversa aberta muda ou chega mensagem nova
  let lastChat = null;
  let lastMsg = null;
  function watch() {
    try {
      const chat = activeChat();
      const id = chat ? widString(get(chat, 'id')) : '';
      const models = chat ? msgsOf(chat) : [];
      const lastId = models.length ? widString(get(models[models.length - 1], 'id')) : '';
      if (id !== lastChat) {
        lastChat = id;
        lastMsg = lastId;
        post({ event: 'active-chat', id });
      } else if (lastId !== lastMsg) {
        lastMsg = lastId;
        post({ event: 'messages', id });
      }
    } catch {
      // WhatsApp ainda carregando
    }
  }
  const watcher = setInterval(watch, 1000);
  setTimeout(watch, 0);

  Object.defineProperty(window, KEY, {
    configurable: true,
    value: {
      version: VERSION,
      dispose() {
        clearInterval(watcher);
        window.removeEventListener('message', onMessage);
      },
    },
  });
  try {
    document.documentElement.setAttribute('data-ana-crm-bridge', String(VERSION));
  } catch {
    // sem DOM ainda: o content script trata a ponte como ausente
  }
})();
