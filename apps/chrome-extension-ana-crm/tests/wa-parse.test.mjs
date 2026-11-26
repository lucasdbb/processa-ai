// Testes das funções puras de interpretação do WhatsApp Web.
// Rodar: node --test 'apps/chrome-extension-ana-crm/tests/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const W = require('../content/wa-parse.js');

const ymdhm = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];

test('parseDataId: mensagem recebida, enviada e de grupo', () => {
  assert.deepEqual(W.parseDataId('false_5511987654321@c.us_3EB0A1B2C3D4E5F6'), {
    fromMe: false, chatJid: '5511987654321@c.us', messageId: '3EB0A1B2C3D4E5F6', participant: null,
  });
  assert.equal(W.parseDataId('true_5511987654321@c.us_ABC123').fromMe, true);
  const g = W.parseDataId('false_120363025@g.us_3EB0FF_5521998765432@c.us');
  assert.equal(g.chatJid, '120363025@g.us');
  assert.equal(g.participant, '5521998765432@c.us');
  assert.equal(W.parseDataId('qualquer-coisa'), null);
});

test('jidKind e phoneFromJid', () => {
  assert.equal(W.jidKind('5511987654321@c.us'), 'user');
  assert.equal(W.jidKind('5511987654321@s.whatsapp.net'), 'user');
  assert.equal(W.jidKind('123456789012345@lid'), 'lid');
  assert.equal(W.jidKind('120363@g.us'), 'group');
  assert.equal(W.phoneFromJid('5511987654321:12@c.us'), '5511987654321');
  assert.equal(W.phoneFromJid('123456789012345@lid'), '');
});

test('normalizePhone: formatos brasileiros e internacionais', () => {
  assert.equal(W.normalizePhone('+55 11 98765-4321'), '5511987654321');
  assert.equal(W.normalizePhone('(11) 98765-4321'), '5511987654321');
  assert.equal(W.normalizePhone('011 98765-4321'), '5511987654321');
  assert.equal(W.normalizePhone('11 3456-7890'), '551134567890');
  assert.equal(W.normalizePhone('0055 11 98765-4321'), '5511987654321');
  // jid antigo sem o nono dígito: celular ganha o 9, fixo não
  assert.equal(W.normalizePhone('551187654321', { international: true }), '5511987654321');
  assert.equal(W.normalizePhone('551134567890', { international: true }), '551134567890');
  // número dos EUA com código do país não recebe 55
  assert.equal(W.normalizePhone('+1 415 555 0123'), '14155550123');
  assert.equal(W.normalizePhone('14155550123', { international: true }), '14155550123');
  assert.equal(W.normalizePhone(''), '');
});

test('formatPhone, isValidPhone e looksLikePhone', () => {
  assert.equal(W.formatPhone('5511987654321'), '+55 (11) 98765-4321');
  assert.equal(W.formatPhone('551134567890'), '+55 (11) 3456-7890');
  assert.equal(W.formatPhone('14155550123'), '+14155550123');
  assert.ok(W.isValidPhone('5511987654321'));
  assert.ok(!W.isValidPhone('12345'));
  assert.ok(W.looksLikePhone('+55 11 98765-4321'));
  assert.ok(!W.looksLikePhone('Maria Silva'));
  assert.ok(!W.looksLikePhone('Escritório 2024'));
});

test('parsePrePlainText: pt-BR, en-US 12h e alemão', () => {
  const pt = W.parsePrePlainText('[14:10, 26/11/2026] Maria Silva: ');
  assert.deepEqual(ymdhm(pt.date), [2026, 11, 26, 14, 10]);
  assert.equal(pt.sender, 'Maria Silva');

  const en = W.parsePrePlainText('[2:10 PM, 11/26/2026] John: ');
  assert.deepEqual(ymdhm(en.date), [2026, 11, 26, 14, 10]);
  const enAm = W.parsePrePlainText('[12:05 AM, 11/26/2026] John: ');
  assert.deepEqual(ymdhm(enAm.date), [2026, 11, 26, 0, 5]);

  const de = W.parsePrePlainText('[14:10, 26.11.2026] Anna: ');
  assert.deepEqual(ymdhm(de.date), [2026, 11, 26, 14, 10]);

  // data ambígua (05/11): segue a ordem inferida da conversa
  assert.deepEqual(ymdhm(W.parsePrePlainText('[09:00, 05/11/2026] X: ', 'dmy').date), [2026, 11, 5, 9, 0]);
  assert.deepEqual(ymdhm(W.parsePrePlainText('[9:00 AM, 05/11/2026] X: ', 'mdy').date), [2026, 5, 11, 9, 0]);
  assert.equal(W.parsePrePlainText('sem colchetes'), null);
});

