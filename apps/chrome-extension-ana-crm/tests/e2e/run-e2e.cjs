// Teste de ponta a ponta do ANA CRM no Chrome real (Playwright).
// Serve a simulação do WhatsApp Web em https://web.whatsapp.com e intercepta a
// API do CRM para conferir o payload. Rodar (a partir da raiz do repositório):
//   npm i playwright   # em qualquer pasta; aponte NODE_PATH para o node_modules
//   CHROME_PATH=/caminho/do/chrome NODE_PATH=/pasta/node_modules node apps/chrome-extension-ana-crm/tests/e2e/run-e2e.cjs
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EXT = path.resolve(__dirname, '..', '..');
const MOCK = fs.readFileSync(path.resolve(__dirname, '..', 'mock', 'whatsapp.html'), 'utf8');
const OUT = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'ana-crm-e2e-'));
const API = 'https://crm.anovaadvocacia.ai/api/public/whatsapp-extension-lead';

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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ana-crm-profile-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox'],
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  const errors = [];
  const requests = [];
  let nextResponse = { status: 201, body: { booking_id: 'bk_abc123', messages_inserted: 100, messages_skipped: 0 } };
  const queuedResponses = [];

  await ctx.route('https://web.whatsapp.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: MOCK }));
  await ctx.route('https://crm.anovaadvocacia.ai/**', async (route) => {
    const req = route.request();
    requests.push({ method: req.method(), url: req.url(), headers: req.headers(), body: req.postData() });
    const res = queuedResponses.length ? queuedResponses.shift() : nextResponse;
    await route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.body) });
  });

  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
  const extId = new URL(sw.url()).host;
  check('extensão carregada com ID fixo', extId === 'ocojkokdndcicajefhkigaimonmicmek', extId);

  const wa = await ctx.newPage();
  await wa.goto('https://web.whatsapp.com/?chat=saved');
  await wa.waitForSelector('#main [data-id]');

  const panel = await ctx.newPage();
  await panel.setViewportSize({ width: 400, height: 1000 });
  panel.on('console', (m) => {
    // o próprio teste provoca respostas 401, 422 e 503 para conferir as mensagens de erro
    if (m.type() === 'error' && !/Failed to load resource: .* (401|422|503)/.test(m.text())) errors.push(`painel: ${m.text()}`);
  });
  panel.on('pageerror', (e) => errors.push(`painel: ${e}`));
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);

  // ── 1. Leitura inicial ──
  await waitFor(async () => (await panel.inputValue('#f-name')) === 'Maria Silva');
  check('status mostra a conversa ativa', /Maria Silva/.test(await panel.textContent('#status-text')));
  check('nome identificado', (await panel.inputValue('#f-name')) === 'Maria Silva');
  check('telefone identificado pelo número da conversa', (await panel.inputValue('#f-phone')) === '+55 (11) 98765-4321');
  check('dica do telefone: identificado pela conversa', /número da conversa/.test(await panel.textContent('#phone-hint')));
  check('contador com as mensagens visíveis', (await panel.textContent('#msg-count')) === '40', await panel.textContent('#msg-count'));
  check('aviso de configuração pendente', await panel.isVisible('#setup-banner'));

  // ── 2. Buscar mensagens mais antigas (rolagem automática) ──
  const fromBottomBefore = await wa.evaluate(() => {
    const s = document.querySelector('.scroller');
    return s.scrollHeight - s.scrollTop;
  });
  await panel.click('#btn-load-older');
  await waitFor(async () => (await panel.textContent('#msg-count')) === '100', 20000);
  check('carrega até 100 mensagens rolando a conversa', (await panel.textContent('#msg-count')) === '100', await panel.textContent('#msg-count'));
  const fromBottomAfter = await wa.evaluate(() => {
    const s = document.querySelector('.scroller');
    return s.scrollHeight - s.scrollTop;
  });
  check('conversa volta ao ponto em que o usuário estava', Math.abs(fromBottomAfter - fromBottomBefore) < 5, `${fromBottomBefore} → ${fromBottomAfter}`);
  check('botão indica limite atingido', /Limite de 100/.test(await panel.textContent('#btn-load-older-label')));
  await panel.click('#msg-preview summary');
  await panel.screenshot({ path: path.join(OUT, '1-pronto.png'), fullPage: true });

  // ── 3. Sincronizar sem configurar abre as configurações ──
  await panel.click('#btn-sync');
  check('sem configuração, abre a tela de configurações', await panel.isVisible('#view-settings') && await panel.isVisible('#settings-intro'));
  check('URL padrão da API preenchida', (await panel.inputValue('#s-api')) === API);
  await panel.fill('#s-key', 'chave-teste-123');
  await panel.fill('#s-email', 'email-invalido');
  await panel.click('#form-settings button[type=submit]');
  check('valida o e-mail do sócio', /e-mail válido/.test(await panel.textContent('#settings-error')));
  await panel.fill('#s-email', 'lucas@bragaadv.com.br');
  await panel.screenshot({ path: path.join(OUT, '2-configuracoes.png'), fullPage: true });
  await panel.click('#form-settings button[type=submit]');
  await waitFor(async () => panel.isVisible('#view-main'));
  const stored = await panel.evaluate(() => chrome.storage.sync.get(null));
  check('configurações salvas em chrome.storage.sync', stored.extensionKey === 'chave-teste-123' && stored.partnerEmail === 'lucas@bragaadv.com.br' && stored.apiUrl === API);
  check('aviso de configuração some', await panel.isHidden('#setup-banner'));
  check('mostra o e-mail de quem está enviando', (await panel.textContent('#sending-as-email')) === 'lucas@bragaadv.com.br' && await panel.isVisible('#sending-as'));

  // ── 4. Sincronização com sucesso ──
  await panel.fill('#f-email', 'maria@email');
  await panel.click('#btn-sync');
  check('valida o e-mail do lead', /e-mail do lead/.test(await panel.textContent('#form-error')));
  await panel.fill('#f-email', 'maria@email.com');
  await panel.fill('#f-notes', 'Cliente interessado no plano Starter');
  await panel.click('#btn-sync');
  await waitFor(async () => panel.isVisible('#result'), 10000);
  check('uma requisição enviada ao CRM', requests.length === 1, String(requests.length));
  const req = requests[0];
  const body = JSON.parse(req.body);
  check('POST na URL da API', req.method === 'POST' && req.url === API);
  check('cabeçalho x-extension-key', req.headers['x-extension-key'] === 'chave-teste-123');
  check('cabeçalho Content-Type JSON', /application\/json/.test(req.headers['content-type']));
  check('partner_email', body.partner_email === 'lucas@bragaadv.com.br');
  check('contact completo', JSON.stringify(body.contact) === JSON.stringify({ name: 'Maria Silva', phone: '5511987654321', email: 'maria@email.com' }), JSON.stringify(body.contact));
  check('notes', body.notes === 'Cliente interessado no plano Starter');
  check('somente os campos do contrato no topo', JSON.stringify(Object.keys(body)) === JSON.stringify(['partner_email', 'contact', 'notes', 'messages']));

  const msgs = body.messages;
  check('100 mensagens enviadas', msgs.length === 100, String(msgs.length));
  check('cada mensagem tem só external_id, from_me, text, timestamp', msgs.every((m) => JSON.stringify(Object.keys(m)) === JSON.stringify(['external_id', 'from_me', 'text', 'timestamp'])));
  check('external_id é o ID do WhatsApp', msgs.every((m) => /^3EB0SAV[0-9A-F]{6}$/.test(m.external_id)), msgs[0].external_id);
  check('external_id sem duplicatas', new Set(msgs.map((m) => m.external_id)).size === msgs.length);
  check('timestamps em ISO', msgs.every((m) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.timestamp)));
  check('ordem cronológica', msgs.every((m, i) => i === 0 || msgs[i - 1].timestamp <= m.timestamp));
  check('são as 100 mais recentes (sem as 30 mais antigas)', msgs[0].external_id === '3EB0SAV00001E', msgs[0].external_id);
  const last = msgs[msgs.length - 1];
  check('última mensagem é do sócio (from_me)', last.from_me === true && last.text === 'Perfeito, Maria! Vou te enviar o contrato hoje.');
  check('from_me false nas recebidas', msgs.filter((m) => !m.from_me).length > 40);
  const byText = (re) => msgs.find((m) => re.test(m.text));
  check('emoji convertido em texto', Boolean(byText(/^Obrigada! 🙏$/)));
  const reply = byText(/^Fechado, pode seguir$/);
  check('resposta sem o texto citado', Boolean(reply) && !msgs.some((m) => /Qual o valor dos honorários/.test(m.text)));
  check('áudio vira [Áudio]', msgs.filter((m) => m.text === '[Áudio]').length === 2);
  check('imagem vira [Imagem]', Boolean(byText(/^\[Imagem\]$/)));
  check('mensagem apagada vira [Mensagem apagada]', Boolean(byText(/^\[Mensagem apagada\]$/)));
  const longMsg = byText(/^Começo do texto longo/);
  check('"Ler mais" expandido: texto completo', Boolean(longMsg) && /FIM DO TEXTO LONGO$/.test(longMsg.text));
  check('quebras de linha preservadas', Boolean(byText(/^Linha um do endereço\nLinha dois do endereço$/)));

  const audios = msgs.filter((m) => m.text === '[Áudio]');
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yAudio = new Date(audios[0].timestamp);
  check('áudio sem data usa a divisória "ONTEM"', yAudio.getDate() === y.getDate() && yAudio.getHours() === 15 && yAudio.getMinutes() === 50, yAudio.toString());

  const link = await panel.getAttribute('#result-link', 'href');
  check('link do card do lead no CRM', link === 'https://crm.anovaadvocacia.ai/admin/pipeline?booking=bk_abc123', link);
  check('resultado mostra contagem do CRM', /100 mensagens enviadas · 100 novas, 0 já estavam/.test(await panel.textContent('#result-text')), await panel.textContent('#result-text'));
  check('última sincronização registrada', /Última sincronização/.test(await panel.textContent('#last-sync')));
  check('indica que tudo já foi enviado', /tudo já enviado/.test(await panel.textContent('#last-sync')), await panel.textContent('#last-sync'));
  await panel.screenshot({ path: path.join(OUT, '3-sincronizado.png'), fullPage: true });

  // ── 5. Reenvio: IDs estáveis ──
  nextResponse = { status: 200, body: { booking_id: 'bk_abc123', messages_inserted: 0, messages_skipped: 100 } };
  await panel.click('#btn-sync');
  await waitFor(async () => requests.length === 2, 10000);
  await waitFor(async () => /já estavam/.test(await panel.textContent('#result-text')));
  const body2 = JSON.parse(requests[1].body);
  check('reenvio usa os mesmos external_id', JSON.stringify(body2.messages.map((m) => m.external_id)) === JSON.stringify(msgs.map((m) => m.external_id)));
  check('reenvio mostra duplicadas do CRM', /100 já estavam no CRM/.test(await panel.textContent('#result-text')));

  // ── 6. Erros da API ──
  nextResponse = { status: 401, body: { error: 'invalid key' } };
  await panel.click('#btn-sync');
  await waitFor(async () => panel.isVisible('#form-error'), 10000);
  check('401 explica a chave recusada', /recusou a chave/.test(await panel.textContent('#form-error')));
  nextResponse = { status: 422, body: { error: 'phone inválido' } };
  await panel.click('#btn-sync');
  await waitFor(async () => /phone inválido/.test(await panel.textContent('#form-error')), 10000);
  check('422 mostra o motivo do CRM', /recusou os dados enviados: phone inválido/.test(await panel.textContent('#form-error')));
  nextResponse = { status: 201, body: { booking_id: 'bk_abc123' } };

  // ── 6b. Mensagem nova, pendentes, nova tentativa automática e Ctrl+Enter ──
  await wa.evaluate(() => window.__addIncoming('Esqueci de perguntar: aceita parcelamento?'));
  await panel.click('#btn-refresh');
  await waitFor(async () => /ainda não enviada/.test(await panel.textContent('#last-sync')));
  check('mostra mensagens ainda não enviadas ao CRM', /1 mensagem ainda não enviada/.test(await panel.textContent('#last-sync')), await panel.textContent('#last-sync'));
  const before503 = requests.length;
  queuedResponses.push({ status: 503, body: { error: 'manutenção' } }, { status: 201, body: { booking_id: 'bk_abc123' } });
  await panel.focus('#f-notes');
  await panel.keyboard.press('Control+Enter');
  await waitFor(async () => requests.length === before503 + 2 && await panel.isVisible('#result'), 12000);
  check('Ctrl+Enter sincroniza', requests.length >= before503 + 1);
  check('503 é reenviado sozinho e termina com sucesso', requests.length === before503 + 2 && await panel.isVisible('#result') && await panel.isHidden('#form-error'));
  const lastBody = JSON.parse(requests[requests.length - 1].body);
  check('reenvio inclui a mensagem nova', lastBody.messages.some((m) => /parcelamento/.test(m.text)) && lastBody.messages.length === 100);
  await waitFor(async () => /tudo já enviado/.test(await panel.textContent('#last-sync')));
  check('pendentes zeram depois do envio', /tudo já enviado/.test(await panel.textContent('#last-sync')));

  // ── 7. Troca de conversa e rascunho por contato ──
  await panel.fill('#f-notes', 'Rascunho: retornar na sexta');
  await sleep(600);
  await wa.evaluate(() => window.__switchChat('unsaved'));
  await waitFor(async () => (await panel.inputValue('#f-phone')) === '+55 (11) 91234-5678');
  check('troca de conversa atualiza o painel sozinha', (await panel.inputValue('#f-phone')) === '+55 (11) 91234-5678');
  check('contato não salvo: nome vazio para preencher', (await panel.inputValue('#f-name')) === '');
  check('notas do contato anterior não vazam', (await panel.inputValue('#f-notes')) === '');
  await panel.click('#btn-sync');
  check('exige o nome antes de sincronizar', /Informe o nome/.test(await panel.textContent('#form-error')));
  await wa.evaluate(() => window.__switchChat('saved'));
  await waitFor(async () => (await panel.inputValue('#f-name')) === 'Maria Silva');
  check('rascunho da Maria restaurado', (await panel.inputValue('#f-notes')) === 'Rascunho: retornar na sexta');
  const mariaDraft = (await panel.evaluate(() => chrome.storage.local.get('draft:5511987654321@c.us')))['draft:5511987654321@c.us'];
  check('rascunho guarda só os campos editados', mariaDraft && JSON.stringify(Object.keys(mariaDraft.fields).sort()) === JSON.stringify(['email', 'notes']), JSON.stringify(mariaDraft && Object.keys(mariaDraft.fields)));

  // ── 8. Contato com identificador privado (LID) ──
  await wa.evaluate(() => window.__openOwnProfile()); // seu perfil aberto: o número dele não pode ser usado
  await wa.evaluate(() => window.__switchChat('lid'));
  await waitFor(async () => (await panel.inputValue('#f-name')) === 'Dr. João Pereira');
  check('LID: telefone não aparece na conversa', (await panel.inputValue('#f-phone')) === '');
  check('LID: explica o identificador privado', /identificador privado/.test(await panel.textContent('#phone-hint')));
  check('LID: oferece buscar no perfil', await panel.isVisible('#btn-lookup-phone'));
  await panel.screenshot({ path: path.join(OUT, '4-lid.png'), fullPage: true });
  await panel.click('#btn-lookup-phone');
  await waitFor(async () => (await panel.inputValue('#f-phone')) === '+55 (21) 99876-5432', 8000);
  check('telefone encontrado no perfil do contato (ignora o seu perfil aberto)', (await panel.inputValue('#f-phone')) === '+55 (21) 99876-5432', await panel.inputValue('#f-phone'));
  check('dica: encontrado no perfil', /perfil do contato/.test(await panel.textContent('#phone-hint')));
  check('painel do perfil fechado depois da leitura', await wa.evaluate(() => !document.getElementById('drawer')));

  // ── 9. Grupo ──
  await wa.evaluate(() => window.__switchChat('group'));
  await waitFor(async () => panel.isVisible('#group-banner'));
  check('grupo: aviso exibido', await panel.isVisible('#group-banner'));
  check('grupo: botão de sincronizar desativado', await panel.isDisabled('#btn-sync'));
  await panel.screenshot({ path: path.join(OUT, '5-grupo.png'), fullPage: true });

  // ── 10. Número antigo sem o nono dígito ──
  await wa.evaluate(() => window.__switchChat('old9'));
  await waitFor(async () => (await panel.inputValue('#f-name')) === 'Carlos Antigo');
  check('jid sem nono dígito vira celular completo', (await panel.inputValue('#f-phone')) === '+55 (11) 98765-4321', await panel.inputValue('#f-phone'));

  // ── 10b. Trocar de conversa no meio da busca de mensagens antigas ──
  await wa.evaluate(() => window.__switchChat('saved'));
  await waitFor(async () => (await panel.inputValue('#f-name')) === 'Maria Silva' && (await panel.textContent('#msg-count')) === '40');
  await panel.click('#btn-load-older');
  await sleep(400);
  await wa.evaluate(() => window.__switchChat('old9'));
  await waitFor(async () => (await panel.inputValue('#f-name')) === 'Carlos Antigo' && (await panel.textContent('#msg-count')) === '6', 15000);
  const listText = await panel.textContent('#msg-list');
  check('troca durante a busca: painel segue a conversa nova', (await panel.inputValue('#f-name')) === 'Carlos Antigo' && (await panel.textContent('#msg-count')) === '6', await panel.textContent('#msg-count'));
  check('troca durante a busca: nenhuma mensagem da conversa anterior', !/Mensagem (3\d|4\d|5\d) do contato/.test(listText) && !/Maria/.test(listText));
  const carlosDraft = await panel.evaluate(() => chrome.storage.local.get('draft:551187654321@c.us'));
  check('sem edição, nenhum rascunho é gravado', !carlosDraft['draft:551187654321@c.us']);

  // ── 11. Nenhuma conversa aberta ──
  await wa.evaluate(() => window.__switchChat('none'));
  await waitFor(async () => panel.isVisible('#state-no-chat'));
  check('sem conversa aberta: orienta abrir uma', await panel.isVisible('#state-no-chat'));

  // ── 12. Diagnóstico sem conteúdo das conversas ──
  await wa.evaluate(() => window.__switchChat('saved'));
  await waitFor(async () => (await panel.inputValue('#f-name')) === 'Maria Silva');
  await panel.click('#btn-settings');
  await panel.click('#btn-diagnose');
  await sleep(500);
  const diag = JSON.parse(await panel.evaluate(() => navigator.clipboard.readText()));
  check('diagnóstico reconhece a estrutura', diag.main && diag.header && diag.messageNodes > 0 && diag.prePlainText > 0 && diag.scrollContainer);
  check('diagnóstico não expõe texto das mensagens', !/Maria|Perfeito|contrato/.test(JSON.stringify(diag)), diag.samplePrePlainFormat);

  // ── 13. Reinjeção do script (ex.: depois de atualizar a extensão) ──
  const waTab = await panel.evaluate(async () => (await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }))[0].id);
  const inject = (tabId) => panel.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ['content/wa-parse.js', 'content/wa-capture.js'] }), tabId);
  // operações executadas no mundo isolado do content script, na aba do WhatsApp
  const inWa = (tabId, op) => panel.evaluate(async ([id, name]) => {
    const ops = {
      alive: () => Boolean(globalThis.__anaCrmCapture && globalThis.__anaCrmCapture.isAlive()),
      mark: () => { globalThis.__anaCrmCapture.marker = 1; return true; },
      marked: () => globalThis.__anaCrmCapture.marker === 1,
      fakeOrphan: () => {
        globalThis.__anaCrmCapture = { isAlive: () => false, stop: () => { globalThis.__orphanStopped = true; } };
        return true;
      },
      replaced: () => globalThis.__orphanStopped === true && globalThis.__anaCrmCapture.isAlive(),
    };
    const [r] = await chrome.scripting.executeScript({ target: { tabId: id }, func: ops[name] });
    return r.result;
  }, [tabId, op]);
  check('instância viva registrada', await inWa(waTab, 'alive'));
  await inWa(waTab, 'mark');
  await inject(waTab);
  check('injetar de novo não duplica a instância viva', await inWa(waTab, 'marked'));
  await inWa(waTab, 'fakeOrphan');
  await inject(waTab);
  check('instância órfã é substituída e parada', await inWa(waTab, 'replaced'));

  check('sem erros de console no painel', errors.length === 0, errors.join(' | '));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram · screenshots em ${OUT}`);
  await ctx.close();
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('FALHA:', err);
  process.exit(1);
});
