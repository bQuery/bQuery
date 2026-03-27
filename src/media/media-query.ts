/**
 * Reactive media query matching.
 *
 * Returns a reactive boolean signal that tracks whether a CSS media query matches.
 *
 * @module bquery/media
 */

import { readonly, signal } from '../reactive/index';
import type { MediaSignalHandle } from './types';

/**
 * Creates a reactive signal that tracks whether a CSS media query matches.
 *
 * Uses `window.matchMedia()` under the hood and automatically updates
 * when the match state changes (e.g., on window resize, device orientation change).
 *
 * @param query - A valid CSS media query string (e.g., `'(min-width: 768px)'`)
 * @returns A readonly reactive signal that is `true` when the query matches,
 * plus a `destroy()` method to remove the media query listener
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
export const mediaQuery = (query: string): MediaSignalHandle<boolean> => {
  const s = signal(false);
  let cleanup: (() => void) | undefined;

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia(query);
      s.value = mql.matches;

      const handler = (e: MediaQueryListEvent): void => {
        s.value = e.matches;
      };

      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handler);
        cleanup = () => {
          mql.removeEventListener('change', handler);
        };
      } else if (
        typeof (
          mql as MediaQueryList & {
            addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
            removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
          }
        ).addListener === 'function'
      ) {
        const legacyMql = mql as MediaQueryList & {
          addListener: (listener: (event: MediaQueryListEvent) => void) => void;
          removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
        };
        legacyMql.addListener(handler);
        cleanup = () => {
          legacyMql.removeListener(handler);
        };
      }
    } catch {
      // matchMedia may throw in non-browser environments
    }
  }

  const ro = readonly(s) as MediaSignalHandle<boolean>;
  let destroyed = false;
  ro.destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    cleanup?.();
    s.dispose();
  };

  return ro;
};
