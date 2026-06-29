/**
 * bQuery DevTools — content script.
 *
 * Relays the bridge protocol between the inspected page (which talks via
 * `window.postMessage`, see `connectDevtoolsBridge`) and the extension's
 * background service worker (`chrome.runtime`).
 *
 * Page → panel: page posts `{ source: 'bquery-devtools', channel: 'page', … }`
 *               on `window`; we forward it to the background.
 * Panel → page: background sends `{ channel: 'panel', … }`; we post it back
 *               onto `window` so the page's bridge listener picks it up.
 */
const SOURCE = 'bquery-devtools';

// Page → background.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (event.source !== window || !data || data.source !== SOURCE || data.channel !== 'page') return;
  try {
    chrome.runtime.sendMessage({ source: SOURCE, direction: 'from-page', payload: data });
  } catch {
    // Background may be asleep; harmless — the panel re-requests on connect.
  }
});

// Background (panel) → page.
chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.source !== SOURCE || message.direction !== 'to-page') return;
  window.postMessage(message.payload, '*');
});
