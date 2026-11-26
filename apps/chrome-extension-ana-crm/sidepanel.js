// ANA CRM — painel lateral: lê a conversa aberta no WhatsApp Web (via content
// script), deixa o sócio revisar os dados e envia o lead ao CRM.

'use strict';

const W = globalThis.AnaWa;

const DEFAULTS = {
  apiUrl: 'https://crm.anovaadvocacia.ai/api/public/whatsapp-extension-lead',
  extensionKey: '',
  partnerEmail: '',
  messageLimit: 100,
};
const DEFAULT_ORIGIN = 'https://crm.anovaadvocacia.ai';
const WA_URL = 'https://web.whatsapp.com/';
const WA_MATCH = /^https:\/\/web\.whatsapp\.com\//;
const CONTENT_FILES = ['content/wa-parse.js', 'content/wa-capture.js'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REQUEST_TIMEOUT_MS = 30000;
const RETRY_DELAY_MS = 1500;
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const FIELD_IDS = { name: 'f-name', phone: 'f-phone', email: 'f-email', notes: 'f-notes' };

const $ = (id) => document.getElementById(id);

let settings = { ...DEFAULTS };
let waTabId = null;
let chat = null;
let messages = new Map();
let busy = false;
let syncing = false;
let refreshQueued = false;
let edited = new Set(); // campos que o usuário mudou na conversa atual
let draftTimer = null;
let changeTimer = null;
let toastTimer = null;
let lastSyncToken = 0;

class UserError extends Error {}
// falha de rede ou indisponibilidade momentânea: reenviar é seguro (o CRM ignora duplicatas)
class RetryableError extends UserError {}

// ─── Configurações ───

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  settings = { ...DEFAULTS, ...stored, messageLimit: Number(stored.messageLimit) === 50 ? 50 : 100 };
}

function isConfigured() {
  return Boolean(settings.apiUrl && settings.extensionKey && EMAIL_RE.test(settings.partnerEmail || ''));
}

function renderSetupBanner() {
  $('setup-banner').hidden = isConfigured();
}

// ─── WhatsApp Web ───

async function findWhatsAppTab() {
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active && WA_MATCH.test(active.url || '')) return active;
  } catch {
    // sem janela atual (painel em processo de abertura): segue para a busca geral
  }
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  return tabs.find((t) => t.active) || tabs[0] || null;
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (!/Receiving end does not exist|Could not establish connection/i.test(String((err && err.message) || err))) throw err;
    // aba aberta antes da instalação: injeta a captura e tenta de novo
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

function showState(state, detail = '') {
  $('state-no-wa').hidden = state !== 'no-wa';
  $('state-no-chat').hidden = state !== 'no-chat';
  $('state-error').hidden = state !== 'error';
  $('form-lead').hidden = state !== 'ready';
  $('btn-refresh').hidden = state === 'no-wa';

  const dot = $('status-dot');
  const text = $('status-text');
  dot.className = 'status-dot';
  if (state === 'no-wa') {
    dot.classList.add('warn');
    text.textContent = 'WhatsApp Web não está aberto';
  } else if (state === 'no-chat') {
    dot.classList.add('warn');
    text.textContent = 'Nenhuma conversa aberta';
    $('no-chat-text').textContent = detail === 'login'
      ? 'O WhatsApp Web está pedindo o QR code. Conecte o celular e abra uma conversa.'
      : 'Clique em uma conversa no WhatsApp Web. Os dados do contato aparecem aqui na hora.';
  } else if (state === 'error') {
    dot.classList.add('warn');
    text.textContent = 'Erro ao ler a conversa';
    $('error-text').textContent = detail;
  } else if (state === 'ready' && chat) {
    dot.classList.add(chat.isGroup ? 'warn' : 'on');
    text.textContent = '';
    text.append('Conversa ativa: ');
    const strong = document.createElement('strong');
    strong.textContent = chat.title || W.formatPhone(chat.phone) || 'sem nome';
    text.append(strong);
  }
}

