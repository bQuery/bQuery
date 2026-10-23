/**
 * Gives `bun test` a browser-like DOM (happy-dom). Loaded before every test
 * file through `preload` in `bunfig.toml`.
 */
import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost:3000/' });
const scope = globalThis as unknown as Record<string, unknown>;
const dom = window as unknown as Record<string, unknown>;

// Add what the runtime lacks (document, HTMLElement, customElements, history,
// …) and keep its own fetch, Request, URL and timers.
for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalThis)) scope[key] = dom[key];
}
// happy-dom dispatches its own event classes.
for (const key of ['Event', 'CustomEvent']) scope[key] = dom[key];
scope.window = window;
