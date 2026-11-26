// ANA CRM — interpretação dos dados do WhatsApp Web (funções puras).
// Não toca no DOM: é carregado antes do wa-capture.js no WhatsApp Web, também
// pelo painel lateral (telefone) e roda em Node nos testes (tests/wa-parse.test.mjs).
(function (root) {
  'use strict';

  const MONTHS = {
    jan: 1, janeiro: 1, january: 1, enero: 1,
    fev: 2, fevereiro: 2, feb: 2, february: 2, febrero: 2,
    mar: 3, marco: 3, march: 3, marzo: 3,
    abr: 4, abril: 4, apr: 4, april: 4,
    mai: 5, maio: 5, may: 5, mayo: 5,
    jun: 6, junho: 6, june: 6, junio: 6,
    jul: 7, julho: 7, july: 7, julio: 7,
    ago: 8, agosto: 8, aug: 8, august: 8,
    set: 9, setembro: 9, sep: 9, sept: 9, september: 9, septiembre: 9,
    out: 10, outubro: 10, oct: 10, october: 10, octubre: 10,
    nov: 11, novembro: 11, november: 11, noviembre: 11,
    dez: 12, dezembro: 12, dec: 12, december: 12, dic: 12, diciembre: 12,
  };

  const WEEKDAYS = {
    domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5,
  };

  const DELETED_RE = /(esta mensagem foi apagada|voce apagou esta mensagem|this message was deleted|you deleted this message|se elimino este mensaje|eliminaste este mensaje)/;

  // O WhatsApp cerca números e horários com marcas invisíveis de direção de texto
  // (ex.: "‪+55 11 91234-5678‬"), que quebram comparações e regex ancoradas.
  const BIDI_MARKS_RE = /[‎‏‪-‮⁦-⁩﻿]/g;

  function stripMarks(value) {
    return String(value == null ? '' : value).replace(BIDI_MARKS_RE, '');
  }

  function fold(value) {
    return stripMarks(value)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  function digits(value) {
    return String(value == null ? '' : value).replace(/\D/g, '');
  }

  // ─── Identificadores do WhatsApp ───

  // data-id das mensagens: "<true|false>_<jid da conversa>_<id da mensagem>[_<jid do participante>]"
  function parseDataId(value) {
    const m = /^(true|false)_([^_\s]+@[a-z.]+)_([^_\s]+)(?:_(\S+))?$/i.exec(String(value || ''));
    if (!m) return null;
    return {
      fromMe: m[1].toLowerCase() === 'true',
      chatJid: m[2],
      messageId: m[3],
      participant: m[4] || null,
    };
  }

  function jidKind(jid) {
    const j = String(jid || '').toLowerCase();
    if (!j) return 'unknown';
    if (j.endsWith('@g.us')) return 'group';
    if (j.endsWith('@lid')) return 'lid';
    if (j.endsWith('@newsletter')) return 'newsletter';
    if (j.endsWith('@broadcast')) return 'broadcast';
    if (j.endsWith('@c.us') || j.endsWith('@s.whatsapp.net')) return 'user';
    return 'unknown';
  }

  function phoneFromJid(jid) {
    if (jidKind(jid) !== 'user') return '';
    return digits(String(jid).split('@')[0].split(':')[0]);
  }

  // ─── Telefone ───

  // Normaliza para dígitos com código do país (ex.: 5511987654321).
  // international: o valor já traz o código do país (jid do WhatsApp, "+55...").
  function normalizePhone(raw, opts = {}) {
    const str = String(raw == null ? '' : raw).trim();
    let d = digits(str);
    if (!d) return '';
    const international = Boolean(opts.international) || str.startsWith('+') || d.startsWith('00');
    if (d.startsWith('00')) d = d.slice(2);
    if (!international) {
      if (/^0\d{10,11}$/.test(d)) d = d.slice(1); // 0 + DDD + número
      if (d.length === 10 || d.length === 11) d = '55' + d; // DDD + número, sem o 55
    }
    // celular brasileiro registrado no WhatsApp sem o nono dígito (55 + DDD + 8 dígitos)
    if (d.length === 12 && d.startsWith('55') && /[6-9]/.test(d.charAt(4))) {
      d = d.slice(0, 4) + '9' + d.slice(4);
    }
    return d;
  }

  function isValidPhone(value) {
    return /^\d{10,15}$/.test(String(value || ''));
  }

  function formatPhone(value) {
    const d = digits(value);
    if (d.startsWith('55') && d.length === 13) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    if (d.startsWith('55') && d.length === 12) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
    return d ? `+${d}` : '';
  }

  function looksLikePhone(value) {
    const s = stripMarks(value).trim();
    return /^\+?[\d\s().\-]{8,24}$/.test(s) && digits(s).length >= 8;
  }

  // ─── Datas e horas ───

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }

  // hint: 'mdy' | 'dmy' | código de idioma (en-US usa mês primeiro)
  function isMonthFirst(hint) {
    const h = String(hint || '').toLowerCase();
    if (h === 'mdy') return true;
    if (h === 'dmy') return false;
    return h === 'en' || h.startsWith('en-us') || h.startsWith('en_us');
  }

  function dateFromParts(a, b, c, hint) {
    const A = Number(a);
    const B = Number(b);
    const C = Number(c);
    let y;
    let m;
    let d;
    if (String(a).length === 4) {
      y = A; m = B; d = C;
    } else {
      y = String(c).length <= 2 ? 2000 + C : C;
      if (A > 12) { d = A; m = B; }
      else if (B > 12) { m = A; d = B; }
      else if (isMonthFirst(hint)) { m = A; d = B; }
      else { d = A; m = B; }
    }
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  function to24h(h, m, s, ampm) {
    let hour = Number(h);
    const min = Number(m);
    const sec = Number(s || 0);
    if (ampm) {
      const pm = ampm.toLowerCase() === 'p';
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    if (hour > 23 || min > 59 || sec > 59) return null;
    return { h: hour, m: min, s: sec };
  }

  // Hora isolada, como a exibida no canto da mensagem ("14:10", "2:10 PM")
  function parseTimeOnly(value) {
    const m = /^\s*(\d{1,2})[:.](\d{2})(?:\s*([ap])\.?\s?m\.?)?\s*$/i.exec(stripMarks(value));
    return m ? to24h(m[1], m[2], 0, m[3]) : null;
  }

  function parseTimeLoose(value) {
    const m = /(\d{1,2})[:.h](\d{2})(?:[:.](\d{2}))?(?:\s*([ap])\.?\s?m\.?)?/i.exec(String(value || ''));
    return m ? to24h(m[1], m[2], m[3], m[4]) : null;
  }

  // data-pre-plain-text: "[14:10, 26/11/2026] Maria Silva: " (formato varia com o idioma)
  function parsePrePlainText(value, hint) {
    const m = /^\s*\[([^\]]+)\]\s*([\s\S]*?):\s*$/.exec(stripMarks(value));
    if (!m) return null;
    let inside = m[1];
    const dm = /(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})/.exec(inside);
    if (!dm) return null;
    const day = dateFromParts(dm[1], dm[2], dm[3], hint);
    inside = inside.replace(dm[0], ' ');
    const t = parseTimeLoose(inside);
    if (!day || !t) return null;
    return {
      date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m, t.s),
      sender: m[2].trim(),
    };
  }

  // Descobre se as datas da conversa são dia/mês ou mês/dia olhando os valores sem ambiguidade
  function inferDateOrder(values) {
    let dmy = 0;
    let mdy = 0;
    for (const v of values || []) {
      const inside = /\[([^\]]+)\]/.exec(String(v || ''));
      if (!inside) continue;
      const d = /(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})/.exec(inside[1]);
      if (!d || d[1].length === 4) continue;
      if (Number(d[1]) > 12) dmy++;
      else if (Number(d[2]) > 12) mdy++;
    }
    if (dmy && !mdy) return 'dmy';
    if (mdy && !dmy) return 'mdy';
    return null;
  }

  function guessYear(month, day, today) {
    const y = today.getFullYear();
    const candidate = new Date(y, month - 1, day);
    return candidate > today ? y - 1 : y;
  }

  // Divisórias de data da conversa: "HOJE", "ONTEM", "SEGUNDA-FEIRA", "20/11/2026", "20 de novembro de 2025"
  function parseDateLabel(label, now = new Date(), hint = '') {
    const s = fold(label).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || s.length > 40) return null;
    const today = startOfDay(now);
    if (/^(hoje|today|hoy)$/.test(s)) return today;
    if (/^(ontem|yesterday|ayer)$/.test(s)) return addDays(today, -1);

    const firstWord = s.split(/[\s-]/)[0];
    if (WEEKDAYS[firstWord] != null && /^[a-z\s-]+$/.test(s)) {
      let diff = (today.getDay() - WEEKDAYS[firstWord] + 7) % 7;
      if (diff === 0) diff = 7;
      return addDays(today, -diff);
    }

    const num = /^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/.exec(s);
    if (num) return dateFromParts(num[1], num[2], num[3], hint);

    const dayFirst = /^(\d{1,2}) (?:de )?([a-z]+)(?: (?:de )?(\d{4}))?$/.exec(s);
    if (dayFirst && MONTHS[dayFirst[2]]) {
      const month = MONTHS[dayFirst[2]];
      const day = Number(dayFirst[1]);
      const year = dayFirst[3] ? Number(dayFirst[3]) : guessYear(month, day, today);
      return dateFromParts(year, month, day);
    }

    const monthFirst = /^([a-z]+) (\d{1,2})(?: (\d{4}))?$/.exec(s);
    if (monthFirst && MONTHS[monthFirst[1]]) {
      const month = MONTHS[monthFirst[1]];
      const day = Number(monthFirst[2]);
      const year = monthFirst[3] ? Number(monthFirst[3]) : guessYear(month, day, today);
      return dateFromParts(year, month, day);
    }
    return null;
  }

  // ─── Outros ───

  function isDeletedText(foldedText) {
    return DELETED_RE.test(foldedText);
  }

  // ID estável para mensagens sem data-id: hash de conversa + direção + horário + texto
  async function stableId(parts) {
    const data = new TextEncoder().encode(parts.join('␟'));
    const buf = await root.crypto.subtle.digest('SHA-256', data);
    return 'h_' + [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const api = {
    stripMarks,
    fold,
    digits,
    parseDataId,
    jidKind,
    phoneFromJid,
    normalizePhone,
    isValidPhone,
    formatPhone,
    looksLikePhone,
    startOfDay,
    parseTimeOnly,
    parsePrePlainText,
    inferDateOrder,
    parseDateLabel,
    isDeletedText,
    stableId,
  };

  root.AnaWa = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
