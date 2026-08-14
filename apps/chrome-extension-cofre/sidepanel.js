// Cofre de Conhecimento — A Nova Advocacia
// Side panel: recebe capturas pendentes (chrome.storage.session), CRUD dos
// itens salvos (chrome.storage.local), busca, filtros por origem/categoria,
// favoritos, detalhe com prompt vinculado e export JSON/Markdown.

'use strict';

const STORAGE_KEY = 'items';

// ─── Estado ───
let items = [];
let filter = { query: '', category: null, source: null, favoritesOnly: false };
let editingId = null;
let pendingCapture = null; // captura vinda do background aguardando salvamento
let detailId = null;
let deleteArmedId = null;
let deleteArmedTimer = null;
let toastTimer = null;

// ─── Elementos ───
const $ = (id) => document.getElementById(id);
const viewList = $('view-list');
const viewEditor = $('view-editor');
const viewDetail = $('view-detail');
const listEl = $('item-list');
const chipsEl = $('chips');

// ─── Storage ───

async function loadItems() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  items = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function saveItems() {
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Helpers ───

function categories() {
  const set = new Set();
  for (const it of items) if (it.category) set.add(it.category);
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function sources() {
  const set = new Set();
  for (const it of items) if (it.source && it.source.kind) set.add(it.source.kind);
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function visibleItems() {
  const q = filter.query.trim().toLowerCase();
  return items
    .filter((it) => {
      if (filter.favoritesOnly && !it.favorite) return false;
      if (filter.category && it.category !== filter.category) return false;
      if (filter.source && (!it.source || it.source.kind !== filter.source)) return false;
      if (q) {
        const hay = `${it.title}\n${it.contentMd}\n${it.prompt || ''}\n${it.category || ''}\n${it.source ? it.source.kind : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function icon(pathD) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}

const ICONS = {
  copy: 'M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2M4 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8L12 3Z',
  edit: 'M17 3.5a2.1 2.1 0 0 1 3 3L8.5 18 4 19.5 5.5 15 17 3.5Z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  check: 'M4 12.5 9.5 18 20 6.5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};

// ─── Render ───

function render() {
  renderChips();
  renderList();
  renderCount();
}

function renderChips() {
  chipsEl.textContent = '';

  const mkChip = (label, active, onClick, extraClass = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip${extraClass ? ' ' + extraClass : ''}${active ? ' active' : ''}`;
    b.textContent = label;
    b.setAttribute('aria-pressed', String(active));
    b.addEventListener('click', onClick);
    chipsEl.appendChild(b);
  };

  mkChip('Todos', !filter.category && !filter.source && !filter.favoritesOnly, () => {
    filter.category = null;
    filter.source = null;
    filter.favoritesOnly = false;
    render();
  });

  mkChip('★ Favoritos', filter.favoritesOnly, () => {
    filter.favoritesOnly = !filter.favoritesOnly;
    render();
  }, 'chip-fav');

  for (const src of sources()) {
    mkChip(src, filter.source === src, () => {
      filter.source = filter.source === src ? null : src;
      render();
    }, 'chip-fav');
  }

  for (const cat of categories()) {
    mkChip(cat, filter.category === cat, () => {
      filter.category = filter.category === cat ? null : cat;
      render();
    });
  }
}

function renderList() {
  listEl.textContent = '';
  const visible = visibleItems();

  const hasAny = items.length > 0;
  $('empty-state').hidden = hasAny;
  $('no-results').hidden = !hasAny || visible.length > 0;
  listEl.hidden = visible.length === 0;

  for (const it of visible) listEl.appendChild(renderCard(it));
}

function renderCard(it) {
  const card = document.createElement('article');
  card.className = 'card';

  const top = document.createElement('div');
  top.className = 'card-top';

  const titleWrap = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = it.title;
  titleWrap.appendChild(title);

  const badges = document.createElement('div');
  if (it.source && it.source.kind) {
    const src = document.createElement('span');
    src.className = 'badge badge-source';
    src.textContent = it.source.kind;
    badges.appendChild(src);
  }
  if (it.category) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = it.category;
    badges.appendChild(badge);
  }
  if (it.prompt) {
    const bp = document.createElement('span');
    bp.className = 'badge badge-prompt';
    bp.textContent = 'com prompt';
    badges.appendChild(bp);
  }
  titleWrap.appendChild(badges);

  const meta = document.createElement('p');
  meta.className = 'card-meta';
  meta.textContent = fmtDate(it.createdAt);
  titleWrap.appendChild(meta);
  top.appendChild(titleWrap);

  const favBtn = document.createElement('button');
  favBtn.type = 'button';
  favBtn.className = `icon-btn${it.favorite ? ' fav-on' : ''}`;
  favBtn.setAttribute('aria-label', it.favorite ? 'Remover dos favoritos' : 'Marcar como favorito');
  favBtn.title = it.favorite ? 'Remover dos favoritos' : 'Favoritar';
  favBtn.appendChild(icon(ICONS.star));
  favBtn.addEventListener('click', () => toggleFavorite(it.id));
  top.appendChild(favBtn);

  card.appendChild(top);

  const preview = document.createElement('p');
  preview.className = 'card-preview';
  preview.textContent = it.contentMd;
  card.appendChild(preview);

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-copy';
  copyBtn.appendChild(icon(ICONS.copy));
  copyBtn.appendChild(document.createTextNode('Copiar'));
  copyBtn.addEventListener('click', () => copyText(it.contentMd, copyBtn));
  actions.appendChild(copyBtn);

  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'icon-btn';
  viewBtn.setAttribute('aria-label', 'Ver item completo');
  viewBtn.title = 'Ver completo';
  viewBtn.appendChild(icon(ICONS.eye));
  viewBtn.addEventListener('click', () => openDetail(it.id));
  actions.appendChild(viewBtn);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'icon-btn';
  editBtn.setAttribute('aria-label', 'Editar item');
  editBtn.title = 'Editar';
  editBtn.appendChild(icon(ICONS.edit));
  editBtn.addEventListener('click', () => openEditor(it.id));
  actions.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  if (deleteArmedId === it.id) {
    delBtn.className = 'icon-btn confirm-delete';
    delBtn.setAttribute('aria-label', 'Confirmar exclusão');
    delBtn.appendChild(icon(ICONS.trash));
    delBtn.appendChild(document.createTextNode('Excluir?'));
    delBtn.addEventListener('click', () => deleteItem(it.id));
  } else {
    delBtn.className = 'icon-btn';
    delBtn.setAttribute('aria-label', 'Excluir item');
    delBtn.title = 'Excluir';
    delBtn.appendChild(icon(ICONS.trash));
    delBtn.addEventListener('click', () => armDelete(it.id));
  }
  actions.appendChild(delBtn);

  card.appendChild(actions);
  return card;
}

function renderCount() {
  const n = items.length;
  $('count').textContent = n === 0 ? '' : n === 1 ? '1 item' : `${n} itens`;
}

// ─── Ações ───

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (btn && btn.classList.contains('btn-copy')) {
    const original = btn.textContent;
    btn.textContent = '';
    btn.appendChild(icon(ICONS.check));
    btn.appendChild(document.createTextNode('Copiado'));
    setTimeout(() => {
      btn.textContent = '';
      btn.appendChild(icon(ICONS.copy));
      btn.appendChild(document.createTextNode(original.replace('Copiado', 'Copiar')));
    }, 1500);
  }
  showToast('Copiado para a área de transferência');
}

async function toggleFavorite(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  it.favorite = !it.favorite;
  it.updatedAt = Date.now();
  await saveItems();
  render();
}

function armDelete(id) {
  deleteArmedId = id;
  clearTimeout(deleteArmedTimer);
  deleteArmedTimer = setTimeout(() => {
    deleteArmedId = null;
    render();
  }, 3000);
  render();
}

async function deleteItem(id) {
  clearTimeout(deleteArmedTimer);
  deleteArmedId = null;
  items = items.filter((x) => x.id !== id);
  await saveItems();
  render();
  showToast('Item excluído');
}

// ─── Vistas ───

function showView(which) {
  viewList.hidden = which !== 'list';
  viewEditor.hidden = which !== 'editor';
  viewDetail.hidden = which !== 'detail';
}

function fillCategoryOptions() {
  const datalist = $('category-options');
  datalist.textContent = '';
  for (const cat of categories()) {
    const opt = document.createElement('option');
    opt.value = cat;
    datalist.appendChild(opt);
  }
}

// Editor serve para dois fluxos: salvar captura pendente e editar item
function openEditor(id = null) {
  editingId = id;
  const it = id ? items.find((x) => x.id === id) : null;
  $('editor-title').textContent = it ? 'Editar item' : 'Salvar no Cofre';

  const sourceEl = $('editor-source');
  sourceEl.textContent = '';
  const origin = it ? it.source : pendingCapture ? { kind: pendingCapture.sourceKind, url: pendingCapture.url, pageTitle: pendingCapture.pageTitle } : null;
  if (origin && origin.kind) {
    sourceEl.appendChild(document.createTextNode(`Origem: ${origin.kind}`));
    if (origin.url) {
      sourceEl.appendChild(document.createTextNode(' · '));
      const a = document.createElement('a');
      a.href = origin.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'abrir conversa';
      sourceEl.appendChild(a);
    }
  }

  $('f-title').value = it ? it.title : pendingCapture ? pendingCapture.suggestedTitle || '' : '';
  $('f-category').value = it && it.category ? it.category : '';
  $('f-prompt').value = it ? it.prompt || '' : pendingCapture ? pendingCapture.prompt || '' : '';
  $('f-content').value = it ? it.contentMd : pendingCapture ? pendingCapture.markdown || '' : '';
  fillCategoryOptions();
  showView('editor');
  $('f-title').focus();
  $('f-title').select();
}

async function closeEditor(discardPending) {
  if (discardPending && !editingId && pendingCapture) {
    pendingCapture = null;
    await chrome.storage.session.remove('pendingCapture');
  }
  editingId = null;
  showView('list');
}

async function submitEditor(event) {
  event.preventDefault();
  const title = $('f-title').value.trim();
  const category = $('f-category').value.trim();
  const prompt = $('f-prompt').value.trim();
  const contentMd = $('f-content').value;
  if (!title || !contentMd.trim()) return;

  const now = Date.now();
  const wasEditing = Boolean(editingId);
  if (wasEditing) {
    const it = items.find((x) => x.id === editingId);
    if (it) {
      it.title = title;
      it.category = category;
      it.prompt = prompt;
      it.contentMd = contentMd;
      it.updatedAt = now;
    }
  } else {
    items.push({
      id: newId(),
      title,
      category,
      prompt,
      contentMd,
      source: pendingCapture
        ? { kind: pendingCapture.sourceKind || '', url: pendingCapture.url || '', pageTitle: pendingCapture.pageTitle || '' }
        : { kind: '', url: '', pageTitle: '' },
      favorite: false,
      copyCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    pendingCapture = null;
    await chrome.storage.session.remove('pendingCapture');
  }
  await saveItems();
  editingId = null;
  showView('list');
  render();
  showToast(wasEditing ? 'Item atualizado' : 'Guardado no Cofre ✓');
}

// ─── Detalhe ───

function openDetail(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  detailId = id;
  $('d-title').textContent = it.title;

  const meta = $('d-meta');
  meta.textContent = '';
  const parts = [];
  if (it.source && it.source.kind) parts.push(it.source.kind);
  parts.push(fmtDate(it.createdAt));
  if (it.category) parts.push(it.category);
  meta.appendChild(document.createTextNode(parts.join(' · ')));
  if (it.source && it.source.url) {
    meta.appendChild(document.createTextNode(' · '));
    const a = document.createElement('a');
    a.href = it.source.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'abrir conversa original';
    meta.appendChild(a);
  }

  $('d-prompt-wrap').hidden = !it.prompt;
  $('d-prompt').textContent = it.prompt || '';
  $('d-content').textContent = it.contentMd;
  showView('detail');
}

// ─── Export / Import ───

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (!items.length) return showToast('Nada para exportar ainda', true);
  const payload = {
    app: 'cofre-de-conhecimento-nova-advocacia',
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  download(`cofre-conhecimento-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
  showToast(`${items.length} item(ns) exportado(s)`);
}

function exportMarkdown() {
  if (!items.length) return showToast('Nada para exportar ainda', true);
  const parts = ['# Cofre de Conhecimento — A Nova Advocacia', ''];
  for (const it of visibleItems()) {
    parts.push(`## ${it.title}`);
    const meta = [];
    if (it.source && it.source.kind) meta.push(`Origem: ${it.source.kind}`);
    if (it.category) meta.push(`Categoria: ${it.category}`);
    meta.push(`Salvo em: ${fmtDate(it.createdAt)}`);
    if (it.source && it.source.url) meta.push(`[Conversa original](${it.source.url})`);
    parts.push(`> ${meta.join(' · ')}`, '');
    if (it.prompt) {
      parts.push('**Prompt que gerou:**', '', '```', it.prompt, '```', '');
    }
    parts.push(it.contentMd, '', '---', '');
  }
  const stamp = new Date().toISOString().slice(0, 10);
  download(`cofre-conhecimento-${stamp}.md`, parts.join('\n'), 'text/markdown');
  showToast('Markdown exportado');
}

async function importJson(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return showToast('Arquivo inválido: não é um JSON', true);
  }
  const incoming = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.items) ? parsed.items : null;
  if (!incoming) return showToast('JSON sem a lista de itens esperada', true);

  const existingIds = new Set(items.map((p) => p.id));
  let added = 0;
  let skipped = 0;
  const now = Date.now();
  for (const raw of incoming) {
    if (!raw || typeof raw.title !== 'string' || typeof raw.contentMd !== 'string' || !raw.title.trim()) {
      skipped++;
      continue;
    }
    const id = typeof raw.id === 'string' && raw.id ? raw.id : newId();
    if (existingIds.has(id)) {
      skipped++;
      continue;
    }
    existingIds.add(id);
    items.push({
      id,
      title: raw.title.trim().slice(0, 120),
      category: typeof raw.category === 'string' ? raw.category.trim().slice(0, 40) : '',
      prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
      contentMd: raw.contentMd,
      source: raw.source && typeof raw.source === 'object'
        ? { kind: String(raw.source.kind || ''), url: String(raw.source.url || ''), pageTitle: String(raw.source.pageTitle || '') }
        : { kind: '', url: '', pageTitle: '' },
      favorite: Boolean(raw.favorite),
      copyCount: Number.isFinite(raw.copyCount) ? raw.copyCount : 0,
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
    });
    added++;
  }
  await saveItems();
  render();
  showToast(skipped > 0 ? `${added} importado(s), ${skipped} ignorado(s)` : `${added} item(ns) importado(s)`);
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
  }, 2400);
}

// ─── Captura pendente ───

async function checkPending() {
  const data = await chrome.storage.session.get(['pendingCapture', 'pendingNotice']);
  if (data.pendingNotice) {
    showToast(data.pendingNotice, true);
    await chrome.storage.session.remove('pendingNotice');
  }
  if (data.pendingCapture && data.pendingCapture.markdown) {
    pendingCapture = data.pendingCapture;
    openEditor(null);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && (changes.pendingCapture || changes.pendingNotice)) {
    checkPending();
    return;
  }
  if (area === 'local' && changes[STORAGE_KEY]) {
    const incoming = changes[STORAGE_KEY].newValue || [];
    if (JSON.stringify(incoming) === JSON.stringify(items)) return;
    items = incoming;
    render();
  }
});

// ─── Init ───

document.addEventListener('DOMContentLoaded', async () => {
  await loadItems();
  render();
  await checkPending();

  $('search').addEventListener('input', () => {
    filter.query = $('search').value;
    renderList();
  });

  $('btn-cancel').addEventListener('click', () => closeEditor(true));
  $('form-editor').addEventListener('submit', submitEditor);
  $('btn-export').addEventListener('click', exportJson);
  $('btn-export-md').addEventListener('click', exportMarkdown);
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) await importJson(file);
    e.target.value = '';
  });

  $('btn-back').addEventListener('click', () => showView('list'));
  $('btn-copy-detail').addEventListener('click', (e) => {
    const it = items.find((x) => x.id === detailId);
    if (it) copyText(it.contentMd, e.currentTarget);
  });
  $('btn-copy-prompt').addEventListener('click', () => {
    const it = items.find((x) => x.id === detailId);
    if (it && it.prompt) copyText(it.prompt);
  });
  $('btn-edit-detail').addEventListener('click', () => {
    if (detailId) openEditor(detailId);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!viewEditor.hidden) closeEditor(false);
      else if (!viewDetail.hidden) showView('list');
    }
  });
});
