/**
 * bQuery DevTools — panel UI.
 *
 * Speaks the stable bridge protocol (v1) from `@bquery/bquery/devtools`:
 *  - sends `hello`, waits for the page's `init` handshake;
 *  - requests `getComponentTree`, `getSnapshot`, `getTimeline`;
 *  - renders the component tree, signals, stores, and a live timeline
 *    (appended from streamed `event` messages).
 */
const SOURCE = 'bquery-devtools';
const V = 1;

const $ = (id) => document.getElementById(id);
const status = $('status');

// The inspected page is untrusted and the page→panel relay is unauthenticated,
// so every value taken from a bridge message must be HTML-escaped before it is
// interpolated into innerHTML, or the page can inject markup into this panel.
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const port = chrome.runtime.connect({ name: 'bquery-devtools-panel' });
port.postMessage({ type: 'init', tabId: chrome.devtools.inspectedWindow.tabId });

let nextId = 1;
const pending = new Map();

function send(method, params) {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    port.postMessage({
      source: SOURCE,
      channel: 'panel',
      v: V,
      payload: { source: SOURCE, channel: 'panel', v: V, kind: 'request', id, method, params },
    });
  });
}

function hello() {
  port.postMessage({
    source: SOURCE,
    channel: 'panel',
    v: V,
    payload: { source: SOURCE, channel: 'panel', v: V, kind: 'hello' },
  });
}

port.onMessage.addListener((msg) => {
  if (!msg || msg.source !== SOURCE) return;
  if (msg.kind === 'init') {
    status.textContent = `connected (protocol v${msg.v})`;
    refresh();
  } else if (msg.kind === 'response') {
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg.error ? { error: msg.error } : msg.result);
    }
  } else if (msg.kind === 'event') {
    appendTimeline([msg.entry]);
  }
});

function renderTree(nodes, into) {
  into.innerHTML = '';
  if (!nodes || !nodes.length) {
    into.innerHTML = '<span class="empty">No components</span>';
    return;
  }
  const ul = document.createElement('ul');
  for (const node of nodes) {
    const li = document.createElement('li');
    li.innerHTML = `<code class="tag">&lt;${esc(node.tag)}&gt;</code>`;
    if (node.children && node.children.length) renderTree(node.children, li);
    ul.appendChild(li);
  }
  into.appendChild(ul);
}

function renderList(items, into, fmt) {
  into.innerHTML = '';
  if (!items || !items.length) {
    into.innerHTML = '<li class="empty">none</li>';
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    li.innerHTML = fmt(item);
    into.appendChild(li);
  }
}

function appendTimeline(entries) {
  const ul = $('timeline');
  for (const e of entries) {
    const li = document.createElement('li');
    li.innerHTML = `<code>${esc(e.type)}</code> ${esc(e.label ?? '')}`;
    ul.insertBefore(li, ul.firstChild);
  }
  while (ul.children.length > 50) ul.removeChild(ul.lastChild);
}

async function refresh() {
  const treeRes = await send('getComponentTree');
  renderTree(treeRes && treeRes.tree, $('tree'));
  const snap = await send('getSnapshot');
  if (snap && !snap.error) {
    renderList(
      snap.signals,
      $('signals'),
      (s) => `<code>${esc(s.label ?? s.id)}</code> = <code>${esc(JSON.stringify(s.value))}</code>`
    );
    renderList(snap.stores, $('stores'), (s) => `<code>${esc(s.id)}</code>`);
  }
  const timeline = await send('getTimeline', { limit: 30 });
  $('timeline').innerHTML = '';
  if (Array.isArray(timeline)) appendTimeline(timeline.slice().reverse());
}

$('refresh').addEventListener('click', refresh);
hello();
