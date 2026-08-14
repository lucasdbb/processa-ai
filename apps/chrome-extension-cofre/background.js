// Cofre de Conhecimento — service worker.
// Cria o item de menu de contexto, trata o atalho de teclado, injeta o
// capture.js na página (activeTab é concedida pelo gesto do usuário) e
// abre o side panel com a captura pendente em chrome.storage.session.

'use strict';

const MENU_ID = 'cofre-salvar-selecao';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('setPanelBehavior:', err));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create(
    {
      id: MENU_ID,
      title: 'Salvar no Cofre de Conhecimento',
      contexts: ['selection'],
    },
    () => void chrome.runtime.lastError // ignora 'duplicate id' em reinstalação
  );
});

async function capture(tab) {
  if (!tab || !tab.id) return;

  // abrir o panel PRIMEIRO: precisa acontecer dentro do gesto do usuário
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error('sidePanel.open:', err);
  }

  let payload = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['capture.js'],
    });
    payload = results && results[0] ? results[0].result : null;
  } catch (err) {
    // páginas restritas (chrome://, Web Store...) não aceitam injeção
    await chrome.storage.session.set({
      pendingNotice: 'Não foi possível capturar nesta página (página restrita do Chrome).',
    });
    return;
  }

  if (!payload || payload.ok === false) {
    await chrome.storage.session.set({
      pendingNotice: 'Selecione o texto da resposta antes de salvar no Cofre.',
    });
    return;
  }

  await chrome.storage.session.set({
    pendingCapture: { ...payload, capturedAt: Date.now() },
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) capture(tab);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'salvar-selecao') return;
  // o listener já recebe a aba ativa; não usar await antes de sidePanel.open,
  // que precisa acontecer dentro do gesto do usuário
  capture(tab);
});
