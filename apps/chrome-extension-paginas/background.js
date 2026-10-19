// Páginas Salvas — service worker.
// O clique no ícone abre o popup (definido no manifest); aqui só fica o item
// "Ver páginas salvas" no menu de contexto do próprio ícone.

importScripts('store.js');

const MENU_ID = 'ver-paginas-salvas';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create(
    { id: MENU_ID, title: 'Ver páginas salvas', contexts: ['action'] },
    () => void chrome.runtime.lastError // ignora 'duplicate id' em reinstalação
  );
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID) Store.openListPage();
});
