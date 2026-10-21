// Gives `bun test` a browser-like DOM (happy-dom). Loaded before every test
// file through `preload` in bunfig.toml.
import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost:3000/' });

// Add what the runtime lacks (document, HTMLElement, customElements, …) and
// keep its own fetch, Request, URL and timers.
for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalThis)) globalThis[key] = window[key];
}
// happy-dom dispatches its own event classes.
for (const key of ['Event', 'CustomEvent']) globalThis[key] = window[key];
globalThis.window = window;
