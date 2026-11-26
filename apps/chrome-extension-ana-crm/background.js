// ANA CRM — service worker.
// O clique no ícone abre o painel lateral. Ao instalar ou atualizar, injeta a
// captura nas abas do WhatsApp Web já abertas, para não precisar recarregá-las.

'use strict';

const CONTENT_FILES = ['content/wa-parse.js', 'content/wa-capture.js'];

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('setPanelBehavior:', err));

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  for (const tab of tabs) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES }).catch(() => {});
  }
});