function setBusy(on, label) {
  busy = on;
  $('btn-refresh').classList.toggle('spinning', on);
  $('btn-refresh').disabled = on;
  if (on) {
    $('status-dot').className = 'status-dot busy';
    if (label) $('status-text').textContent = label;
  }
  renderSyncButton();
  renderLoadOlder();
}

async function refresh({ loadOlder = false } = {}) {
  if (busy) {
    // uma troca de conversa durante outra leitura não pode ser perdida
    refreshQueued = true;
    return false;
  }
  setBusy(true, loadOlder ? 'Carregando mensagens mais antigas…' : null);
  try {
    const tab = await findWhatsAppTab();
    if (!tab) {
      waTabId = null;
      showState('no-wa');
      return false;
    }
    waTabId = tab.id;
    const res = await sendToTab(tab.id, { type: 'ANA_CAPTURE', limit: settings.messageLimit, loadOlder });
    if (res && res.code === 'chat-changed') {
      refreshQueued = true;
      return false;
    }
    if (!res || !res.ok) throw new Error((res && res.error) || 'O WhatsApp Web não respondeu.');
    if (!res.chat) {
      await flushDraft();
      chat = null;
      messages = new Map();
      showState('no-chat', res.reason);
      return false;
    }
    await applyCapture(res);
    showState('ready');
    return true;
  } catch (err) {
    showState('error', friendlyCaptureError(err));
    return false;
  } finally {
    setBusy(false);
    if (chat && !$('form-lead').hidden) showState('ready');
    if (refreshQueued) {
      refreshQueued = false;
      setTimeout(requestRefresh, 0);
    }
  }
}

function friendlyCaptureError(err) {
  const msg = String((err && err.message) || err);
  if (/Cannot access|cannot be scripted|permission/i.test(msg)) {
    return 'Sem permissão para ler a aba do WhatsApp Web. Recarregue a página do WhatsApp e tente de novo.';
  }
  if (/No tab with id|Tab .* not found/i.test(msg)) return 'A aba do WhatsApp Web foi fechada.';
  return `${msg} Recarregue a página do WhatsApp Web e tente de novo.`;
}

async function applyCapture(res) {
  const incoming = res.chat;
  // conversa aberta antes de as mensagens carregarem: a chave passa de "title:Nome" para o jid
  if (chat && chat.key !== incoming.key && chat.key.startsWith('title:') && incoming.key
      && !incoming.key.startsWith('title:') && chat.title === incoming.title) {
    await moveDraft(chat.key, incoming.key);
    chat.key = incoming.key;
  }
  const changed = !chat || chat.key !== incoming.key;
  if (changed) {
    await flushDraft();
    chat = { ...incoming };
    messages = new Map();
    hideResult();
    hideFormError();
    await fillFormForChat();
  } else {
    const keepSource = ['profile', 'manual'].includes(chat.phoneSource) ? chat.phoneSource : incoming.phoneSource;
    chat = { ...chat, ...incoming, phoneSource: keepSource || chat.phoneSource };
    if (!$('f-phone').value.trim() && incoming.phone) $('f-phone').value = W.formatPhone(incoming.phone);
  }
  res.messages.forEach((m, i) => messages.set(m.external_id, { ...m, seq: i }));
  trimMessages();
  $('group-banner').hidden = !chat.isGroup;
  renderPhoneHint();
  renderMessages();
  await renderLastSync();
}

// ─── Rascunho por contato (não perde notas ao trocar de conversa) ───

const draftKey = (key) => `draft:${key}`;

// Guarda só os campos que o usuário mudou: o que não foi editado continua vindo
// do WhatsApp (ex.: o contato renomeado aparece com o nome novo).
async function fillFormForChat() {
  const stored = await chrome.storage.local.get(draftKey(chat.key));
  const draft = stored[draftKey(chat.key)];
  const fields = draft ? draft.fields || { name: draft.name, phone: draft.phone, email: draft.email, notes: draft.notes } : {};
  edited = new Set(Object.keys(FIELD_IDS).filter((f) => fields[f] != null));
  $('f-name').value = fields.name != null ? fields.name : chat.name || '';
  $('f-phone').value = fields.phone ? fields.phone : W.formatPhone(chat.phone);
  $('f-email').value = fields.email || '';
  $('f-notes').value = fields.notes || '';
  if (draft && draft.phoneSource && fields.phone) chat.phoneSource = draft.phoneSource;
  for (const id of Object.values(FIELD_IDS)) $(id).classList.remove('is-invalid');
}

