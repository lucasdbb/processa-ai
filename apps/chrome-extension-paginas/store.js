// Páginas Salvas — camada de armazenamento compartilhada (popup, página e
// service worker).
//
// Cada página salva é uma chave própria em chrome.storage.sync ("s_<id>"),
// com campos de nome curto. O sync limita 100 KB no total, 8 KB por chave,
// 512 chaves e ~120 gravações por minuto; uma chave por página evita que
// dois computadores sobrescrevam a lista inteira um do outro.
// Quando o espaço do sync acaba, a página vai para chrome.storage.local
// (só neste computador) e rebalance() a devolve ao sync quando houver espaço.

'use strict';

const Store = (() => {
  const PREFIX = 's_';
  const SYNC = chrome.storage.sync;
  const LOCAL = chrome.storage.local;
  const QUOTA_BYTES = SYNC.QUOTA_BYTES || 102400;
  const MAX_ITEMS = SYNC.MAX_ITEMS || 512;
  const BYTES_MARGIN = 2048;
  const ITEMS_MARGIN = 8;
  const LIMITS = { url: 4000, title: 300, note: 1000, category: 40 };
  const encoder = new TextEncoder();

  function newId() {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return Date.now().toString(36) + rand;
  }

  function clean(value, max) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function sanitize(item) {
    const url = clean(item.url, LIMITS.url);
    return {
      id: item.id,
      url,
      title: clean(item.title, LIMITS.title) || url,
      note: clean(item.note, LIMITS.note),
      category: clean(item.category, LIMITS.category),
      createdAt: Number(item.createdAt) || Date.now(),
      read: Boolean(item.read),
    };
  }

  function encode(item) {
    const value = { u: item.url, t: item.title, a: item.createdAt };
    if (item.note) value.n = item.note;
    if (item.category) value.c = item.category;
    if (item.read) value.r = 1;
    return value;
  }

  function decode(key, value, area) {
    return {
      id: key.slice(PREFIX.length),
      url: String(value.u || ''),
      title: String(value.t || value.u || ''),
      note: value.n ? String(value.n) : '',
      category: value.c ? String(value.c) : '',
      createdAt: Number(value.a) || 0,
      read: value.r === 1,
      area,
    };
  }

  function sizeOf(key, value) {
    return encoder.encode(key).length + encoder.encode(JSON.stringify(value)).length;
  }

  // Falta de espaço (total, por chave ou número de chaves)
  function isSpaceError(err) {
    return /QUOTA_BYTES|MAX_ITEMS/i.test(String((err && err.message) || err));
  }

  // Qualquer cota do sync, inclusive o limite de gravações por minuto
  function isQuotaError(err) {
    return /quota/i.test(String((err && err.message) || err));
  }

  async function all() {
    const [syncData, localData] = await Promise.all([SYNC.get(null), LOCAL.get(null)]);
    const byId = new Map();
    for (const [key, value] of Object.entries(syncData)) {
      if (key.startsWith(PREFIX) && value) byId.set(key, decode(key, value, 'sync'));
    }
    for (const [key, value] of Object.entries(localData)) {
      // se uma mudança de área foi interrompida, a cópia do sync prevalece
      if (key.startsWith(PREFIX) && value && !byId.has(key)) byId.set(key, decode(key, value, 'local'));
    }
    return [...byId.values()];
  }

  async function add(fields) {
    const item = sanitize({ ...fields, id: newId(), createdAt: Date.now(), read: false });
    const key = PREFIX + item.id;
    const value = encode(item);
    try {
      await SYNC.set({ [key]: value });
      return { ...item, area: 'sync' };
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      await LOCAL.set({ [key]: value });
      return { ...item, area: 'local' };
    }
  }

  async function addMany(list) {
    let bytes = await SYNC.getBytesInUse(null);
    let count = Object.keys(await SYNC.get(null)).length;
    const toSync = {};
    const toLocal = {};
    for (const fields of list) {
      const item = sanitize({ ...fields, id: newId() });
      const key = PREFIX + item.id;
      const value = encode(item);
      const size = sizeOf(key, value);
      if (bytes + size <= QUOTA_BYTES - BYTES_MARGIN && count + 1 <= MAX_ITEMS - ITEMS_MARGIN) {
        toSync[key] = value;
        bytes += size;
        count += 1;
      } else {
        toLocal[key] = value;
      }
    }
    let synced = Object.keys(toSync).length;
    if (synced) {
      try {
        await SYNC.set(toSync);
      } catch (err) {
        if (!isQuotaError(err)) throw err;
        Object.assign(toLocal, toSync);
        synced = 0;
      }
    }
    const localCount = Object.keys(toLocal).length;
    if (localCount) await LOCAL.set(toLocal);
    return { sync: synced, local: localCount };
  }

  async function update(item, changes) {
    const next = sanitize({ ...item, ...changes, id: item.id });
    const key = PREFIX + item.id;
    const value = encode(next);
    if (item.area === 'local') {
      await LOCAL.set({ [key]: value });
      return { ...next, area: 'local' };
    }
    try {
      await SYNC.set({ [key]: value });
      return { ...next, area: 'sync' };
    } catch (err) {
      if (!isSpaceError(err)) throw err;
      // a nota cresceu e não cabe mais no sync: a página passa a ser local
      await LOCAL.set({ [key]: value });
      await SYNC.remove(key);
      return { ...next, area: 'local' };
    }
  }

  async function remove(items) {
    const list = Array.isArray(items) ? items : [items];
    const syncKeys = list.filter((i) => i.area === 'sync').map((i) => PREFIX + i.id);
    const localKeys = list.filter((i) => i.area !== 'sync').map((i) => PREFIX + i.id);
    if (syncKeys.length) await SYNC.remove(syncKeys);
    if (localKeys.length) await LOCAL.remove(localKeys);
  }

  // Move páginas locais (as mais antigas primeiro) para o sync enquanto houver espaço
  async function rebalance() {
    const items = await all();
    const local = items.filter((i) => i.area === 'local').sort((a, b) => a.createdAt - b.createdAt);
    if (!local.length) return 0;
    let bytes = await SYNC.getBytesInUse(null);
    let count = Object.keys(await SYNC.get(null)).length;
    const batch = {};
    const moved = [];
    for (const item of local) {
      const key = PREFIX + item.id;
      const value = encode(item);
      const size = sizeOf(key, value);
      if (bytes + size > QUOTA_BYTES - BYTES_MARGIN || count + 1 > MAX_ITEMS - ITEMS_MARGIN) break;
      batch[key] = value;
      moved.push(key);
      bytes += size;
      count += 1;
    }
    if (!moved.length) return 0;
    try {
      await SYNC.set(batch);
    } catch {
      return 0;
    }
    await LOCAL.remove(moved);
    return moved.length;
  }

  async function usage() {
    const bytes = await SYNC.getBytesInUse(null);
    return { bytes, quota: QUOTA_BYTES };
  }

  function sameUrl(a, b) {
    const norm = (u) => String(u || '').replace(/\/+$/, '');
    return norm(a) === norm(b);
  }

  async function openListPage() {
    const url = chrome.runtime.getURL('pages.html');
    try {
      const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] });
      const existing = contexts.find((c) => c.tabId >= 0);
      if (existing) {
        await chrome.tabs.update(existing.tabId, { active: true });
        await chrome.windows.update(existing.windowId, { focused: true });
        return;
      }
    } catch {
      // sem getContexts: abre uma aba nova
    }
    await chrome.tabs.create({ url });
  }

  function friendlyError(err) {
    const msg = String((err && err.message) || err);
    if (/MAX_WRITE_OPERATIONS/i.test(msg)) {
      return 'O Chrome limita a frequência de sincronização. Aguarde um minuto e tente de novo.';
    }
    return `Não foi possível salvar: ${msg}`;
  }

  return {
    PREFIX,
    LIMITS,
    all,
    add,
    addMany,
    update,
    remove,
    rebalance,
    usage,
    sameUrl,
    openListPage,
    friendlyError,
  };
})();
