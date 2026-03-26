/**
 * Named breakpoint signals.
 *
 * Defines named breakpoints that return reactive boolean signals,
 * making it easy to respond to viewport size changes.
 *
 * @module bquery/media
 */

import { signal, readonly } from '../reactive/index';
import type { ReadonlySignal } from '../reactive/index';
import type { BreakpointMap } from './types';

/**
 * Defines named breakpoints and returns reactive boolean signals for each.
 *
 * Each breakpoint is a minimum-width media query. The returned object maps
 * each breakpoint name to a `ReadonlySignal<boolean>` that is `true` when
 * the viewport width is at or above the breakpoint value.
 *
 * @param bp - An object mapping breakpoint names to minimum widths in pixels
 * @returns An object with the same keys, each a reactive boolean signal
 *
 * @example
 * ```ts
 * import { breakpoints } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const bp = breakpoints({ sm: 640, md: 768, lg: 1024, xl: 1280 });
 *
 * effect(() => {
 *   if (bp.xl.value) {
 *     console.log('Extra large viewport');
 *   } else if (bp.lg.value) {
 *     console.log('Large viewport');
 *   } else if (bp.md.value) {
 *     console.log('Medium viewport');
 *   } else {
 *     console.log('Small viewport');
 *   }
 * });
 * ```
 */
export const breakpoints = <T extends BreakpointMap>(
  bp: T
): { [K in keyof T]: ReadonlySignal<boolean> } => {
  const result = {} as { [K in keyof T]: ReadonlySignal<boolean> };

  for (const key of Object.keys(bp) as Array<keyof T>) {
    const width = bp[key];
    const s = signal(false);

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mql = window.matchMedia(`(min-width: ${width}px)`);
        s.value = mql.matches;

        const handler = (e: MediaQueryListEvent): void => {
          s.value = e.matches;
        };

        mql.addEventListener('change', handler);
      } catch {
        // matchMedia may throw in non-browser environments
      }
    }

    result[key] = readonly(s);
  }

  return result;
};
