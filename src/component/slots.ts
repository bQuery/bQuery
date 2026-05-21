/**
 * Slot helpers for components.
 *
 * @module bquery/component
 */

import { signal } from '../reactive/index';
import type { Signal } from '../reactive/index';
import { getCurrentScope, isCurrentScopeRendering } from './scope';

const findSlot = (host: HTMLElement, name?: string): HTMLSlotElement | null => {
  const root = host.shadowRoot;
  if (!root) return null;
  if (!name) return root.querySelector<HTMLSlotElement>('slot:not([name])');
  // Prefer CSS.escape when available; fall back to a conservative manual
  // escape that handles backslash *first* (so already-escaped characters are
  // not re-processed), then quotes.
  const cssEscape = (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS?.escape;
  const escaped = cssEscape ? cssEscape(name) : name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return root.querySelector<HTMLSlotElement>(`slot[name="${escaped}"]`);
};

/**
 * Reactive signal containing the currently assigned nodes for the given slot.
 *
 * Must be called from a component lifecycle hook (e.g. `connected`). The
 * underlying `slotchange` listener is removed automatically when the
 * component disconnects.
 *
 * @param host - The component host element
 * @param name - Slot name, or `undefined` for the default slot
 *
 * @example
 * ```ts
 * connected() {
 *   const items = useSlot(this, 'item');
 *   useEffect(() => console.log('Items:', items.value.length));
 * }
 * ```
 */
export const useSlot = (host: HTMLElement, name?: string): Signal<Element[]> => {
  const scope = getCurrentScope();
  if (!scope || isCurrentScopeRendering()) {
    throw new Error(
      'bQuery component: useSlot() must be called inside a component lifecycle hook.'
    );
  }
  const sig = signal<Element[]>([]);
  let disposed = false;
  let currentSlot: HTMLSlotElement | null = null;

  const bindCurrentSlot = (): HTMLSlotElement | null => {
    const slot = findSlot(host, name);
    if (slot === currentSlot) {
      return currentSlot;
    }
    currentSlot?.removeEventListener('slotchange', update);
    currentSlot = slot;
    currentSlot?.addEventListener('slotchange', update);
    return currentSlot;
  };

  const update = (): void => {
    if (disposed) return;
    const slot = bindCurrentSlot();
    if (!slot) {
      sig.value = [];
      return;
    }
    const assigned = slot.assignedElements();
    sig.value = assigned;
  };

  // The slot element only exists after the first render. Use queueMicrotask
  // (or setTimeout fallback) to defer the initial lookup until then.
  const schedule =
    typeof queueMicrotask !== 'undefined'
      ? queueMicrotask
      : (cb: () => void): unknown => setTimeout(cb, 0);
  const MutationObserverCtor =
    globalThis.MutationObserver ?? host.ownerDocument?.defaultView?.MutationObserver;
  const observer = MutationObserverCtor
    ? new MutationObserverCtor(() => {
        if (disposed) return;
        const previousSlot = currentSlot;
        const nextSlot = bindCurrentSlot();
        if (previousSlot !== nextSlot) {
          update();
        }
      })
    : null;
  schedule(() => {
    if (disposed) return;
    const root = host.shadowRoot;
    if (root && observer) {
      observer.observe(root, { childList: true, subtree: true });
    }
    update();
  });

  scope.addDisposer(() => {
    disposed = true;
    observer?.disconnect();
    currentSlot?.removeEventListener('slotchange', update);
    currentSlot = null;
    sig.dispose();
  });

  return sig;
};

/**
 * Returns `true` when the host's shadow root contains a non-empty slot with
 * the given name (or the default slot if no name is provided).
 */
export const hasSlot = (host: HTMLElement, name?: string): boolean => {
  const slot = findSlot(host, name);
  if (!slot) return false;
  return slot.assignedNodes({ flatten: true }).length > 0;
};

/**
 * Returns the concatenated text content of all nodes assigned to the named slot.
 */
export const slotText = (host: HTMLElement, name?: string): string => {
  const slot = findSlot(host, name);
  if (!slot) return '';
  return slot
    .assignedNodes({ flatten: true })
    .map((node) => node.textContent ?? '')
    .join('');
};
