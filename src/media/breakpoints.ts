/**
 * Named breakpoint signals.
 *
 * Defines named breakpoints that return reactive boolean signals,
 * making it easy to respond to viewport size changes.
 *
 * @module bquery/media
 */

import { readonly, signal } from '../reactive/index';
import type { BreakpointMap, MediaSignalHandle } from './types';

type BreakpointSignals<T extends BreakpointMap> = { [K in keyof T]: MediaSignalHandle<boolean> } & {
  destroyAll(): void;
} & ('destroy' extends keyof T ? Record<never, never> : { destroy(): void });

/**
 * Defines named breakpoints and returns reactive boolean signals for each.
 *
 * Each breakpoint is a minimum-width media query. The returned object maps
 * each breakpoint name to a `ReadonlySignal<boolean>` that is `true` when
 * the viewport width is at or above the breakpoint value.
 *
 * @param bp - An object mapping breakpoint names to minimum widths in pixels
 * @returns An object with the same keys, each a reactive boolean signal with
 * `destroy()`, plus a top-level `destroyAll()` method to clean up all listeners.
 * When no breakpoint is named `destroy`, a `destroy()` alias is also provided.
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
): BreakpointSignals<T> => {
  const signals = {} as { [K in keyof T]: MediaSignalHandle<boolean> };
  const destroyers: Array<() => void> = [];

  type LegacyMediaQueryList = MediaQueryList & {
    addListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
    removeListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
  };

  for (const key of Object.keys(bp) as Array<keyof T>) {
    const width = bp[key];
    const s = signal(false);
    let cleanup: (() => void) | undefined;

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mql = window.matchMedia(`(min-width: ${width}px)`);
        s.value = mql.matches;

        const handler = (e: MediaQueryListEvent | MediaQueryList): void => {
          s.value = e.matches;
        };

        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', handler);
          cleanup = () => {
            mql.removeEventListener('change', handler);
          };
        } else {
          const legacyMql = mql as LegacyMediaQueryList;
          if (typeof legacyMql.addListener === 'function') {
            legacyMql.addListener(handler);
            cleanup = () => {
              legacyMql.removeListener?.(handler);
            };
          }
        }
      } catch {
        // matchMedia may throw in non-browser environments
      }
    }

    const ro = readonly(s) as MediaSignalHandle<boolean>;
    let destroyed = false;
    Object.defineProperty(ro, 'destroy', {
      enumerable: false,
      configurable: true,
      value(): void {
        if (destroyed) return;
        destroyed = true;
        cleanup?.();
        s.dispose();
      },
    });
    destroyers.push(ro.destroy);
    signals[key] = ro;
  }

  let destroyed = false;
  const result = Object.defineProperty(signals, 'destroyAll', {
    enumerable: false,
    configurable: true,
    value(): void {
      if (destroyed) return;
      destroyed = true;
      destroyers.forEach((destroy) => {
        destroy();
      });
    },
  }) as BreakpointSignals<T>;

  if (!Object.prototype.hasOwnProperty.call(signals, 'destroy')) {
    Object.defineProperty(result, 'destroy', {
      enumerable: false,
      configurable: true,
      value: result.destroyAll,
    });
  }

  return result;
};
