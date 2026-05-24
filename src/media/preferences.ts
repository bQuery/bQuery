/**
 * Reactive wrappers for user-preference media queries (1.14+).
 *
 * Convenience composables on top of {@link mediaQuery} that resolve to
 * semantic values (`'light' | 'dark' | 'no-preference'`, etc.) rather than
 * raw booleans.
 *
 * @module bquery/media
 */

import { mediaQuery } from './media-query';
import { createMediaSignal, type AbortableOptions } from './internal';
import type { MediaSignalHandle } from './types';

const matches = (query: string): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
};

/**
 * Reactive signal tracking the user's preferred color scheme.
 *
 * @returns A readonly signal whose value is `'dark'`, `'light'`, or
 *   `'no-preference'`. Call `destroy()` to release listeners.
 *
 * @example
 * ```ts
 * import { usePreferredColorScheme } from '@bquery/bquery/media';
 * const scheme = usePreferredColorScheme();
 * effect(() => document.body.dataset.theme = scheme.value);
 * ```
 */
export const usePreferredColorScheme = (
  options?: AbortableOptions
): MediaSignalHandle<'light' | 'dark' | 'no-preference'> => {
  const read = (): 'light' | 'dark' | 'no-preference' => {
    if (matches('(prefers-color-scheme: dark)')) return 'dark';
    if (matches('(prefers-color-scheme: light)')) return 'light';
    return 'no-preference';
  };

  return createMediaSignal<'light' | 'dark' | 'no-preference'>(
    read(),
    (set) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const queries = [
        window.matchMedia('(prefers-color-scheme: dark)'),
        window.matchMedia('(prefers-color-scheme: light)'),
      ];
      const handler = (): void => set(read());
      for (const q of queries) q.addEventListener?.('change', handler);
      return () => {
        for (const q of queries) q.removeEventListener?.('change', handler);
      };
    },
    options
  );
};

/**
 * Reactive signal tracking the user's preferred contrast setting.
 *
 * Resolves to `'more'`, `'less'`, `'custom'`, or `'no-preference'`.
 */
export const usePreferredContrast = (
  options?: AbortableOptions
): MediaSignalHandle<'more' | 'less' | 'custom' | 'no-preference'> => {
  const read = (): 'more' | 'less' | 'custom' | 'no-preference' => {
    if (matches('(prefers-contrast: more)')) return 'more';
    if (matches('(prefers-contrast: less)')) return 'less';
    if (matches('(prefers-contrast: custom)')) return 'custom';
    return 'no-preference';
  };

  return createMediaSignal<'more' | 'less' | 'custom' | 'no-preference'>(
    read(),
    (set) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const queries = [
        window.matchMedia('(prefers-contrast: more)'),
        window.matchMedia('(prefers-contrast: less)'),
        window.matchMedia('(prefers-contrast: custom)'),
      ];
      const handler = (): void => set(read());
      for (const q of queries) q.addEventListener?.('change', handler);
      return () => {
        for (const q of queries) q.removeEventListener?.('change', handler);
      };
    },
    options
  );
};

/**
 * Reactive signal tracking the user's `prefers-reduced-transparency`
 * preference.
 *
 * Returns `true` when the user has requested reduced transparency.
 */
export const usePreferredReducedTransparency = (
  options?: AbortableOptions
): MediaSignalHandle<boolean> => {
  const handle = mediaQuery('(prefers-reduced-transparency: reduce)');
  if (options?.signal) {
    if (options.signal.aborted) handle.destroy();
    else options.signal.addEventListener('abort', () => handle.destroy(), { once: true });
  }
  return handle;
};