function markEdited(field) {
  edited.add(field);
  scheduleDraftSave();
}

function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(flushDraft, 400);
}

async function flushDraft() {
  clearTimeout(draftTimer);
  draftTimer = null;
  if (!chat || !chat.key || !edited.size) return;
  const fields = {};
  for (const f of edited) fields[f] = $(FIELD_IDS[f]).value;
  await chrome.storage.local.set({
    [draftKey(chat.key)]: { fields, phoneSource: chat.phoneSource || '', updatedAt: Date.now() },
  });
}

async function moveDraft(fromKey, toKey) {
  const stored = await chrome.storage.local.get([draftKey(fromKey), draftKey(toKey)]);
  if (stored[draftKey(fromKey)] && !stored[draftKey(toKey)]) {
    await chrome.storage.local.set({ [draftKey(toKey)]: stored[draftKey(fromKey)] });
  }
  await chrome.storage.local.remove(draftKey(fromKey));
}

async function cleanupOldDrafts() {
  const all = await chrome.storage.local.get(null);
  const old = Object.entries(all)
    .filter(([k, v]) => k.startsWith('draft:') && (!v || !v.updatedAt || Date.now() - v.updatedAt > DRAFT_MAX_AGE_MS))
    .map(([k]) => k);
  if (old.length) await chrome.storage.local.remove(old);
}

// ─── Mensagens ───

function sortedMessages() {
  return [...messages.values()].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : (a.seq || 0) - (b.seq || 0));
}

function trimMessages() {
  const sorted = sortedMessages();
  if (sorted.length <= settings.messageLimit) return;
  for (const m of sorted.slice(0, sorted.length - settings.messageLimit)) messages.delete(m.external_id);
}