test('inferDateOrder', () => {
  assert.equal(W.inferDateOrder(['[14:10, 26/11/2026] A: ', '[14:11, 05/11/2026] A: ']), 'dmy');
  assert.equal(W.inferDateOrder(['[2:10 PM, 11/26/2026] A: ']), 'mdy');
  assert.equal(W.inferDateOrder(['[14:10, 05/11/2026] A: ']), null);
});

test('parseDateLabel: hoje, ontem, dia da semana e datas', () => {
  const now = new Date(2026, 10, 26, 15, 0); // quinta-feira, 26/11/2026
  assert.deepEqual(ymdhm(W.parseDateLabel('HOJE', now)), [2026, 11, 26, 0, 0]);
  assert.deepEqual(ymdhm(W.parseDateLabel('Ontem', now)), [2026, 11, 25, 0, 0]);
  assert.deepEqual(ymdhm(W.parseDateLabel('SEGUNDA-FEIRA', now)), [2026, 11, 23, 0, 0]);
  assert.deepEqual(ymdhm(W.parseDateLabel('Thursday', now)), [2026, 11, 19, 0, 0]);
  assert.deepEqual(ymdhm(W.parseDateLabel('20/11/2026', now)), [2026, 11, 20, 0, 0]);
  assert.deepEqual(ymdhm(W.parseDateLabel('20 de novembro de 2025', now)), [2025, 11, 20, 0, 0]);
  assert.deepEqual(ymdhm(W.parseDateLabel('20 DE DEZEMBRO', now)), [2025, 12, 20, 0, 0]);
  assert.equal(W.parseDateLabel('Mensagens e ligações são protegidas', now), null);
});

test('parseTimeOnly e mensagens apagadas', () => {
  assert.deepEqual(W.parseTimeOnly('14:10'), { h: 14, m: 10, s: 0 });
  assert.deepEqual(W.parseTimeOnly('2:10 PM'), { h: 14, m: 10, s: 0 });
  assert.equal(W.parseTimeOnly('14:10 lida'), null);
  assert.ok(W.isDeletedText(W.fold('Esta mensagem foi apagada')));
  assert.ok(W.isDeletedText(W.fold('You deleted this message')));
});

test('stableId é estável e muda com o conteúdo', async () => {
  const a = await W.stableId(['chat', '1', '2026-11-26T17:10:00.000Z', 'ok', '0']);
  const b = await W.stableId(['chat', '1', '2026-11-26T17:10:00.000Z', 'ok', '0']);
  const c = await W.stableId(['chat', '1', '2026-11-26T17:10:00.000Z', 'ok', '1']);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^h_[0-9a-f]{24}$/);
});

test('marcas invisíveis de direção de texto do WhatsApp', () => {
  const title = '‪+55 11 91234-5678‬';
  assert.ok(W.looksLikePhone(title));
  assert.equal(W.normalizePhone(title), '5511912345678');
  assert.deepEqual(W.parseTimeOnly('‎14:10'), { h: 14, m: 10, s: 0 });
  assert.deepEqual(W.parseTimeOnly('2:10 PM'), { h: 14, m: 10, s: 0 });
  assert.equal(W.stripMarks('⁨Maria⁩'), 'Maria');
  const pre = W.parsePrePlainText('‎[14:10, 26/11/2026] ‪Maria‬: ');
  assert.deepEqual(ymdhm(pre.date), [2026, 11, 26, 14, 10]);
  assert.deepEqual(ymdhm(W.parseDateLabel('‎HOJE', new Date(2026, 10, 26))), [2026, 11, 26, 0, 0]);
});

test('correções da revisão: apagada ancorada, dia da semana exato, operadora e máscara', () => {
  assert.ok(W.isDeletedText(W.fold('Esta mensagem foi apagada')));
  assert.ok(W.isDeletedText(W.fold('Você apagou esta mensagem.')));
  assert.ok(!W.isDeletedText(W.fold('Por que esta mensagem foi apagada?')));
  const now = new Date(2026, 10, 26);
  assert.equal(W.parseDateLabel('Domingo saiu', now), null);
  assert.deepEqual(ymdhm(W.parseDateLabel('SEGUNDA FEIRA', now)), [2026, 11, 23, 0, 0]);
  assert.deepEqual(ymdhm(W.parseDateLabel('domingo', now)), [2026, 11, 22, 0, 0]);
  assert.equal(W.normalizePhone('021 11 98765-4321'), '5511987654321');
  assert.equal(W.normalizePhone('0 15 11 3456-7890'), '551134567890');
  const masked = W.maskText('[14:10, 26/11/2026] Łukasz Михаил 😀: ');
  assert.equal(masked, '[99:99, 99/99/9999] aaaaaa aaaaaa *: ');
  assert.ok(!/[ŁМ😀]/u.test(masked));
});

