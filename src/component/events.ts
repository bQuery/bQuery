/**
 * Event binding helpers for components.
 *
 * Provides a safe, sanitizer-friendly way to wire event handlers from
 * `render()` output without using inline `on*` attributes or `eval`.
 *
 * Handlers are stored in a WeakMap keyed by a generated ID. The `on()` /
 * `onClick()` / etc. helpers return an attribute string of the form
 * `data-bq-on-click="<id>"`. A single delegated listener per event type per
 * component host dispatches events to the registered handler.
 *
 * Sanitizer-safe because the actual handler functions are *not* stored as
 * attribute values, only opaque IDs.
 *
 * @module bquery/component
 */

import { getCurrentScope } from './scope';

type EventHandler = (event: Event) => void;

const handlerStore = new Map<string, EventHandler>();
const usedEventTypes = new Set<string>();
let counter = 0;

const allocateId = (): string => {
  counter = (counter + 1) >>> 0;
  return `bq${counter.toString(36)}`;
};

const validEventName = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Bind a function to an event. Returns a string of the form
 * `data-bq-on-<event>="<id>"` suitable for embedding into a template via
 * the `${...}` interpolation slot.
 *
 * The handler is automatically removed when the owning component scope
 * disconnects, so handlers do not leak across re-renders for the same component.
 *
 * @example
 * ```ts
 * render({ state }) {
 *   return html`
 *     <button ${on('click', () => state.count += 1)}>+</button>
 *   `;
 * }
 * ```
 */
export const on = (event: string, handler: EventHandler): string => {
  if (!validEventName.test(event)) {
    throw new Error(`bQuery component: invalid event name "${event}"`);
  }
  const id = allocateId();
  handlerStore.set(id, handler);
  usedEventTypes.add(event.toLowerCase());
  const scope = getCurrentScope();
  scope?.addDisposer(() => handlerStore.delete(id));
  return `data-bq-on-${event.toLowerCase()}="${id}"`;
};

export const onClick = (handler: EventHandler): string => on('click', handler);
export const onInput = (handler: EventHandler): string => on('input', handler);
export const onChange = (handler: EventHandler): string => on('change', handler);
export const onSubmit = (handler: EventHandler): string => on('submit', handler);

/**
 * Install the delegated event listener machinery on a host element.
 *
 * Typically called from `connected()`:
 *
 * ```ts
 * connected() {
 *   bindDelegatedEvents(this);
 * }
 * ```
 *
 * Returns a cleanup function which is also registered with the active
 * component scope (if any) so it runs automatically on disconnect.
 *
 * Delegation walks the event path looking for `data-bq-on-<event>="<id>"`
 * attributes and invokes the matching handler from the internal store.
 */
export const bindDelegatedEvents = (host: HTMLElement): (() => void) => {
  const root = host.shadowRoot ?? host;
  const eventTypes = new Map<string, EventHandler>();

  const ensureListener = (type: string): void => {
    if (eventTypes.has(type)) return;
    const listener: EventHandler = (event) => {
      const path = (event.composedPath?.() ?? []) as EventTarget[];
      const attrName = `data-bq-on-${type.toLowerCase()}`;
      for (const node of path) {
        if (!(node instanceof Element)) continue;
        if (node === host) break; // don't walk past the host
        const id = node.getAttribute(attrName);
        if (id) {
          const handler = handlerStore.get(id);
          if (handler) {
            try {
              handler(event);
            } catch (error) {
              console.error(
                `bQuery component: delegated ${type} handler threw`,
                error
              );
            }
            return;
          }
        }
      }
    };
    eventTypes.set(type, listener);
    root.addEventListener(type, listener);
  };

  // Register listeners for every event type seen so far by `on()`. This
  // ensures handlers wired into the *next* render are dispatched even though
  // the shadow DOM may be empty at the time `bindDelegatedEvents` is called
  // (typically inside `connected()`, before the first render).
  for (const type of usedEventTypes) ensureListener(type);

  // Scan the rendered DOM once on install to register listeners for any
  // `data-bq-on-*` attributes present in the initial render. We probe each
  // known event type with an attribute-presence selector (much cheaper than
  // querySelectorAll('*') for large trees), then scan attribute names on
  // matched elements to discover any custom event types that may have been
  // added since the global `usedEventTypes` set was last consulted.
  const scanAndRegister = (): void => {
    const knownTypes = Array.from(usedEventTypes);
    const candidateSet = new Set<Element>();
    for (const type of knownTypes) {
      const matches = root.querySelectorAll(`[data-bq-on-${type}]`);
      for (let i = 0; i < matches.length; i += 1) candidateSet.add(matches[i]);
    }
    for (const el of candidateSet) {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('data-bq-on-')) {
          ensureListener(attr.name.slice('data-bq-on-'.length));
        }
      }
    }
  };
  scanAndRegister();

  const observer =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => scanAndRegister())
      : null;
  observer?.observe(root, { childList: true, subtree: true, attributes: true });

  const cleanup = (): void => {
    for (const [type, listener] of eventTypes) {
      root.removeEventListener(type, listener);
    }
    eventTypes.clear();
    observer?.disconnect();
  };

  getCurrentScope()?.addDisposer(cleanup);
  return cleanup;
};