function fmtShort(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

function renderMessages() {
  const list = sortedMessages();
  $('msg-count').textContent = String(list.length);
  const fromLead = list.filter((m) => !m.from_me).length;
  const breakdown = $('msg-breakdown');
  if (list.length) {
    breakdown.textContent = `${fromLead} do lead · ${list.length - fromLead} suas · ${fmtShort(list[0].timestamp)} a ${fmtShort(list[list.length - 1].timestamp)}`;
  } else {
    breakdown.textContent = 'Nenhuma mensagem visível nesta conversa.';
  }

  const ol = $('msg-list');
  ol.textContent = '';
  for (const m of list) {
    const li = document.createElement('li');
    li.className = `msg${m.from_me ? ' from-me' : ''}`;
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    const who = document.createElement('span');
    who.className = 'msg-who';
    who.textContent = m.from_me ? 'Você' : 'Lead';
    const time = document.createElement('time');
    time.dateTime = m.timestamp;
    time.textContent = (m.approx ? '≈ ' : '') + fmtShort(m.timestamp);
    meta.append(who, time);
    const text = document.createElement('p');
    text.className = 'msg-text';
    text.textContent = m.text;
    li.append(meta, text);
    ol.appendChild(li);
  }
  $('msg-preview').hidden = list.length === 0;
  renderLoadOlder();
}

function renderLoadOlder() {
  const btn = $('btn-load-older');
  const full = messages.size >= settings.messageLimit;
  btn.disabled = busy || full;
  $('btn-load-older-label').textContent = full
    ? `Limite de ${settings.messageLimit} mensagens atingido`
    : `Buscar mensagens mais antigas (até ${settings.messageLimit})`;
}

// ─── Telefone ───

function renderPhoneHint() {
  const hint = $('phone-hint');
  const lookup = $('btn-lookup-phone');
  hint.className = 'field-hint';
  lookup.hidden = true;
  if (!chat) return;
  const typed = W.normalizePhone($('f-phone').value);
  const detected = W.isValidPhone(typed);
  if (chat.phoneSource === 'jid' && detected) {
    hint.textContent = 'Identificado pelo número da conversa no WhatsApp.';
    hint.classList.add('ok');
  } else if (chat.phoneSource === 'header' && detected) {
    hint.textContent = 'Identificado no cabeçalho da conversa (contato não salvo).';
    hint.classList.add('ok');
  } else if (chat.phoneSource === 'profile' && detected) {
    hint.textContent = 'Encontrado no perfil do contato.';
    hint.classList.add('ok');
  } else if (detected) {
    hint.textContent = 'Digitado manualmente.';
  } else if (chat.isLid) {
    hint.textContent = 'Este contato usa o identificador privado do WhatsApp, e o número não aparece na conversa. Busque no perfil ou digite com DDD.';
    hint.classList.add('warn');
    lookup.hidden = false;
  } else {
    hint.textContent = 'Número não identificado. Busque no perfil ou digite com DDD.';
    hint.classList.add('warn');
    lookup.hidden = false;
  }
}

async function onLookupPhone() {
  if (!waTabId || !chat) return;
  const btn = $('btn-lookup-phone');
  const keyBefore = chat.key;
  btn.disabled = true;
  try {
    const res = await sendToTab(waTabId, { type: 'ANA_LOOKUP_PHONE' });
    if (!chat || chat.key !== keyBefore) return;
    if (res && res.phone && W.isValidPhone(res.phone)) {
      $('f-phone').value = W.formatPhone(res.phone);
      chat.phoneSource = 'profile';
      $('f-phone').classList.remove('is-invalid');
      renderPhoneHint();
      markEdited('phone');
      renderLastSync();
      showToast('Telefone encontrado no perfil do contato');
    } else {
      showToast('Não encontrei o telefone no perfil. Digite manualmente.', true);
    }
  } catch (err) {
    showToast(friendlyCaptureError(err), true);
  } finally {
    btn.disabled = false;
  }
}

// ─── Última sincronização deste contato ───

const syncKey = (phone) => `sync:${phone}`;

async function renderLastSync() {
  const token = ++lastSyncToken;
  const el = $('last-sync');
  const phone = W.normalizePhone($('f-phone').value);
  if (!W.isValidPhone(phone)) {
    el.hidden = true;
    return;
  }
  const stored = await chrome.storage.local.get(syncKey(phone));
  if (token !== lastSyncToken) return;
  const last = stored[syncKey(phone)];
  if (!last) {
    el.hidden = true;
    return;
  }
  el.textContent = `Última sincronização: ${new Date(last.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
  if (Array.isArray(last.ids)) {
    const sent = new Set(last.ids);
    const pending = sortedMessages().filter((m) => !sent.has(m.external_id)).length;
    const note = document.createElement('strong');
    note.className = pending ? 'pending' : 'up-to-date';
    note.textContent = pending
      ? ` · ${pending} ${pending === 1 ? 'mensagem ainda não enviada' : 'mensagens ainda não enviadas'}`
      : ' · tudo já enviado';
    el.append(note);
  }
  if (last.url) {
    el.append(' · ');
    const a = document.createElement('a');
    a.href = last.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'abrir card';
    el.append(a);
  }
  el.hidden = false;
}

// ─── Sincronização ───

function renderSyncButton() {
  const btn = $('btn-sync');
  btn.disabled = busy || syncing || Boolean(chat && chat.isGroup);
  btn.classList.toggle('is-busy', syncing);
  $('btn-sync-label').textContent = syncing ? 'Sincronizando…' : 'Sincronizar Lead no CRM';
}

function renderSendingAs() {
  const ok = isConfigured();
  $('sending-as').hidden = !ok;
  if (ok) $('sending-as-email').textContent = settings.partnerEmail;
}

function showFormError(message, fieldId) {
  const el = $('form-error');
  el.textContent = message;
  el.hidden = false;
  if (fieldId) {
    $(fieldId).classList.add('is-invalid');
    $(fieldId).focus();
  }
}

function hideFormError() {
  $('form-error').hidden = true;
}

function hideResult() {
  $('result').hidden = true;
}

function buildPayload({ name, phone, email, notes }) {
  const contact = { name, phone };
  if (email) contact.email = email;
  return {
    partner_email: settings.partnerEmail.trim(),
    contact,
    notes,
    messages: sortedMessages().map(({ external_id, from_me, text, timestamp }) => ({ external_id, from_me, text, timestamp })),
  };
}

function httpErrorMessage(status, data) {
  const server = data && (data.error || data.message || data.detail);
  const detail = typeof server === 'string' ? server : server ? JSON.stringify(server) : '';
  if (status === 401 || status === 403) {
    return `O CRM recusou a chave de integração. Confira a chave em Configurações.${detail ? ` (${detail})` : ''}`;
  }
  if (status === 404) return 'Endereço da API não encontrado (404). Confira a URL em Configurações.';
  if (status === 400 || status === 422) return `O CRM recusou os dados enviados: ${detail || 'formato inválido'}.`;
  if (status === 429) return 'Muitas sincronizações seguidas. Aguarde um pouco e tente de novo.';
  if (status >= 500) return `O CRM teve um erro interno (${status}). Tente de novo em instantes.`;
  return `O CRM respondeu com erro ${status}${detail ? `: ${detail}` : ''}.`;
}

function networkError(err) {
  if (err && err.name === 'AbortError') {
    return new RetryableError('O CRM demorou mais de 30 segundos para responder. Tente de novo.');
  }
  return new RetryableError(`Não foi possível conectar ao CRM (${new URL(settings.apiUrl).host}). Verifique a internet e a URL da API.`);
}

async function postOnce(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response;
    let raw = '';
    try {
      response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-extension-key': settings.extensionKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      raw = await response.text();
    } catch (err) {
      throw networkError(err);
    }
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message = httpErrorMessage(response.status, data);
      throw [502, 503, 504].includes(response.status) ? new RetryableError(message) : new UserError(message);
    }
    return data || {};
  } finally {
    clearTimeout(timer);
  }
}

async function postLead(payload) {
  try {
    return await postOnce(payload);
  } catch (err) {
    if (!(err instanceof RetryableError)) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return postOnce(payload);
  }
}

function bookingIdFrom(data) {
  const candidates = [
    data.booking_id, data.bookingId,
    data.data && (data.data.booking_id || data.data.bookingId),
    data.booking && (data.booking.id || data.booking.booking_id),
    data.lead && (data.lead.booking_id || data.lead.bookingId),
  ];
  const found = candidates.find((v) => v != null && String(v).trim() !== '');
  return found != null ? String(found) : '';
}

function cardUrlFor(bookingId, data) {
  if (bookingId) return `${new URL(settings.apiUrl).origin}/admin/pipeline?booking=${encodeURIComponent(bookingId)}`;
  const fromServer = [data.url, data.card_url, data.booking_url].find((u) => typeof u === 'string' && /^https:\/\//.test(u));
  return fromServer || '';
}

function countFrom(data, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((obj, k) => (obj == null ? obj : obj[k]), data);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

async function onSync(event) {
  event.preventDefault();
  if (syncing || busy) return;
  hideResult();
  hideFormError();
  for (const id of ['f-name', 'f-phone', 'f-email']) $(id).classList.remove('is-invalid');

  if (!isConfigured()) {
    openSettings(true);
    return;
  }
  if (!chat) return;
  if (chat.isGroup) {
    showFormError('Conversas em grupo não são sincronizadas. Abra a conversa individual com o lead.');
    return;
  }

  const name = $('f-name').value.trim();
  const phone = W.normalizePhone($('f-phone').value);
  const email = $('f-email').value.trim();
  const notes = $('f-notes').value.trim();
  if (!name) return showFormError('Informe o nome do contato.', 'f-name');
  if (!W.isValidPhone(phone)) return showFormError('Informe um telefone válido com DDD, por exemplo +55 (11) 98765-4321.', 'f-phone');
  if (email && !EMAIL_RE.test(email)) return showFormError('O e-mail do lead não parece válido.', 'f-email');

  // lê de novo a conversa (sem rolar) para incluir mensagens que chegaram agora
  const keyBefore = chat.key;
  const fresh = await refresh();
  if (!fresh || !chat || chat.key !== keyBefore) {
    if (chat && !$('form-lead').hidden) {
      showFormError('A conversa aberta no WhatsApp mudou. Confira os dados e sincronize de novo.');
    }
    return;
  }

  syncing = true;
  renderSyncButton();
  try {
    const payload = buildPayload({ name, phone, email, notes });
    const data = await postLead(payload);
    const bookingId = bookingIdFrom(data);
    const url = cardUrlFor(bookingId, data);
    await chrome.storage.local.set({
      [syncKey(phone)]: {
        at: Date.now(),
        bookingId,
        url,
        count: payload.messages.length,
        ids: payload.messages.map((m) => m.external_id),
      },
    });
    $('f-phone').value = W.formatPhone(phone);
    await flushDraft();
    showResult(payload.messages.length, data, url);
    await renderLastSync();
  } catch (err) {
    showFormError(err instanceof UserError ? err.message : `Erro inesperado: ${String((err && err.message) || err)}`);
  } finally {
    syncing = false;
    renderSyncButton();
    if (refreshQueued) {
      refreshQueued = false;
      refresh();
    }
  }
}

function showResult(sentCount, data, url) {
  const inserted = countFrom(data, ['messages_inserted', 'inserted', 'messages.inserted', 'data.messages_inserted']);
  const duplicates = countFrom(data, ['messages_skipped', 'duplicates', 'skipped', 'messages.duplicates', 'data.messages_skipped']);
  let text = `${sentCount} ${sentCount === 1 ? 'mensagem enviada' : 'mensagens enviadas'}`;
  if (inserted != null) {
    text += ` · ${inserted} ${inserted === 1 ? 'nova' : 'novas'}`;
    if (duplicates != null) text += `, ${duplicates} já ${duplicates === 1 ? 'estava' : 'estavam'} no CRM`;
  }
  $('result-title').textContent = 'Lead sincronizado no CRM';
  $('result-text').textContent = `${text}.`;
  const link = $('result-link');
  if (url) {
    link.href = url;
    link.hidden = false;
  } else {
    link.hidden = true;
  }
  $('result').hidden = false;
  $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Tela de configurações ───

function openSettings(fromSync = false) {
  $('s-api').value = settings.apiUrl;
  $('s-key').value = settings.extensionKey;
  $('s-email').value = settings.partnerEmail;
  $('s-limit').value = String(settings.messageLimit);
  $('settings-intro').hidden = !fromSync;
  $('settings-error').hidden = true;
  $('view-main').hidden = true;
  $('view-settings').hidden = false;
  const firstEmpty = ['s-api', 's-key', 's-email'].find((id) => !$(id).value.trim());
  $(firstEmpty || 's-api').focus();
}

function closeSettings() {
  $('view-settings').hidden = true;
  $('view-main').hidden = false;
}

function settingsError(message, fieldId) {
  const el = $('settings-error');
  el.textContent = message;
  el.hidden = false;
  if (fieldId) $(fieldId).focus();
}

async function onSaveSettings(event) {
  event.preventDefault();
  const apiUrl = $('s-api').value.trim();
  const extensionKey = $('s-key').value.trim();
  const partnerEmail = $('s-email').value.trim();
  const messageLimit = Number($('s-limit').value) === 50 ? 50 : 100;

  let url;
  try {
    url = new URL(apiUrl);
  } catch {
    settingsError('A URL da API não é válida.', 's-api');
    return;
  }
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
    settingsError('Use uma URL com https:// (http só é aceito para localhost).', 's-api');
    return;
  }
  if (!extensionKey) {
    settingsError('Informe a chave de integração.', 's-key');
    return;
  }
  if (!EMAIL_RE.test(partnerEmail)) {
    settingsError('Informe um e-mail válido para o sócio ou closer.', 's-email');
    return;
  }

  // outro servidor (ex.: homologação): pede acesso ao host no mesmo clique do usuário
  if (url.origin !== DEFAULT_ORIGIN) {
    const origins = [`${url.protocol}//${url.hostname}/*`];
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins });
    } catch {
      granted = false;
    }
    if (!granted) {
      settingsError(`Sem permissão para acessar ${url.host}. Clique em Salvar e autorize o acesso quando o Chrome pedir.`);
      return;
    }
  }

  await chrome.storage.sync.set({ apiUrl, extensionKey, partnerEmail, messageLimit });
  settings = { apiUrl, extensionKey, partnerEmail, messageLimit };
  renderSetupBanner();
  renderSendingAs();
  trimMessages();
  renderMessages();
  closeSettings();
  showToast('Configurações salvas');
}

