// Cofre de Conhecimento — script de captura.
// Injetado sob demanda (activeTab) pelo service worker; roda na página,
// converte a seleção atual em Markdown, tenta detectar o prompt que gerou
// a resposta (ChatGPT/Claude/Gemini) e devolve o payload como valor final.
(() => {
  'use strict';

  // ─── Conversor HTML → Markdown (autocontido) ───

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'BUTTON', 'SVG', 'IFRAME', 'AUDIO', 'VIDEO', 'SELECT', 'TEXTAREA']);

  function inlineText(node) {
    // texto de um nó tratando apenas marcações inline
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.nodeValue.replace(/\s+/g, ' ');
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(child.tagName)) continue;
      const tag = child.tagName;
      const inner = inlineText(child);
      if (tag === 'BR') out += '\n';
      else if (tag === 'STRONG' || tag === 'B') out += inner.trim() ? `**${inner.trim()}**` : '';
      else if (tag === 'EM' || tag === 'I') out += inner.trim() ? `*${inner.trim()}*` : '';
      else if (tag === 'DEL' || tag === 'S') out += inner.trim() ? `~~${inner.trim()}~~` : '';
      else if (tag === 'CODE') out += inner.trim() ? '`' + inner.trim().replace(/`/g, '\\`') + '`' : '';
      else if (tag === 'A') {
        const href = child.getAttribute('href') || '';
        out += href && !href.startsWith('javascript:') && inner.trim() ? `[${inner.trim()}](${href})` : inner;
      } else if (tag === 'IMG') {
        const alt = child.getAttribute('alt');
        out += alt ? `[imagem: ${alt}]` : '';
      } else {
        out += inner;
      }
    }
    return out;
  }

  function codeLang(pre) {
    const code = pre.querySelector('code');
    const cls = (code ? code.className : '') + ' ' + pre.className;
    const m = cls.match(/language-([\w+-]+)/) || cls.match(/lang-([\w+-]+)/);
    if (m) return m[1];
    // ChatGPT/Claude usam um cabeçalho com o nome da linguagem no wrapper
    const header = pre.closest('[class*="codeblock"], [class*="code-block"]');
    if (header) {
      const label = header.querySelector('[class*="language"], [class*="lang"]');
      if (label && label.textContent.trim().length < 20) return label.textContent.trim().toLowerCase();
    }
    return '';
  }

  function listToMd(el, depth, ordered) {
    let out = '';
    let i = 1;
    for (const li of el.children) {
      if (li.tagName !== 'LI') continue;
      const marker = ordered ? `${i}. ` : '- ';
      // separa sub-listas do conteúdo inline do item
      const sublists = [];
      const clone = li.cloneNode(true);
      clone.querySelectorAll(':scope > ul, :scope > ol').forEach((s) => s.remove());
      for (const s of li.children) {
        if (s.tagName === 'UL' || s.tagName === 'OL') sublists.push(s);
      }
      const text = blockToMd(clone, depth).trim().replace(/\n{2,}/g, '\n' + '  '.repeat(depth + 1));
      out += '  '.repeat(depth) + marker + text + '\n';
      for (const s of sublists) out += listToMd(s, depth + 1, s.tagName === 'OL');
      i++;
    }
    return out;
  }

  function tableToMd(table) {
    const rows = [...table.querySelectorAll('tr')].map((tr) =>
      [...tr.children].map((td) => inlineText(td).trim().replace(/\|/g, '\\|').replace(/\n/g, ' '))
    );
    if (!rows.length) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const line = (r) => '| ' + Array.from({ length: width }, (_, i) => r[i] || '').join(' | ') + ' |';
    let out = line(rows[0]) + '\n' + '| ' + Array(width).fill('---').join(' | ') + ' |\n';
    for (const r of rows.slice(1)) out += line(r) + '\n';
    return out;
  }

  function blockToMd(node, depth = 0) {
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.nodeValue.replace(/\s+/g, ' ');
        if (t.trim()) out += t;
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(child.tagName)) continue;
      const tag = child.tagName;
      if (/^H[1-6]$/.test(tag)) {
        out += '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + inlineText(child).trim() + '\n\n';
      } else if (tag === 'P') {
        out += '\n\n' + inlineText(child).trim() + '\n\n';
      } else if (tag === 'PRE') {
        const code = child.querySelector('code') || child;
        const lang = codeLang(child);
        out += '\n\n```' + lang + '\n' + code.innerText.replace(/\n$/, '') + '\n```\n\n';
      } else if (tag === 'UL' || tag === 'OL') {
        out += '\n\n' + listToMd(child, 0, tag === 'OL') + '\n';
      } else if (tag === 'BLOCKQUOTE') {
        const inner = blockToMd(child, depth).trim();
        out += '\n\n' + inner.split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
      } else if (tag === 'TABLE') {
        out += '\n\n' + tableToMd(child) + '\n';
      } else if (tag === 'HR') {
        out += '\n\n---\n\n';
      } else if (tag === 'BR') {
        out += '\n';
      } else if (tag === 'LI') {
        out += inlineText(child);
      } else if (tag === 'STRONG' || tag === 'B' || tag === 'EM' || tag === 'I' || tag === 'CODE' || tag === 'A' || tag === 'DEL' || tag === 'S' || tag === 'IMG' || tag === 'SPAN') {
        out += inlineText({ childNodes: [child] });
      } else {
        // DIV, SECTION, ARTICLE etc.: desce recursivamente como bloco
        out += blockToMd(child, depth);
      }
    }
    return out;
  }

  function selectionToMarkdown(sel) {
    const container = document.createElement('div');
    for (let i = 0; i < sel.rangeCount; i++) {
      container.appendChild(sel.getRangeAt(i).cloneContents());
    }
    let md = blockToMd(container)
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!md) md = sel.toString().trim();
    return md;
  }

  // ─── Detecção do prompt que gerou a resposta ───

  function detectPrompt(sel) {
    try {
      const host = location.hostname;
      let selector = null;
      if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
        selector = '[data-message-author-role="user"]';
      } else if (host.includes('claude.ai')) {
        selector = '[data-testid="user-message"], [data-test-render-count] .font-user-message';
      } else if (host.includes('gemini.google.com') || host.includes('bard.google.com')) {
        selector = 'user-query, .query-text';
      }
      if (!selector) return '';

      const anchor = sel.anchorNode
        ? sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement
        : null;
      if (!anchor) return '';

      let best = null;
      for (const el of document.querySelectorAll(selector)) {
        const pos = el.compareDocumentPosition(anchor);
        // o candidato precede a seleção no documento (ou a contém)
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING || pos & Node.DOCUMENT_POSITION_CONTAINED_BY) {
          best = el;
        }
      }
      return best ? best.innerText.trim().slice(0, 8000) : '';
    } catch {
      return '';
    }
  }

  function detectSource() {
    const host = location.hostname;
    if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) return 'ChatGPT';
    if (host.includes('claude.ai')) return 'Claude';
    if (host.includes('gemini.google.com') || host.includes('bard.google.com')) return 'Gemini';
    if (host.includes('copilot.microsoft.com')) return 'Copilot';
    if (host.includes('perplexity.ai')) return 'Perplexity';
    if (host.includes('grok.com')) return 'Grok';
    return host.replace(/^www\./, '') || 'web';
  }

  function suggestTitle(md) {
    const line = md
      .split('\n')
      .map((l) => l.replace(/^[#>\-*\d.\s`]+/, '').replace(/[*_`]/g, '').trim())
      .find((l) => l.length > 3) || '';
    return line.slice(0, 80);
  }

  // ─── Payload ───

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    return { ok: false, reason: 'empty-selection' };
  }
  const markdown = selectionToMarkdown(sel);
  return {
    ok: true,
    markdown,
    text: sel.toString(),
    prompt: detectPrompt(sel),
    sourceKind: detectSource(),
    url: location.href,
    pageTitle: document.title || '',
    suggestedTitle: suggestTitle(markdown),
  };
})();