test('messageIdFromDataId: formato antigo e o de nov/2026 (só o ID)', () => {
  assert.equal(W.messageIdFromDataId('false_5511987654321@c.us_3EB0A1B2C3D4E5F6'), '3EB0A1B2C3D4E5F6');
  assert.equal(W.messageIdFromDataId('3EB0C4F5A1B2C3D4E5'), '3EB0C4F5A1B2C3D4E5');
  assert.equal(W.messageIdFromDataId('A5F1E2D3C4B5'), 'A5F1E2D3C4B5');
  assert.equal(W.messageIdFromDataId(''), '');
  assert.equal(W.messageIdFromDataId('com espaço'), '');
  assert.equal(W.messageIdFromDataId('abc'), '');
});

test('sameName: ignora acentos, emojis e marcas; telefones pelos dígitos', () => {
  assert.equal(W.sameName('Maria Silva', 'maria silva'), true);
  assert.equal(W.sameName('João 🌸', 'Joao'), true);
  assert.equal(W.sameName('‪+55 11 91234-5678‬', '+55 11 91234-5678'), true);
  assert.equal(W.sameName('Lucas Braga', 'Maria Silva'), false);
  assert.equal(W.sameName('', 'Maria'), false);
  assert.equal(W.sameName('🙂', '🙂'), false);
});

test('storeMessageText: tipos de mensagem dos dados internos', () => {
  const t = (m) => W.storeMessageText(m);
  assert.equal(t({ type: 'chat', body: '⁦Obrigada!⁩ 🙏' }), 'Obrigada! 🙏');
  assert.equal(t({ type: 'chat', body: 'Linha um\r\nLinha dois' }), 'Linha um\nLinha dois');
  assert.equal(t({ type: 'chat', body: '   ' }), null);
  assert.equal(t({ type: 'image', caption: '' }), '[Imagem]');
  assert.equal(t({ type: 'image', caption: 'RG frente' }), '[Imagem] RG frente');
  assert.equal(t({ type: 'image', viewOnce: true, caption: 'x' }), '[Imagem de visualização única]');
  assert.equal(t({ type: 'video', isGif: true }), '[GIF]');
  assert.equal(t({ type: 'ptt' }), '[Áudio]');
  assert.equal(t({ type: 'document', filename: 'contrato.pdf', caption: 'assinado' }), '[Documento: contrato.pdf] assinado');
  assert.equal(t({ type: 'sticker' }), '[Figurinha]');
  assert.equal(t({ type: 'location', lat: -23.5505, lng: -46.6333 }), '[Localização] https://maps.google.com/?q=-23.5505,-46.6333');
  assert.equal(t({ type: 'location', loc: 'Fórum Trabalhista', lat: null, lng: null }), '[Localização] Fórum Trabalhista');
  assert.equal(t({ type: 'vcard', body: 'BEGIN:VCARD\nVERSION:3.0\nFN:Dr. Pedro\nEND:VCARD' }), '[Contato compartilhado: Dr. Pedro]');
  assert.equal(t({ type: 'revoked' }), '[Mensagem apagada]');
  assert.equal(t({ type: 'poll_creation', pollName: 'Melhor horário?' }), '[Enquete] Melhor horário?');
  assert.equal(t({ type: 'call_log', isVideoCall: true }), '[Chamada de vídeo]');
  // avisos do sistema e registros técnicos ficam de fora
  assert.equal(t({ type: 'e2e_notification', body: 'x' }), null);
  assert.equal(t({ type: 'chat', body: 'x', notification: true }), null);
  assert.equal(t({ type: 'notification_template' }), null);
  assert.equal(t({ type: 'ciphertext' }), null);
  // tipo desconhecido: legenda ou texto, nunca uma miniatura em base64
  assert.equal(t({ type: 'interactive', body: 'Escolha uma opção' }), 'Escolha uma opção');
  assert.equal(t({ type: 'novo_tipo', body: `/9j/${'A'.repeat(300)}` }), '[Mensagem: novo_tipo]');
});
