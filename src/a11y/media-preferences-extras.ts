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

import { readonly, signal } from '../reactive/index';
import type { MediaPreferenceSignal } from './types';
import { bindMediaQueryListener, createMediaSignal, withDestroy } from './media-preference-shared';

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
