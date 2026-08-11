/**
 * Imperative live-region handle, complementing the singleton
 * {@link announceToScreenReader}. Use `createLiveRegion()` when you need
 * multiple independent live regions, or want fine-grained control over the
 * region's `role`/`aria-live`/`aria-atomic` attributes and lifecycle.
 *
 * @module bquery/a11y
 * @since 1.14.0
 */

import type { AnnouncePriority } from './types';

/**
 * Options for {@link createLiveRegion}.
 *
 * @since 1.14.0
 */
export type CreateLiveRegionOptions = {
  /** `'polite'` (default) or `'assertive'`. */
  priority?: AnnouncePriority;
  /**
   * Explicit ARIA role. Defaults to `'status'` for polite regions and
   * `'alert'` for assertive ones.
   */
  role?: string;
  /**
   * `aria-atomic` value. Defaults to `'true'`.
   */
  atomic?: 'true' | 'false' | boolean;
  /**
   * Parent element to append the region into. Defaults to `document.body`.
   */
  container?: HTMLElement;
  /**
   * Delay in ms before writing the text content after clearing the region.
   * Defaults to `50` (matches `announceToScreenReader`).
   */
  delay?: number;
  /**
   * Optional `id` for the region. Useful for `aria-describedby` references.
   */
  id?: string;
  /**
   * Optional CSS class to apply to the region. The region is visually hidden
   * by default via inline styles; classes are additive.
   */
  className?: string;
};

/**
 * Imperative handle returned by {@link createLiveRegion}.
 *
 * @since 1.14.0
 */
export type LiveRegionHandle = {
  /** The underlying DOM element. */
  element: HTMLElement;
  /** Announce a message; clears first to force a mutation event. */
  announce: (message: string) => void;
  /** Clears the region without removing it. */
  clear: () => void;
  /** Removes the region from the DOM and releases pending timers. */
  destroy: () => void;
};

/**
 * Creates a dedicated, off-screen ARIA live region and returns an imperative
 * handle for announcing messages through it.
 *
 * Unlike the singleton {@link announceToScreenReader}, each call creates a
 * fresh region — useful when several independent components need to announce
 * unrelated state changes without interleaving.
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * import { createLiveRegion } from '@bquery/bquery/a11y';
 *
 * const region = createLiveRegion({ priority: 'assertive' });
 * region.announce('Connection lost');
 * // ...later
 * region.destroy();
 * ```
 */
export const createLiveRegion = (options: CreateLiveRegionOptions = {}): LiveRegionHandle => {
  const {
    priority = 'polite',
    role = priority === 'assertive' ? 'alert' : 'status',
    atomic = 'true',
    container = typeof document !== 'undefined' ? document.body : null,
    delay = 50,
    id,
    className,
  } = options;

  if (!container) {
    throw new Error('bQuery a11y: createLiveRegion requires a document body or container.');
  }

  const el = document.createElement('div');
  el.setAttribute('aria-live', priority);
  el.setAttribute('aria-atomic', typeof atomic === 'boolean' ? String(atomic) : atomic);
  el.setAttribute('role', role);
  if (id) el.id = id;
  if (className) el.className = className;

  Object.assign(el.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });

  container.appendChild(el);

  let pending: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const cancelPending = (): void => {
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
  };

  const announce = (message: string): void => {
    if (destroyed || !el.isConnected) return;
    cancelPending();
    el.textContent = '';
    pending = setTimeout(() => {
      pending = null;
      if (!destroyed && el.isConnected) {
        el.textContent = message;
      }
    }, delay);
  };

  const clear = (): void => {
    cancelPending();
    if (!destroyed) el.textContent = '';
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    cancelPending();
    el.remove();
  };

  return { element: el, announce, clear, destroy };
};
