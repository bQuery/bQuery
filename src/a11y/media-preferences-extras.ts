/**
 * Additional reactive media-preference signals introduced in 1.14.0.
 *
 * Mirrors the structure of {@link prefersReducedMotion} / {@link prefersColorScheme}
 * for the newer accessibility preferences — `prefers-reduced-transparency`,
 * `prefers-reduced-data`, and `forced-colors` — plus a small `forcedColors`
 * signal that exposes the active forced-color mode.
 *
 * @module bquery/a11y
 *
 * @since 1.14.0
 */

import { readonly, signal, type ReadonlySignal } from '../reactive/index';
import type { MediaPreferenceSignal } from './types';

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
};

const bindMediaQueryListener = (
  mql: MediaQueryList,
  handler: (event: MediaQueryListEvent | MediaQueryList) => void
): (() => void) | undefined => {
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }
  const legacy = mql as LegacyMediaQueryList;
  if (typeof legacy.addListener === 'function') {
    legacy.addListener(handler);
    return () => legacy.removeListener?.(handler);
  }
  return undefined;
};

const withDestroy = <T>(
  handle: ReadonlySignal<T>,
  cleanup: () => void
): MediaPreferenceSignal<T> => {
  let destroyImpl = cleanup;
  const out = handle as MediaPreferenceSignal<T>;
  Object.defineProperty(out, 'destroy', {
    configurable: true,
    enumerable: false,
    value: () => {
      const current = destroyImpl;
      destroyImpl = () => {};
      current();
    },
  });
  return out;
};

const createMediaSignal = (
  query: string,
  initialValue: boolean
): MediaPreferenceSignal<boolean> => {
  const s = signal(initialValue);
  let destroy = (): void => {
    s.dispose();
  };

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia(query);
      s.value = mql.matches;
      const handler = (e: MediaQueryListEvent | MediaQueryList): void => {
        s.value = e.matches;
      };
      const cleanupMql = bindMediaQueryListener(mql, handler);
      if (cleanupMql) {
        destroy = () => {
          cleanupMql();
          s.dispose();
        };
      }
    } catch {
      // matchMedia may not be available
    }
  }

  return withDestroy(readonly(s), destroy);
};

/**
 * Reactive signal tracking `(prefers-reduced-transparency: reduce)`.
 * Returns `true` when the user has requested reduced transparency.
 *
 * @since 1.14.0
 */
export const prefersReducedTransparency = (): MediaPreferenceSignal<boolean> =>
  createMediaSignal('(prefers-reduced-transparency: reduce)', false);

/**
 * Reactive signal tracking `(prefers-reduced-data: reduce)`.
 * Returns `true` when the user has requested reduced data usage.
 *
 * @since 1.14.0
 */
export const prefersReducedData = (): MediaPreferenceSignal<boolean> =>
  createMediaSignal('(prefers-reduced-data: reduce)', false);

/**
 * Possible values for {@link forcedColors}.
 *
 * @since 1.14.0
 */
export type ForcedColorsMode = 'none' | 'active';

/**
 * Reactive signal tracking `(forced-colors: active)` — emits `'active'`
 * when Windows High Contrast / forced-colors mode is enabled and `'none'`
 * otherwise.
 *
 * @since 1.14.0
 */
export const forcedColors = (): MediaPreferenceSignal<ForcedColorsMode> => {
  const s = signal<ForcedColorsMode>('none');
  let destroy = (): void => {
    s.dispose();
  };

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia('(forced-colors: active)');
      s.value = mql.matches ? 'active' : 'none';
      const handler = (e: MediaQueryListEvent | MediaQueryList): void => {
        s.value = e.matches ? 'active' : 'none';
      };
      const cleanupMql = bindMediaQueryListener(mql, handler);
      if (cleanupMql) {
        destroy = () => {
          cleanupMql();
          s.dispose();
        };
      }
    } catch {
      // ignore
    }
  }

  return withDestroy(readonly(s), destroy);
};