async function onDiagnose() {
  try {
    const tab = await findWhatsAppTab();
    if (!tab) {
      showToast('Abra o WhatsApp Web para gerar o diagnóstico.', true);
      return;
    }
    const res = await sendToTab(tab.id, { type: 'ANA_DIAGNOSE' });
    const report = JSON.stringify({ geradoEm: new Date().toISOString(), ...res }, null, 2);
    await navigator.clipboard.writeText(report);
    showToast('Diagnóstico copiado');
  } catch (err) {
    showToast(friendlyCaptureError(err), true);
  }
}

// ─── Aviso ───

function showToast(message, isError = false) {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast${isError ? ' toast-error' : ''}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, isError ? 4000 : 2400);
}

// ─── Eventos do navegador ───

// Durante um envio, a releitura espera: onSync a executa ao terminar.
function requestRefresh() {
  if (syncing) {
    refreshQueued = true;
    return;
  }
  refresh();
}

function scheduleRefresh(delay = 700) {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(requestRefresh, delay);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'ANA_CHAT_CHANGED' || !sender.tab) return;
  if (waTabId == null || sender.tab.id === waTabId) scheduleRefresh();
});

chrome.tabs.onActivated.addListener(() => scheduleRefresh(300));
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && (tabId === waTabId || WA_MATCH.test(tab.url || ''))) scheduleRefresh(1500);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === waTabId) scheduleRefresh(100);
});

