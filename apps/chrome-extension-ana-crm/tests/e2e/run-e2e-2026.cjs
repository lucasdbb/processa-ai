// Teste de ponta a ponta do ANA CRM contra o WhatsApp Web de nov/2026 (Playwright).
//
// A. Dados internos (?store=1) com a tela de nov/2026 (?dom=2026): telefone de
//    contatos com LID, mensagens com data e hora exatas, mensagens antigas sem rolar,
//    tipos de mídia, avisos do sistema ignorados, atualização com mensagem nova.
// B. Reserva sem os dados internos (?dom=2026): data-id só com o ID, direção pelas
//    marcas data-testid, mensagens vazias fora da tela, grupo pelo autor.
// C. Variações dos dados internos: IDs só em $1 e o carregador antigo (chat).
//
// Rodar (a partir da raiz do repositório):
//   CHROME_PATH=/caminho/do/chrome NODE_PATH=/pasta/node_modules node apps/chrome-extension-ana-crm/tests/e2e/run-e2e-2026.cjs
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EXT = path.resolve(__dirname, '..', '..');
const MOCK = fs.readFileSync(path.resolve(__dirname, '..', 'mock', 'whatsapp.html'), 'utf8');
const OUT = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'ana-crm-e2e-2026-'));
const WA = 'https://web.whatsapp.com/';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 8000, step = 150) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return true;
    } catch {
      // tenta de novo
    }
    await sleep(step);
  }
  return false;
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ana-crm-profile-2026-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox'],
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  const errors = [];
  const requests = [];
  await ctx.route('https://web.whatsapp.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: MOCK }));
  await ctx.route('https://crm.anovaadvocacia.ai/**', async (route) => {
    const req = route.request();
    requests.push({ headers: req.headers(), body: req.postData() });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ booking_id: 'bk_2026' }) });
  });

  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
  const extId = new URL(sw.url()).host;

  const wa = await ctx.newPage();
  wa.on('pageerror', (e) => errors.push(`whatsapp: ${e}`));
  await wa.goto(`${WA}?chat=lid2&store=1&dom=2026`);
  await wa.waitForSelector('#main [data-id]');

  const panel = await ctx.newPage();
  await panel.setViewportSize({ width: 400, height: 1000 });
  panel.on('console', (m) => { if (m.type() === 'error') errors.push(`painel: ${m.text()}`); });
  panel.on('pageerror', (e) => errors.push(`painel: ${e}`));
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  const value = (sel) => panel.inputValue(sel);
  const text = (sel) => panel.textContent(sel);
  const switchChat = async (key, expectName) => {
    await wa.evaluate((k) => window.__switchChat(k), key);
    if (expectName != null) await waitFor(async () => (await value('#f-name')) === expectName, 10000);
  };

  // ════ A. Dados internos + tela de nov/2026 ════

  // ── A1. O caso do print: contato com LID, número só nos dados do contato ──
  await waitFor(async () => (await value('#f-name')) === 'Joana Stanieski', 10000);
  check('LID (Joana): nome lido', (await value('#f-name')) === 'Joana Stanieski');
  check('LID (Joana): telefone puxado sozinho', (await value('#f-phone')) === '+55 (41) 99887-7665', await value('#f-phone'));
  check('LID (Joana): dica diz que veio do WhatsApp', /Identificado pelo WhatsApp/.test(await text('#phone-hint')), await text('#phone-hint'));
  check('LID (Joana): sem botão de buscar no perfil', await panel.isHidden('#btn-lookup-phone'));
  check('LID (Joana): todas as 20 mensagens lidas', (await text('#msg-count')) === '20', await text('#msg-count'));
  check('conversa curta: avisa que foi lida inteira', /conversa inteira/.test(await text('#btn-load-older-label')) && await panel.isDisabled('#btn-load-older'));
  check('WhatsApp não abriu o painel do contato', await wa.evaluate(() => !document.getElementById('drawer')));
  await panel.screenshot({ path: path.join(OUT, 'a1-lid-joana.png'), fullPage: true });

  // ── A2. LID com número na correspondência do WhatsApp ──
  await switchChat('lid', 'Dr. João Pereira');
  await waitFor(async () => (await value('#f-phone')) === '+55 (21) 99876-5432');
  // a troca acontece menos de 1 s depois de o painel abrir: o aviso não pode se perder
  check('troca logo depois de abrir o painel: painel acompanha', (await value('#f-name')) === 'Dr. João Pereira', await value('#f-name'));
  check('LID (getPhoneNumber): telefone puxado sozinho', (await value('#f-phone')) === '+55 (21) 99876-5432', await value('#f-phone'));

  // ── A3. Conversa longa: 100 mensagens sem rolar a tela ──
  const loadsBefore = await wa.evaluate(() => window.__storeCalls.loadEarlier);
  await switchChat('saved', 'Maria Silva');
  await waitFor(async () => (await text('#msg-count')) === '100', 10000);
  check('lê 100 mensagens sozinho, sem clicar em buscar antigas', (await text('#msg-count')) === '100', await text('#msg-count'));
  check('usou o carregador do próprio WhatsApp', (await wa.evaluate(() => window.__storeCalls.loadEarlier)) > loadsBefore);
  check('telefone pelo número da conversa', (await value('#f-phone')) === '+55 (11) 98765-4321' && /número da conversa/.test(await text('#phone-hint')));
  check('botão indica limite atingido', /Limite de 100/.test(await text('#btn-load-older-label')));
  check('a conversa no WhatsApp continua no fim', await wa.evaluate(() => {
    const s = document.querySelector('.scroller');
    return s.scrollHeight - s.scrollTop - s.clientHeight < 5;
  }));

  // ── A4. Envio: conteúdo vindo dos dados internos ──
  await panel.click('#btn-settings');
  await panel.fill('#s-key', 'chave-2026');
  await panel.fill('#s-email', 'socio@escritorio.com.br');
  await panel.click('#form-settings button[type=submit]');
  await waitFor(async () => panel.isVisible('#view-main'));
  await panel.click('#btn-sync');
  await waitFor(async () => panel.isVisible('#result'), 10000);
  check('uma requisição enviada', requests.length === 1, String(requests.length));
  const body = JSON.parse(requests[0].body);
  const msgs = body.messages;
  check('contato correto', JSON.stringify(body.contact) === JSON.stringify({ name: 'Maria Silva', phone: '5511987654321' }), JSON.stringify(body.contact));
  check('100 mensagens', msgs.length === 100, String(msgs.length));
  check('external_id é o ID do WhatsApp', msgs.every((m) => /^3EB0SAV[0-9A-F]{6}$/.test(m.external_id)), msgs[0].external_id);
  check('são as 100 mais recentes', msgs[0].external_id === '3EB0SAV00001E', msgs[0].external_id);
  check('ordem cronológica', msgs.every((m, i) => i === 0 || msgs[i - 1].timestamp <= m.timestamp));
  const last = msgs[msgs.length - 1];
  check('hora exata, com segundos', new Date(last.timestamp).getSeconds() === 57 && last.from_me === true, last.timestamp);
  check('última mensagem é do sócio', last.text === 'Perfeito, Maria! Vou te enviar o contrato hoje.');
  check('direção certa nas duas pontas', msgs.filter((m) => m.from_me).length > 40 && msgs.filter((m) => !m.from_me).length > 40);
  const byText = (re) => msgs.find((m) => re.test(m.text));
  check('emoji e marcas invisíveis', Boolean(byText(/^Obrigada! 🙏$/)));
  check('resposta sem o texto citado', Boolean(byText(/^Fechado, pode seguir$/)) && !msgs.some((m) => /honorários/.test(m.text)));
  check('áudios viram [Áudio]', msgs.filter((m) => m.text === '[Áudio]').length === 2);
  check('imagem vira [Imagem]', Boolean(byText(/^\[Imagem\]$/)));
  check('documento com o nome do arquivo', Boolean(byText(/^\[Documento: contrato\.pdf\]$/)));
  check('localização com link do mapa', Boolean(byText(/^\[Localização\] https:\/\/maps\.google\.com\/\?q=-23\.5505,-46\.6333$/)));
  check('mensagem apagada', msgs.filter((m) => m.text === '[Mensagem apagada]').length === 1);
  check('texto longo completo', Boolean(byText(/^Começo do texto longo[\s\S]*FIM DO TEXTO LONGO$/)));
  check('quebras de linha preservadas', Boolean(byText(/^Linha um do endereço\nLinha dois do endereço$/)));
  check('miniaturas em base64 nunca são enviadas', !msgs.some((m) => /\/9j\/|JVBER|AAAAAAAAAA/.test(m.text)));
  check('avisos do sistema ficam de fora', !msgs.some((m) => /Mensagens protegidas|^Aviso$|NOTIF/.test(m.text + m.external_id)));
  check('marcas invisíveis removidas', msgs.every((m) => !/[‎‏‪-‮⁦-⁩]/.test(m.text)));
  check('link do card', (await panel.getAttribute('#result-link', 'href')) === 'https://crm.anovaadvocacia.ai/admin/pipeline?booking=bk_2026');
  await panel.screenshot({ path: path.join(OUT, 'a4-sincronizado.png'), fullPage: true });

  // ── A5. Mensagem nova: o painel atualiza sozinho ──
  await wa.evaluate(() => window.__addIncoming('Doutor, consegue me ligar amanhã?'));
  const autoUpdated = await waitFor(async () => /1 mensagem ainda não enviada/.test(await text('#last-sync')), 9000);
  check('mensagem nova aparece sem clicar em atualizar', autoUpdated, await text('#last-sync'));
  check('a lista inclui a mensagem nova', /consegue me ligar amanhã/.test(await text('#msg-list')));

  // ── A6. Contato não salvo: nome que a pessoa definiu no WhatsApp ──
  await switchChat('unsaved', 'Ana Paula');
  check('não salvo: nome do perfil do WhatsApp', (await value('#f-name')) === 'Ana Paula', await value('#f-name'));
  check('não salvo: telefone', (await value('#f-phone')) === '+55 (11) 91234-5678', await value('#f-phone'));

  // ── A7. LID sem número disponível ──
  await switchChat('lidnone', 'Contato Reservado');
  await sleep(500);
  check('LID sem número: campo vazio', (await value('#f-phone')) === '');
  check('LID sem número: explica e oferece buscar no perfil', /identificador privado/.test(await text('#phone-hint')) && await panel.isVisible('#btn-lookup-phone'));

  // ── A8. Grupo, canal e número antigo ──
  await switchChat('group');
  await waitFor(async () => panel.isVisible('#group-banner'));
  check('grupo bloqueado', await panel.isVisible('#group-banner') && await panel.isDisabled('#btn-sync'));
  await switchChat('channel');
  await waitFor(async () => /canal/.test(await text('#group-banner')));
  check('canal bloqueado', /canal/.test(await text('#group-banner')) && await panel.isDisabled('#btn-sync'));
  await switchChat('old9', 'Carlos Antigo');
  check('número sem o nono dígito', (await value('#f-phone')) === '+55 (11) 98765-4321', await value('#f-phone'));

  // ── A9. Troca de conversa enquanto as antigas carregam ──
  await wa.evaluate(() => window.__switchChat('saved'));
  await sleep(120);
  await switchChat('old9');
  await waitFor(async () => (await value('#f-name')) === 'Carlos Antigo' && (await text('#msg-count')) === '6', 15000);
  await sleep(1500);
  const listAfter = await text('#msg-list');
  check('troca durante a leitura: segue a conversa nova', (await value('#f-name')) === 'Carlos Antigo' && (await text('#msg-count')) === '6', await text('#msg-count'));
  check('troca durante a leitura: nada da conversa anterior', !/Maria|Mensagem (9\d|1[0-2]\d) do contato/.test(listAfter));

  // ── A10. Diagnóstico ──
  await switchChat('saved', 'Maria Silva');
  await panel.click('#btn-settings');
  await panel.click('#btn-diagnose');
  await sleep(600);
  const diag = JSON.parse(await panel.evaluate(() => navigator.clipboard.readText()));
  check('diagnóstico: ponte e módulos', diag.bridge && diag.bridge.present && diag.bridge.modules && diag.bridge.modules.chat && diag.bridge.modules.apiContact && diag.bridge.activeChat, JSON.stringify(diag.bridge));
  check('diagnóstico: formato de ID $1 e tela de 2026', diag.bridge.idFormat === '$1' && diag.headerTitleMarked && diag.testidRows > 0);
  check('diagnóstico: sem nomes, números ou textos', !/Maria|Silva|98765|5511987654321|Perfeito|contrato/.test(JSON.stringify(diag)));
  await panel.click('#btn-back');

  // ── A11. Reinjeção da ponte ──
  const waTab = await panel.evaluate(async () => (await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }))[0].id);
  const injectBridge = () => panel.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ['content/wa-bridge.js'], world: 'MAIN' }), waTab);
  await injectBridge();
  await panel.click('#btn-refresh');
  await waitFor(async () => (await text('#msg-count')) === '100');
  check('injetar a ponte de novo não quebra a leitura', (await text('#msg-count')) === '100');
  await wa.evaluate(() => {
    const key = Symbol.for('ana-crm.bridge');
    const current = window[key];
    current.dispose();
    Object.defineProperty(window, key, { configurable: true, value: { version: 0, dispose() { window.__oldBridgeDisposed = true; } } });
  });
  await injectBridge();
  check('ponte de versão antiga é substituída', await wa.evaluate(() => window.__oldBridgeDisposed === true && window[Symbol.for('ana-crm.bridge')].version >= 1));
  await panel.click('#btn-refresh');
  await waitFor(async () => (await value('#f-name')) === 'Maria Silva' && (await text('#msg-count')) === '100');
  check('nova ponte responde', (await text('#msg-count')) === '100');

  // ════ B. Reserva: só a tela de nov/2026, sem os dados internos ════

  await wa.goto(`${WA}?chat=saved&dom=2026`);
  await wa.waitForSelector('#main [data-id]');
  await wa.evaluate(() => {
    // direção só pelo status de entrega: sem os rabichos da primeira mensagem de cada sequência
    document.querySelectorAll('[data-testid="tail-out"]').forEach((n) => n.remove());
    // e uma mensagem sua sem nenhuma marca: vale o autor do data-pre-plain-text
    const own = document.querySelector('[data-id="3EB0SAV000075"]');
    own.querySelectorAll('[data-testid="msg-meta"]').forEach((n) => n.removeAttribute('role'));
    own.querySelectorAll('[data-icon^="msg-"]').forEach((n) => n.remove());
  });
  await panel.click('#btn-refresh');
  await waitFor(async () => (await value('#f-name')) === 'Maria Silva' && (await text('#msg-count')) === '37', 10000);
  check('tela 2026: título pelo data-testid', (await value('#f-name')) === 'Maria Silva');
  check('tela 2026: mensagens vazias fora da tela são ignoradas (37 de 40)', (await text('#msg-count')) === '37', await text('#msg-count'));
  check('tela 2026: sem o número na tela, oferece buscar no perfil', (await value('#f-phone')) === '' && await panel.isVisible('#btn-lookup-phone'));
  await panel.click('#btn-lookup-phone');
  await waitFor(async () => (await value('#f-phone')) === '+55 (11) 98765-4321', 8000);
  check('tela 2026: telefone encontrado no perfil', (await value('#f-phone')) === '+55 (11) 98765-4321', await value('#f-phone'));
  const beforeDom = requests.length;
  await panel.click('#btn-sync');
  await waitFor(async () => requests.length === beforeDom + 1, 10000);
  const domMsgs = JSON.parse(requests[requests.length - 1].body).messages;
  const domById = (id) => domMsgs.find((m) => m.external_id === id);
  check('tela 2026: external_id é o ID puro do data-id', domMsgs.length === 37 && domMsgs.every((m) => /^3EB0SAV[0-9A-F]{6}$/.test(m.external_id)), domMsgs[0] && domMsgs[0].external_id);
  check('tela 2026: suas mensagens pelo status de entrega', domById('3EB0SAV000081').from_me === true && domById('3EB0SAV00007D').from_me === true);
  check('tela 2026: sem marca, vale o autor', domById('3EB0SAV000075').from_me === true);
  check('tela 2026: recebidas continuam do lead', domById('3EB0SAV000080').from_me === false && domById('3EB0SAV00007E').from_me === false);
  check('tela 2026: citação ignorada pelo data-testid', Boolean(domMsgs.find((m) => m.text === 'Fechado, pode seguir')) && !domMsgs.some((m) => /honorários/.test(m.text)));
  check('tela 2026: nenhuma "[Mensagem sem texto]"', !domMsgs.some((m) => /sem texto/.test(m.text)));

  await panel.click('#btn-load-older');
  await waitFor(async () => (await text('#msg-count')) === '100', 25000);
  check('tela 2026: busca as antigas rolando a conversa', (await text('#msg-count')) === '100', await text('#msg-count'));

  await switchChat('group');
  await waitFor(async () => panel.isVisible('#group-banner'), 10000);
  check('tela 2026: grupo reconhecido pelo autor das mensagens', await panel.isVisible('#group-banner') && await panel.isDisabled('#btn-sync'));

  await switchChat('saved', 'Maria Silva');
  await panel.click('#btn-settings');
  await panel.click('#btn-diagnose');
  await sleep(600);
  const diagDom = JSON.parse(await panel.evaluate(() => navigator.clipboard.readText()));
  check('diagnóstico (reserva): ponte sem acesso e formato só-ID', diagDom.bridge.present && diagDom.bridge.modules && !diagDom.bridge.modules.chat && diagDom.dataIdFormats['so-id'] > 0 && diagDom.placeholders === 3, JSON.stringify({ b: diagDom.bridge.modules, f: diagDom.dataIdFormats, p: diagDom.placeholders }));
  await panel.click('#btn-back');

  // ════ C. Variações dos dados internos ════

  await wa.goto(`${WA}?chat=saved&store=1&dom=2026&ids=min&loader=chat`);
  await wa.waitForSelector('#main [data-id]');
  await panel.click('#btn-refresh');
  await waitFor(async () => (await text('#msg-count')) === '100', 12000);
  check('IDs só em $1 e carregador antigo: 100 mensagens', (await text('#msg-count')) === '100', await text('#msg-count'));
  check('IDs só em $1: telefone pelo texto do ID', (await value('#f-phone')) === '+55 (11) 98765-4321', await value('#f-phone'));
  const beforeMin = requests.length;
  await panel.click('#btn-sync');
  await waitFor(async () => requests.length === beforeMin + 1, 10000);
  const minMsgs = JSON.parse(requests[requests.length - 1].body).messages;
  check('IDs só em $1: external_id e direção lidos do texto do ID',
    minMsgs.length === 100 && minMsgs.every((m) => /^3EB0SAV[0-9A-F]{6}$/.test(m.external_id))
    && minMsgs[minMsgs.length - 1].from_me === true && minMsgs.find((m) => m.external_id === '3EB0SAV000080').from_me === false);

  await wa.goto(`${WA}?chat=lid&store=1&dom=2026&ids=old`);
  await wa.waitForSelector('#main [data-id]');
  await panel.click('#btn-refresh');
  await waitFor(async () => (await value('#f-phone')) === '+55 (21) 99876-5432', 10000);
  check('IDs com _serialized (antes de jul/2026): LID resolvido', (await value('#f-phone')) === '+55 (21) 99876-5432', await value('#f-phone'));

  check('sem erros de console', errors.length === 0, errors.join(' | '));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram · screenshots em ${OUT}`);
  await ctx.close();
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('FALHA:', err);
  process.exit(1);
});
