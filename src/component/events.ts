/**
 * Event binding helpers for components.
 *
 * Provides a safe, sanitizer-friendly way to wire event handlers from
 * `render()` output without using inline `on*` attributes or `eval`.
 *
 * Handlers are stored in a Map keyed by a generated ID. The `on()` /
 * `onClick()` / etc. helpers return an attribute string of the form
 * `data-bq-on-click="<id>"`. A single delegated listener per event type per
 * component host dispatches events to the registered handler.
 *
 * Sanitizer-safe because the actual handler functions are *not* stored as
 * attribute values, only opaque IDs.
 *
 * @module bquery/component
 */

import type { ComponentScope } from './scope';
import { getCurrentScope } from './scope';

type EventHandler = (event: Event) => void;

const handlerStore = new Map<string, EventHandler>();
const listenerRegistrationsByScope = new WeakMap<ComponentScope, Set<(type: string) => void>>();
/**
 * Tracks the set of handler IDs registered via `on()` for a given component
 * scope. A single disposer is registered per scope (on first `on()` call) that
 * deletes all tracked IDs from `handlerStore` on disconnect, instead of one
 * disposer per handler. This prevents the scope's disposer list from growing
 * unboundedly across re-renders of long-lived components.
 * @internal
 */
const handlerIdsByScope = new WeakMap<ComponentScope, Set<string>>();
const delegatedAttributePrefix = 'data-bq-on-';

/**
 * @internal
 */
const randomHex = (byteLength: number): string => {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    globalCrypto.getRandomValues(bytes);
    let hex = '';
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
  }

  let fallback = '';
  for (let index = 0; index < byteLength; index += 1) {
    fallback += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return fallback;
};

const allocateId = (): string => `bq${randomHex(16)}`;

const validEventName = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Bind a function to an event. Returns a string of the form
 * `data-bq-on-<event>="<id>"` suitable for embedding into a template via
 * the `${...}` interpolation slot.
 *
 * Must be called while a component scope is active (typically from `render()`).
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
  const scope = getCurrentScope();
  if (!scope) {
    throw new Error('bQuery component: on() must be called with an active component scope');
  }
  const normalizedEvent = event.toLowerCase();
  const id = allocateId();
  handlerStore.set(id, handler);
  listenerRegistrationsByScope.get(scope)?.forEach((register) => register(normalizedEvent));
  let ids = handlerIdsByScope.get(scope);
  if (!ids) {
    ids = new Set<string>();
    handlerIdsByScope.set(scope, ids);
    // Register a single disposer per scope. It runs on component disconnect
    // and removes any handler IDs still registered for this scope. Per-render
    // cleanup is handled by `cleanupDelegatedHandlers()`, which also keeps
    // this set in sync so it does not grow unboundedly across re-renders.
    const trackedIds = ids;
    scope.addDisposer(() => {
      for (const trackedId of trackedIds) {
        handlerStore.delete(trackedId);
      }
      trackedIds.clear();
      handlerIdsByScope.delete(scope);
    });
  }
  ids.add(id);
  return `data-bq-on-${normalizedEvent}="${id}"`;
};

/**
 * @internal
 */
export const cleanupDelegatedHandlers = (root: ParentNode, scope?: ComponentScope): void => {
  const nodes: Element[] = [];
  if (root instanceof Element) {
    nodes.push(root);
  }
  nodes.push(...Array.from(root.querySelectorAll('*')));

  const scopedIds = scope ? handlerIdsByScope.get(scope) : undefined;
  for (const node of nodes) {
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.startsWith(delegatedAttributePrefix) && attr.value) {
        if (scopedIds && !scopedIds.has(attr.value)) {
          continue;
        }
        handlerStore.delete(attr.value);
        scopedIds?.delete(attr.value);
      }
    }
  }
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
  const usesShadowRoot = host.shadowRoot !== null;
  const isNodeInHost = (node: Element): boolean => {
    return usesShadowRoot ? node.getRootNode() === root : node === host || host.contains(node);
  };
  const eventTypes = new Map<string, EventHandler>();
  const scope = getCurrentScope();

  const ensureListener = (type: string): void => {
    if (eventTypes.has(type)) return;
    const listener: EventHandler = (event) => {
      const path = (event.composedPath?.() ?? []) as EventTarget[];
      const attrName = `${delegatedAttributePrefix}${type.toLowerCase()}`;
      for (const node of path) {
        if (!(node instanceof Element)) continue;
        if (node === host) break; // don't walk past the host
        // Only dispatch to nodes that live in this component's shadow root;
        // slotted / projected light-DOM nodes must not reach internal handlers.
        if (!isNodeInHost(node)) continue;
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

  const registerElement = (el: Element): void => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith(delegatedAttributePrefix)) {
        ensureListener(attr.name.slice(delegatedAttributePrefix.length));
      }
    }
  };

  const scanAndRegister = (node: ParentNode): void => {
    if (node instanceof Element) {
      registerElement(node);
    }
    for (const el of Array.from(node.querySelectorAll('*'))) {
      registerElement(el);
    }
  };

  if (scope) {
    let registrations = listenerRegistrationsByScope.get(scope);
    if (!registrations) {
      registrations = new Set();
      listenerRegistrationsByScope.set(scope, registrations);
    }
    registrations.add(ensureListener);
  }

  scanAndRegister(root);

  const observer =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              for (const node of Array.from(mutation.addedNodes)) {
                if (node instanceof Element) {
                  scanAndRegister(node);
                }
              }
              continue;
            }
            if (
              mutation.type === 'attributes' &&
              mutation.attributeName?.startsWith(delegatedAttributePrefix)
            ) {
              const target = mutation.target;
              if (target instanceof Element) {
                registerElement(target);
              }
            }
          }
        })
      : null;
  observer?.observe(root, { childList: true, subtree: true, attributes: true });

  const cleanup = (): void => {
    if (scope) {
      const registrations = listenerRegistrationsByScope.get(scope);
      registrations?.delete(ensureListener);
      if (registrations && registrations.size === 0) {
        listenerRegistrationsByScope.delete(scope);
      }
    }
    for (const [type, listener] of eventTypes) {
      root.removeEventListener(type, listener);
    }
    eventTypes.clear();
    observer?.disconnect();
  };

  scope?.addDisposer(cleanup);
  return cleanup;
};