// ─── Início ───

document.addEventListener('DOMContentLoaded', async () => {
  $('version').textContent = `ANA CRM v${chrome.runtime.getManifest().version}`;
  await loadSettings();
  renderSetupBanner();
  renderSendingAs();
  cleanupOldDrafts();

  $('btn-settings').addEventListener('click', () => openSettings(false));
  $('btn-change-sender').addEventListener('click', () => openSettings(false));
  $('btn-setup').addEventListener('click', () => openSettings(false));
  $('btn-back').addEventListener('click', closeSettings);
  $('form-settings').addEventListener('submit', onSaveSettings);
  $('btn-diagnose').addEventListener('click', onDiagnose);
  $('btn-toggle-key').addEventListener('click', () => {
    const input = $('s-key');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('btn-toggle-key').setAttribute('aria-label', show ? 'Ocultar chave' : 'Mostrar chave');
  });

  $('btn-refresh').addEventListener('click', () => refresh());
  $('btn-retry').addEventListener('click', () => refresh());
  $('btn-load-older').addEventListener('click', () => refresh({ loadOlder: true }));
  $('btn-lookup-phone').addEventListener('click', onLookupPhone);
  $('btn-open-wa').addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (tabs[0]) await chrome.tabs.update(tabs[0].id, { active: true });
    else await chrome.tabs.create({ url: WA_URL });
  });

  $('msg-preview').addEventListener('toggle', () => {
    if ($('msg-preview').open) $('msg-list').scrollTop = $('msg-list').scrollHeight;
  });

  $('form-lead').addEventListener('submit', onSync);
  $('form-lead').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      $('form-lead').requestSubmit();
    }
  });
  for (const [field, id] of Object.entries(FIELD_IDS)) {
    $(id).addEventListener('input', () => {
      $(id).classList.remove('is-invalid');
      markEdited(field);
    });
  }
  $('f-phone').addEventListener('input', () => {
    if (chat && chat.phoneSource) chat.phoneSource = 'manual';
  });
  $('f-phone').addEventListener('blur', () => {
    const phone = W.normalizePhone($('f-phone').value);
    if (W.isValidPhone(phone)) $('f-phone').value = W.formatPhone(phone);
    renderPhoneHint();
    renderLastSync();
    scheduleDraftSave();
  });

  window.addEventListener('pagehide', () => {
    flushDraft();
  });

  await refresh();
});
