// Páginas Salvas — popup: salva (ou atualiza) a página da aba ativa.
// activeTab é concedida pelo clique no ícone, o que libera url e título da aba.

'use strict';

const $ = (id) => document.getElementById(id);

let targetTab = null;
let existing = null;

function isSavable(url) {
  return /^(https?|file):/i.test(url || '');
}

function faviconUrl(pageUrl, size = 32) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}

function hostOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'file:' ? 'Arquivo local' : u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function show(stateId) {
  for (const id of ['state-form', 'state-done', 'state-blocked']) $(id).hidden = id !== stateId;
}

async function renderFooter(items) {
  $('list-count').textContent = items.length ? `(${items.length})` : '';
  const status = $('sync-status');
  try {
    const [{ bytes, quota }, devices] = await Promise.all([Store.usage(), Store.devices()]);
    const pct = Math.round((bytes / quota) * 100);
    const localCount = items.filter((i) => i.area === 'local').length;
    const others = devices.filter((d) => !d.isThis).length;
    status.classList.remove('warn');
    if (localCount) {
      status.textContent = `${localCount} só neste computador`;
      status.classList.add('warn');
    } else if (pct >= 80) {
      status.textContent = `Espaço de sincronização ${pct}% cheio`;
      status.classList.add('warn');
    } else if (others) {
      status.textContent = others === 1 ? 'Sincronizando com 1 computador' : `Sincronizando com ${others} computadores`;
    } else {
      status.textContent = 'Sem outro computador ainda';
      status.title = 'Abra "Ver páginas salvas" para ver como ligar a sincronização';
    }
  } catch {
    status.textContent = '';
  }
}

async function onSubmit(event) {
  event.preventDefault();
  const btn = $('btn-save');
  const errorEl = $('form-error');
  errorEl.hidden = true;
  btn.disabled = true;

  const fields = {
    url: targetTab.url,
    title: $('f-title').value.trim() || targetTab.url,
    category: $('f-category').value.trim(),
    note: $('f-note').value.trim(),
  };

  try {
    const saved = existing ? await Store.update(existing, fields) : await Store.add(fields);
    const isLocal = saved.area === 'local';
    $('done-title').textContent = existing ? 'Página atualizada' : 'Página salva';
    $('done-text').textContent = isLocal
      ? 'Salva só neste computador: o espaço de sincronização do Chrome (100 KB) está cheio. Exclua páginas lidas para liberar espaço e ela será sincronizada sozinha.'
      : 'A aba continua aberta. Você encontra tudo em “Ver páginas salvas”.';
    $('state-done').classList.toggle('is-local', isLocal);
    show('state-done');
    renderFooter(await Store.all());
    setTimeout(() => window.close(), isLocal ? 4000 : 1100);
  } catch (err) {
    btn.disabled = false;
    errorEl.textContent = Store.friendlyError(err);
    errorEl.hidden = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('btn-open-list').addEventListener('click', async () => {
    await Store.openListPage();
    window.close();
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  targetTab = tab || null;
  const items = await Store.all();
  renderFooter(items);

  if (!targetTab || !isSavable(targetTab.url)) {
    show('state-blocked');
    return;
  }

  existing = items.find((i) => Store.sameUrl(i.url, targetTab.url)) || null;

  $('favicon').src = faviconUrl(targetTab.url);
  $('favicon').addEventListener('error', () => { $('favicon').hidden = true; });
  $('page-host').textContent = hostOf(targetTab.url);
  $('page-url').textContent = targetTab.url;
  $('page-url').title = targetTab.url;

  $('f-title').value = existing ? existing.title : targetTab.title || targetTab.url;
  $('f-category').value = existing ? existing.category : '';
  $('f-note').value = existing ? existing.note : '';

  if (existing) {
    $('already').textContent = `Já salva em ${fmtDate(existing.createdAt)} — salvar atualiza os dados`;
    $('already').hidden = false;
    $('btn-save-label').textContent = 'Atualizar página';
  }

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat;
    $('category-options').appendChild(opt);
  }

  $('form').addEventListener('submit', onSubmit);
  $('f-note').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('form').requestSubmit();
  });

  show('state-form');
  // foco no botão: abrir o popup + Enter já salva
  $('btn-save').focus();
});
