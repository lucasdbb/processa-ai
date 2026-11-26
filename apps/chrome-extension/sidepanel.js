// Biblioteca de Prompts — A Nova Advocacia
// Side panel: CRUD de prompts em chrome.storage.local, busca, categorias,
// favoritos, copiar para a área de transferência e exportar/importar JSON.

'use strict';

const STORAGE_KEY = 'prompts';

// ─── Estado da UI ───
let prompts = [];
let filter = { query: '', category: null, favoritesOnly: false };
let editingId = null; // null = criando novo
let deleteArmedId = null; // confirmação de exclusão em duas etapas
let deleteArmedTimer = null;
let toastTimer = null;

// ─── Elementos ───
const $ = (id) => document.getElementById(id);
const viewList = $('view-list');
const viewEditor = $('view-editor');
const listEl = $('prompt-list');
const chipsEl = $('chips');
const emptyState = $('empty-state');
const noResults = $('no-results');
const searchEl = $('search');
const countEl = $('count');

// ─── Storage ───

async function loadPrompts() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  prompts = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function savePrompts() {
  await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Render ───

function categories() {
  const set = new Set();
  for (const p of prompts) if (p.category) set.add(p.category);
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function visiblePrompts() {
  const q = filter.query.trim().toLowerCase();
  return prompts
    .filter((p) => {
      if (filter.favoritesOnly && !p.favorite) return false;
      if (filter.category && p.category !== filter.category) return false;
      if (q) {
        const hay = `${p.title}\n${p.content}\n${p.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function icon(pathD, extra = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  if (extra) {
    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute('d', extra);
    svg.appendChild(p2);
  }
  return svg;
}

const ICONS = {
  copy: 'M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2M4 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8L12 3Z',
  edit: 'M17 3.5a2.1 2.1 0 0 1 3 3L8.5 18 4 19.5 5.5 15 17 3.5Z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  check: 'M4 12.5 9.5 18 20 6.5',
};

function render() {
  renderChips();
  renderList();
  renderCount();
}

function renderChips() {
  chipsEl.textContent = '';
  const cats = categories();

  const mkChip = (label, active, onClick, extraClass = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip${extraClass ? ' ' + extraClass : ''}${active ? ' active' : ''}`;
    b.textContent = label;
    b.setAttribute('aria-pressed', String(active));
    b.addEventListener('click', onClick);
    chipsEl.appendChild(b);
  };

  mkChip('Todos', !filter.category && !filter.favoritesOnly, () => {
    filter.category = null;
    filter.favoritesOnly = false;
    render();
  });

  mkChip('★ Favoritos', filter.favoritesOnly, () => {
    filter.favoritesOnly = !filter.favoritesOnly;
    render();
  }, 'chip-fav');

  for (const cat of cats) {
    mkChip(cat, filter.category === cat, () => {
      filter.category = filter.category === cat ? null : cat;
      render();
    });
  }
}

function renderList() {
  listEl.textContent = '';
  const visible = visiblePrompts();

  const hasAny = prompts.length > 0;
  emptyState.hidden = hasAny;
  noResults.hidden = !hasAny || visible.length > 0;
  listEl.hidden = visible.length === 0;

  for (const p of visible) {
    listEl.appendChild(renderCard(p));
  }
}

function renderCard(p) {
  const card = document.createElement('article');
  card.className = 'card';

  // topo: título + favorito
  const top = document.createElement('div');
  top.className = 'card-top';

  const titleWrap = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = p.title;
  titleWrap.appendChild(title);
  if (p.category) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = p.category;
    titleWrap.appendChild(badge);
  }
  top.appendChild(titleWrap);

  const favBtn = document.createElement('button');
  favBtn.type = 'button';
  favBtn.className = `icon-btn${p.favorite ? ' fav-on' : ''}`;
  favBtn.setAttribute('aria-label', p.favorite ? 'Remover dos favoritos' : 'Marcar como favorito');
  favBtn.title = p.favorite ? 'Remover dos favoritos' : 'Favoritar';
  favBtn.appendChild(icon(ICONS.star));
  favBtn.addEventListener('click', () => toggleFavorite(p.id));
  top.appendChild(favBtn);

  card.appendChild(top);

  // prévia do conteúdo
  const preview = document.createElement('p');
  preview.className = 'card-preview';
  preview.textContent = p.content;
  card.appendChild(preview);

  // ações
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-copy';
  copyBtn.appendChild(icon(ICONS.copy));
  copyBtn.appendChild(document.createTextNode('Copiar'));
  copyBtn.addEventListener('click', () => copyPrompt(p.id, copyBtn));
  actions.appendChild(copyBtn);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'icon-btn';
  editBtn.setAttribute('aria-label', 'Editar prompt');
  editBtn.title = 'Editar';
  editBtn.appendChild(icon(ICONS.edit));
  editBtn.addEventListener('click', () => openEditor(p.id));
  actions.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  if (deleteArmedId === p.id) {
    delBtn.className = 'icon-btn confirm-delete';
    delBtn.setAttribute('aria-label', 'Confirmar exclusão');
    delBtn.appendChild(icon(ICONS.trash));
    delBtn.appendChild(document.createTextNode('Excluir?'));
    delBtn.addEventListener('click', () => deletePrompt(p.id));
  } else {
    delBtn.className = 'icon-btn';
    delBtn.setAttribute('aria-label', 'Excluir prompt');
    delBtn.title = 'Excluir';
    delBtn.appendChild(icon(ICONS.trash));
    delBtn.addEventListener('click', () => armDelete(p.id));
  }
  actions.appendChild(delBtn);

  card.appendChild(actions);
  return card;
}

function renderCount() {
  const n = prompts.length;
  countEl.textContent = n === 0 ? '' : n === 1 ? '1 prompt' : `${n} prompts`;
}

// ─── Ações ───

async function copyPrompt(id, btn) {
  const p = prompts.find((x) => x.id === id);
  if (!p) return;
  try {
    await navigator.clipboard.writeText(p.content);
  } catch {
    // fallback: navigator.clipboard exige foco no documento
    const ta = document.createElement('textarea');
    ta.value = p.content;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  p.copyCount = (p.copyCount || 0) + 1;
  await savePrompts();

  if (btn) {
    btn.textContent = '';
    btn.appendChild(icon(ICONS.check));
    btn.appendChild(document.createTextNode('Copiado'));
    setTimeout(() => {
      btn.textContent = '';
      btn.appendChild(icon(ICONS.copy));
      btn.appendChild(document.createTextNode('Copiar'));
    }, 1500);
  }
  showToast('Prompt copiado — é só colar na LLM');
}

async function toggleFavorite(id) {
  const p = prompts.find((x) => x.id === id);
  if (!p) return;
  p.favorite = !p.favorite;
  p.updatedAt = Date.now();
  await savePrompts();
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

async function deletePrompt(id) {
  clearTimeout(deleteArmedTimer);
  deleteArmedId = null;
  prompts = prompts.filter((x) => x.id !== id);
  await savePrompts();
  render();
  showToast('Prompt excluído');
}

// ─── Editor ───

function openEditor(id = null) {
  editingId = id;
  const p = id ? prompts.find((x) => x.id === id) : null;
  $('editor-title').textContent = p ? 'Editar prompt' : 'Novo prompt';
  $('f-title').value = p ? p.title : '';
  $('f-category').value = p && p.category ? p.category : '';
  $('f-content').value = p ? p.content : '';

  const datalist = $('category-options');
  datalist.textContent = '';
  for (const cat of categories()) {
    const opt = document.createElement('option');
    opt.value = cat;
    datalist.appendChild(opt);
  }

  viewList.hidden = true;
  viewEditor.hidden = false;
  $('f-title').focus();
}

function closeEditor() {
  editingId = null;
  viewEditor.hidden = true;
  viewList.hidden = false;
}

async function submitEditor(event) {
  event.preventDefault();
  const title = $('f-title').value.trim();
  const category = $('f-category').value.trim();
  const content = $('f-content').value;
  if (!title || !content.trim()) return;

  const now = Date.now();
  const wasEditing = Boolean(editingId);
  if (editingId) {
    const p = prompts.find((x) => x.id === editingId);
    if (p) {
      p.title = title;
      p.category = category;
      p.content = content;
      p.updatedAt = now;
    }
  } else {
    prompts.push({
      id: newId(),
      title,
      category,
      content,
      favorite: false,
      copyCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  await savePrompts();
  closeEditor();
  render();
  showToast(wasEditing ? 'Prompt atualizado' : 'Prompt salvo');
}

// ─── Exportar / Importar ───

function exportJson() {
  if (prompts.length === 0) {
    showToast('Nada para exportar ainda', true);
    return;
  }
  const payload = {
    app: 'biblioteca-de-prompts-nova-advocacia',
    version: 1,
    exportedAt: new Date().toISOString(),
    prompts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `prompts-nova-advocacia-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${prompts.length} prompt(s) exportado(s)`);
}

async function importJson(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    showToast('Arquivo inválido: não é um JSON', true);
    return;
  }
  const incoming = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.prompts) ? parsed.prompts : null;
  if (!incoming) {
    showToast('JSON sem a lista de prompts esperada', true);
    return;
  }

  const existingIds = new Set(prompts.map((p) => p.id));
  let added = 0;
  let skipped = 0;
  const now = Date.now();
  for (const raw of incoming) {
    if (!raw || typeof raw.title !== 'string' || typeof raw.content !== 'string' || !raw.title.trim()) {
      skipped++;
      continue;
    }
    const id = typeof raw.id === 'string' && raw.id ? raw.id : newId();
    if (existingIds.has(id)) {
      skipped++;
      continue;
    }
    existingIds.add(id);
    prompts.push({
      id,
      title: raw.title.trim().slice(0, 120),
      category: typeof raw.category === 'string' ? raw.category.trim().slice(0, 40) : '',
      content: raw.content,
      favorite: Boolean(raw.favorite),
      copyCount: Number.isFinite(raw.copyCount) ? raw.copyCount : 0,
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
    });
    added++;
  }
  await savePrompts();
  render();
  showToast(skipped > 0 ? `${added} importado(s), ${skipped} ignorado(s)` : `${added} prompt(s) importado(s)`);
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
  }, 2200);
}

// ─── Sincronização entre janelas do panel ───

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    const incoming = changes[STORAGE_KEY].newValue || [];
    // Ignora o eco das nossas próprias gravações para não perder estado
    // transitório da UI (ex.: o "Copiado" no botão)
    if (JSON.stringify(incoming) === JSON.stringify(prompts)) return;
    prompts = incoming;
    render();
  }
});

// ─── Init ───

document.addEventListener('DOMContentLoaded', async () => {
  await loadPrompts();
  render();

  searchEl.addEventListener('input', () => {
    filter.query = searchEl.value;
    renderList();
  });

  $('btn-new').addEventListener('click', () => openEditor());
  $('btn-empty-new').addEventListener('click', () => openEditor());
  $('btn-cancel').addEventListener('click', closeEditor);
  $('form-editor').addEventListener('submit', submitEditor);
  $('btn-export').addEventListener('click', exportJson);
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) await importJson(file);
    e.target.value = '';
  });

  // Esc fecha o editor
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !viewEditor.hidden) closeEditor();
  });
});
