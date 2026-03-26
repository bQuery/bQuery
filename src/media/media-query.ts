/**
 * Reactive media query matching.
 *
 * Returns a reactive boolean signal that tracks whether a CSS media query matches.
 *
 * @module bquery/media
 */

import { signal, readonly } from '../reactive/index';
import type { ReadonlySignal } from '../reactive/index';

/**
 * Creates a reactive signal that tracks whether a CSS media query matches.
 *
 * Uses `window.matchMedia()` under the hood and automatically updates
 * when the match state changes (e.g., on window resize, device orientation change).
 *
 * @param query - A valid CSS media query string (e.g., `'(min-width: 768px)'`)
 * @returns A readonly reactive signal that is `true` when the query matches
 *
 * @example
 * ```ts
 * import { mediaQuery } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const isDark = mediaQuery('(prefers-color-scheme: dark)');
 * effect(() => {
 *   document.body.classList.toggle('dark', isDark.value);
 * });
 *
 * const isWide = mediaQuery('(min-width: 1024px)');
 * effect(() => {
 *   console.log('Wide screen:', isWide.value);
 * });
 * ```
 */
export const mediaQuery = (query: string): ReadonlySignal<boolean> => {
  const s = signal(false);

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia(query);
      s.value = mql.matches;

      const handler = (e: MediaQueryListEvent): void => {
        s.value = e.matches;
      };

      mql.addEventListener('change', handler);
    } catch {
      // matchMedia may throw in non-browser environments
    }
  }

  return readonly(s);
};
