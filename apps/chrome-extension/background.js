// Abre o side panel ao clicar no ícone da extensão na barra de ferramentas.
// setPanelBehavior persiste, mas o worker é efêmero — chamar no top-level
// garante o comportamento após qualquer restart do navegador/extensão.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('sidePanel.setPanelBehavior:', err));
