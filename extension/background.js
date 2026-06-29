/**
 * bQuery DevTools — background service worker.
 *
 * Routes bridge messages between each inspected tab's content script and the
 * matching DevTools panel. Panels connect via a long-lived port named
 * `bquery-devtools-panel` and send their inspected `tabId` in the first
 * message; thereafter messages are relayed both ways.
 */
const SOURCE = 'bquery-devtools';

/** tabId -> panel port */
const panelPorts = new Map();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'bquery-devtools-panel') return;

  let tabId = null;

  port.onMessage.addListener((message) => {
    if (message && message.type === 'init' && typeof message.tabId === 'number') {
      tabId = message.tabId;
      panelPorts.set(tabId, port);
      return;
    }
    // Panel → page (forward to the inspected tab's content script).
    if (tabId != null && message && message.source === SOURCE) {
      chrome.tabs.sendMessage(tabId, {
        source: SOURCE,
        direction: 'to-page',
        payload: message.payload,
      });
    }
  });

  port.onDisconnect.addListener(() => {
    if (tabId != null) panelPorts.delete(tabId);
  });
});

// Page → panel (content script -> background -> panel).
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.source !== SOURCE || message.direction !== 'from-page') return;
  const tabId = sender.tab && sender.tab.id;
  const port = tabId != null ? panelPorts.get(tabId) : undefined;
  if (port) port.postMessage(message.payload);
});
