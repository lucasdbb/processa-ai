// Páginas Salvas — página de lista: busca, filtros por status e categoria,
// agrupamento por data, lido/não lido, edição inline, exclusão, medidor de
// sincronização e exportar/importar JSON. Atualiza ao vivo quando outra
// janela ou outro computador (via sync) altera os dados.

'use strict';

const $ = (id) => document.getElementById(id);

let items = [];
const state = { query: '', status: 'all', category: null, sort: 'newest' };
let editingId = null;
let pendingRefresh = false;
let deleteArmedId = null;
let deleteArmedTimer = null;
let clearArmed = false;
let clearArmedTimer = null;
let refreshTimer = null;
let toastTimer = null;

const ICONS = {
  read: 'M20 6 9 17l-5-5',
  unread: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  edit: 'M17 3.5a2.1 2.1 0 0 1 3 3L8.5 18 4 19.5 5.5 15 17 3.5Z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
};

// ─── Helpers ───

function icon(pathD) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'i');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function isOpenable(url) {
  return /^(https?|file):/i.test(url || '');
}

function hostOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'file:' ? 'arquivo local' : u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconUrl(pageUrl, size = 32) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}

const DAY = 86400000;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function groupLabel(ts) {
  const today = startOfToday();
  if (ts >= today) return 'Hoje';
  if (ts >= today - DAY) return 'Ontem';
  if (ts >= today - 6 * DAY) return 'Últimos 7 dias';
  const d = new Date(ts);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'Este mês';
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fmtWhen(ts) {
  const d = new Date(ts);
  if (ts >= startOfToday()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('pt-BR', sameYear ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// ─── Filtro e ordenação ───

function matchesQueryAndCategory(it) {
  if (state.category && it.category !== state.category) return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${it.title}\n${it.url}\n${hostOf(it.url)}\n${it.note}\n${it.category}`.toLowerCase();
  return q.split(/\s+/).every((term) => hay.includes(term));
}

function visibleItems() {
  const list = items.filter((it) => {
    if (state.status === 'unread' && it.read) return false;
    if (state.status === 'read' && !it.read) return false;
    return matchesQueryAndCategory(it);
  });
  if (state.sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }));
  else if (state.sort === 'oldest') list.sort((a, b) => a.createdAt - b.createdAt);
  else list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

// ─── Render ───

function render() {
  renderStatusCounts();
  renderChips();
  renderList();
  renderFooter();
}

function renderStatusCounts() {
  const base = items.filter(matchesQueryAndCategory);
  const unread = base.filter((i) => !i.read).length;
  $('count-all').textContent = base.length;
  $('count-unread').textContent = unread;
  $('count-read').textContent = base.length - unread;
  for (const btn of document.querySelectorAll('.segmented button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.status === state.status));
  }
}

function renderChips() {
  const chips = $('chips');
  chips.textContent = '';
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (state.category && !categories.includes(state.category)) state.category = null;
  if (!categories.length) return;

  const mk = (label, value) => {
    const b = el('button', 'chip', label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(state.category === value));
    b.addEventListener('click', () => {
      state.category = state.category === value || value === null ? null : value;
      render();
    });
    chips.appendChild(b);
  };
  mk('Todas as categorias', null);
  for (const cat of categories) mk(cat, cat);
}

function renderList() {
  const list = $('list');
  list.textContent = '';
  const visible = visibleItems();

  $('empty-state').hidden = items.length > 0;
  $('no-results').hidden = items.length === 0 || visible.length > 0;
  list.hidden = visible.length === 0;

  if (state.sort === 'az') {
    list.appendChild(groupEl(null, visible));
    return;
  }
  const groups = [];
  for (const it of visible) {
    const label = groupLabel(it.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }
  for (const g of groups) list.appendChild(groupEl(g.label, g.items));
}

function groupEl(label, groupItems) {
  const section = el('section', 'group');
  if (label) {
    const h = el('h2', 'group-label', label);
    h.appendChild(el('span', 'group-count', String(groupItems.length)));
    section.appendChild(h);
  }
  const box = el('div', 'group-items');
  for (const it of groupItems) box.appendChild(it.id === editingId ? editRowEl(it) : rowEl(it));
  section.appendChild(box);
  return section;
}

function rowEl(it) {
  const row = el('article', `row${it.read ? ' is-read' : ''}`);

  if (isOpenable(it.url) && !it.url.startsWith('file:')) {
    const img = el('img', 'favicon');
    img.alt = '';
    img.loading = 'lazy';
    img.src = faviconUrl(it.url);
    img.addEventListener('error', () => img.replaceWith(el('span', 'favicon-fallback')));
    row.appendChild(img);
  } else {
    row.appendChild(el('span', 'favicon-fallback'));
  }

  const main = el('div', 'row-main');
  const titleline = el('div', 'row-titleline');
  const dot = el('span', 'unread-dot');
  dot.title = 'Não lida';
  titleline.appendChild(dot);

  let title;
  if (isOpenable(it.url)) {
    title = el('a', 'row-title', it.title);
    title.href = it.url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.title = it.url;
    title.addEventListener('click', (e) => onOpen(e, it));
    title.addEventListener('auxclick', (e) => {
      if (e.button === 1) onOpen(e, it);
    });
  } else {
    title = el('span', 'row-title', it.title);
  }
  titleline.appendChild(title);
  main.appendChild(titleline);

  const meta = el('div', 'row-meta');
  meta.appendChild(el('span', 'host', hostOf(it.url)));
  meta.appendChild(el('span', 'sep', '·'));
  const time = el('time', '', fmtWhen(it.createdAt));
  time.dateTime = new Date(it.createdAt).toISOString();
  time.title = new Date(it.createdAt).toLocaleString('pt-BR');
  meta.appendChild(time);
  if (it.category) meta.appendChild(el('span', 'badge', it.category));
  if (it.area === 'local') {
    const flag = el('span', 'badge badge-warning', 'só neste computador');
    flag.title = 'Será sincronizada quando houver espaço na sincronização do Chrome';
    meta.appendChild(flag);
  }
  main.appendChild(meta);

  if (it.note) main.appendChild(el('p', 'row-note', it.note));
  row.appendChild(main);

  const actions = el('div', 'row-actions');

  const readBtn = el('button', `icon-btn${it.read ? ' is-read-on' : ''}`);
  readBtn.type = 'button';
  const readLabel = it.read ? 'Marcar como não lida' : 'Marcar como lida';
  readBtn.setAttribute('aria-label', readLabel);
  readBtn.title = readLabel;
  readBtn.appendChild(icon(it.read ? ICONS.read : ICONS.unread));
  readBtn.addEventListener('click', () => toggleRead(it));
  actions.appendChild(readBtn);

  const editBtn = el('button', 'icon-btn');
  editBtn.type = 'button';
  editBtn.setAttribute('aria-label', 'Editar');
  editBtn.title = 'Editar';
  editBtn.appendChild(icon(ICONS.edit));
  editBtn.addEventListener('click', () => startEdit(it.id));
  actions.appendChild(editBtn);

  const delBtn = el('button', 'icon-btn');
  delBtn.type = 'button';
  delBtn.appendChild(icon(ICONS.trash));
  if (deleteArmedId === it.id) {
    delBtn.classList.add('is-armed');
    delBtn.appendChild(document.createTextNode('Excluir?'));
    delBtn.setAttribute('aria-label', 'Confirmar exclusão');
    delBtn.addEventListener('click', () => deleteItem(it));
  } else {
    delBtn.setAttribute('aria-label', 'Excluir');
    delBtn.title = 'Excluir';
    delBtn.addEventListener('click', () => armDelete(it.id));
  }
  actions.appendChild(delBtn);

  row.appendChild(actions);
  return row;
}

function editRowEl(it) {
  const row = el('article', 'row row-editing');
  row.appendChild(el('span', ''));

  const form = el('form', 'row-edit');
  form.autocomplete = 'off';

  const titleField = el('div', '');
  const titleLabel = el('label', 'input-label', 'Título');
  titleLabel.htmlFor = 'e-title';
  const titleInput = el('input', 'input');
  titleInput.id = 'e-title';
  titleInput.required = true;
  titleInput.maxLength = Store.LIMITS.title;
  titleInput.value = it.title;
  titleField.append(titleLabel, titleInput);

  const catField = el('div', '');
  const catLabel = el('label', 'input-label', 'Categoria');
  catLabel.htmlFor = 'e-category';
  const catInput = el('input', 'input');
  catInput.id = 'e-category';
  catInput.maxLength = Store.LIMITS.category;
  catInput.value = it.category;
  catInput.setAttribute('list', 'e-category-options');
  const datalist = el('datalist', '');
  datalist.id = 'e-category-options';
  for (const cat of new Set(items.map((i) => i.category).filter(Boolean))) {
    const opt = document.createElement('option');
    opt.value = cat;
    datalist.appendChild(opt);
  }
  catField.append(catLabel, catInput, datalist);

  const noteField = el('div', 'full');
  const noteLabel = el('label', 'input-label', 'Nota');
  noteLabel.htmlFor = 'e-note';
  const noteInput = el('textarea', 'input textarea');
  noteInput.id = 'e-note';
  noteInput.rows = 3;
  noteInput.maxLength = Store.LIMITS.note;
  noteInput.value = it.note;
  noteField.append(noteLabel, noteInput);

  const actions = el('div', 'row-edit-actions');
  const save = el('button', 'btn-primary', 'Salvar alterações');
  save.type = 'submit';
  const cancel = el('button', 'btn-ghost', 'Cancelar');
  cancel.type = 'button';
  cancel.addEventListener('click', stopEdit);
  actions.append(save, cancel);

  form.append(titleField, catField, noteField, actions);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const updated = await Store.update(it, {
        title: titleInput.value.trim() || it.url,
        category: catInput.value.trim(),
        note: noteInput.value.trim(),
      });
      editingId = null;
      await refresh();
      showToast(updated.area === 'local' && it.area === 'sync'
        ? 'Alterações salvas — a nota ficou grande demais para sincronizar e a página passou a ficar só neste computador'
        : 'Alterações salvas');
    } catch (err) {
      showToast(Store.friendlyError(err), true);
    }
  });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') stopEdit();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
  });

  row.appendChild(form);
  requestAnimationFrame(() => titleInput.focus());
  return row;
}

function renderFooter() {
  const unread = items.filter((i) => !i.read).length;
  $('count').textContent = items.length
    ? `${plural(items.length, 'página salva', 'páginas salvas')} · ${plural(unread, 'não lida', 'não lidas')}`
    : '';
  const readCount = items.length - unread;
  const clearBtn = $('btn-clear-read');
  clearBtn.disabled = readCount === 0;
  clearBtn.classList.toggle('is-armed', clearArmed);
  $('btn-clear-read-label').textContent = clearArmed
    ? `Confirmar: excluir ${plural(readCount, 'lida', 'lidas')}`
    : 'Excluir lidas';
}

async function renderUsage() {
  try {
    const { bytes, quota } = await Store.usage();
    const pct = Math.min(100, (bytes / quota) * 100);
    $('sync-text').textContent = `${fmtKB(bytes)} de ${fmtKB(quota)}`;
    $('meter-fill').style.width = `${Math.max(pct, bytes > 0 ? 1.5 : 0)}%`;
    const meter = $('meter');
    meter.setAttribute('aria-valuenow', String(Math.round(pct)));
    meter.classList.toggle('warn', pct >= 80 && pct < 95);
    meter.classList.toggle('critical', pct >= 95);

    const localCount = items.filter((i) => i.area === 'local').length;
    const localEl = $('sync-local');
    localEl.hidden = localCount === 0;
    localEl.textContent = localCount
      ? `${plural(localCount, 'página está', 'páginas estão')} só neste computador. Exclua páginas lidas para liberar espaço e elas serão sincronizadas sozinhas.`
      : '';
  } catch {
    $('sync-text').textContent = '';
  }
}

// ─── Ações ───

async function refresh() {
  items = await Store.all();
  render();
  renderUsage();
}

function scheduleRefresh() {
  if (editingId) {
    pendingRefresh = true;
    return;
  }
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 120);
}

function onOpen(e, it) {
  if (it.url.startsWith('file:')) {
    // páginas de extensão não navegam direto para file://
    e.preventDefault();
    chrome.tabs.create({ url: it.url, active: !(e.ctrlKey || e.metaKey || e.button === 1) });
  }
  if (!it.read) Store.update(it, { read: true }).catch(() => {});
}

async function toggleRead(it) {
  try {
    await Store.update(it, { read: !it.read });
    // a re-renderização vem do storage.onChanged, que respeita edição em andamento
  } catch (err) {
    showToast(Store.friendlyError(err), true);
  }
}

function startEdit(id) {
  editingId = id;
  deleteArmedId = null;
  renderList();
}

function stopEdit() {
  editingId = null;
  if (pendingRefresh) {
    pendingRefresh = false;
    refresh();
  } else {
    renderList();
  }
}

function armDelete(id) {
  deleteArmedId = id;
  clearTimeout(deleteArmedTimer);
  deleteArmedTimer = setTimeout(() => {
    deleteArmedId = null;
    renderList();
  }, 3000);
  renderList();
}

async function afterRemoval(message) {
  const moved = await Store.rebalance();
  await refresh();
  showToast(moved ? `${message} · ${plural(moved, 'página voltou', 'páginas voltaram')} a sincronizar` : message);
}

async function deleteItem(it) {
  clearTimeout(deleteArmedTimer);
  deleteArmedId = null;
  try {
    await Store.remove(it);
    await afterRemoval('Página excluída');
  } catch (err) {
    showToast(Store.friendlyError(err), true);
  }
}

async function onClearRead() {
  const read = items.filter((i) => i.read);
  if (!read.length) return;
  if (!clearArmed) {
    clearArmed = true;
    clearTimeout(clearArmedTimer);
    clearArmedTimer = setTimeout(() => {
      clearArmed = false;
      renderFooter();
    }, 4000);
    renderFooter();
    return;
  }
  clearTimeout(clearArmedTimer);
  clearArmed = false;
  try {
    await Store.remove(read);
    await afterRemoval(`${plural(read.length, 'página lida excluída', 'páginas lidas excluídas')}`);
  } catch (err) {
    showToast(Store.friendlyError(err), true);
  }
}

// ─── Exportar / Importar ───

function exportJson() {
  if (!items.length) {
    showToast('Nada para exportar ainda', true);
    return;
  }
  const pages = [...items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ url, title, note, category, createdAt, read }) => ({ url, title, note, category, createdAt, read }));
  const payload = {
    app: 'paginas-salvas-nova-advocacia',
    version: 1,
    exportedAt: new Date().toISOString(),
    pages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paginas-salvas-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${plural(pages.length, 'página exportada', 'páginas exportadas')}`);
}

async function importJson(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    showToast('Arquivo inválido: não é um JSON', true);
    return;
  }
  const incoming = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.pages) ? parsed.pages : null;
  if (!incoming) {
    showToast('JSON sem a lista de páginas esperada', true);
    return;
  }

  const known = items.map((i) => i.url);
  const toAdd = [];
  let skipped = 0;
  for (const raw of incoming) {
    const url = raw && typeof raw.url === 'string' ? raw.url.trim() : '';
    if (!isOpenable(url) || known.some((u) => Store.sameUrl(u, url))) {
      skipped++;
      continue;
    }
    known.push(url);
    toAdd.push({
      url,
      title: typeof raw.title === 'string' ? raw.title : url,
      note: typeof raw.note === 'string' ? raw.note : '',
      category: typeof raw.category === 'string' ? raw.category : '',
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
      read: Boolean(raw.read),
    });
  }
  if (!toAdd.length) {
    showToast(skipped ? `Nada novo: ${plural(skipped, 'página já existia ou era inválida', 'páginas já existiam ou eram inválidas')}` : 'Nenhuma página no arquivo', true);
    return;
  }
  try {
    const result = await Store.addMany(toAdd);
    await refresh();
    const parts = [`${plural(result.sync + result.local, 'página importada', 'páginas importadas')}`];
    if (result.local) parts.push(`${result.local} só neste computador (sincronização cheia)`);
    if (skipped) parts.push(`${skipped} ignorada(s)`);
    showToast(parts.join(' · '));
  } catch (err) {
    showToast(Store.friendlyError(err), true);
  }
}

// ─── Toast ───

function showToast(message, isError = false) {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast${isError ? ' toast-error' : ''}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, isError ? 4000 : 2600);
}

// ─── Sincronização ao vivo ───

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' && area !== 'local') return;
  if (Object.keys(changes).some((k) => k.startsWith(Store.PREFIX))) scheduleRefresh();
});

// ─── Init ───

document.addEventListener('DOMContentLoaded', async () => {
  await refresh();

  const moved = await Store.rebalance();
  if (moved) {
    await refresh();
    showToast(`${plural(moved, 'página voltou', 'páginas voltaram')} a sincronizar`);
  }

  $('search').addEventListener('input', () => {
    state.query = $('search').value;
    render();
  });

  for (const btn of document.querySelectorAll('.segmented button')) {
    btn.addEventListener('click', () => {
      state.status = btn.dataset.status;
      render();
    });
  }

  $('sort').addEventListener('change', () => {
    state.sort = $('sort').value;
    renderList();
  });

  $('btn-clear-read').addEventListener('click', onClearRead);
  $('btn-export').addEventListener('click', exportJson);
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) await importJson(file);
    e.target.value = '';
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      $('search').focus();
    } else if (e.key === 'Escape' && document.activeElement === $('search') && $('search').value) {
      $('search').value = '';
      state.query = '';
      render();
    }
  });
});
