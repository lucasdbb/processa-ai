// ANA CRM — service worker.
// O clique no ícone abre o painel lateral. Ao instalar ou atualizar, injeta a
// ponte (mundo da página) e a captura (mundo isolado) nas abas do WhatsApp Web já
// abertas, para não precisar recarregá-las.

'use strict';

const BRIDGE_FILES = ['content/wa-bridge.js'];
const CONTENT_FILES = ['content/wa-parse.js', 'content/wa-capture.js'];

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('setPanelBehavior:', err));

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  for (const tab of tabs) {
    const target = { tabId: tab.id };
    chrome.scripting.executeScript({ target, files: BRIDGE_FILES, world: 'MAIN' }).catch(() => {});
    chrome.scripting.executeScript({ target, files: CONTENT_FILES }).catch(() => {});
  }
});
