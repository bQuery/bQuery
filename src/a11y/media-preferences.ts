/**
 * Reactive media preference signals for accessibility.
 *
 * Provides reactive signals that track the user's system-level
 * accessibility preferences (reduced motion, color scheme, contrast).
 *
 * @module bquery/a11y
 */

import { readonly, signal, type ReadonlySignal } from '../reactive/index';
import type { ColorScheme, ContrastPreference, MediaPreferenceSignal } from './types';

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
    return (): void => {
      mql.removeEventListener('change', handler);
    };
  }

  const legacyMql = mql as LegacyMediaQueryList;
  if (typeof legacyMql.addListener === 'function') {
    legacyMql.addListener(handler);
    return (): void => {
      legacyMql.removeListener?.(handler);
    };
  }

  return undefined;
};

const withDestroy = <T>(
  signalHandle: ReadonlySignal<T>,
  cleanup: () => void
): MediaPreferenceSignal<T> => {
  let destroyImpl = cleanup;
  const handle = signalHandle as MediaPreferenceSignal<T>;
  Object.defineProperty(handle, 'destroy', {
    configurable: true,
    enumerable: false,
    value: (): void => {
      const currentDestroy = destroyImpl;
      // Make cleanup idempotent so repeated destroy() calls from user code stay safe.
      destroyImpl = (): void => {};
      currentDestroy();
    },
  });
  return handle;
};

/**
 * Creates a reactive signal that tracks a CSS media query.
 *
 * @param query - The media query string
 * @param initialValue - Fallback value when `matchMedia` is unavailable
 * @returns A readonly signal handle that updates when the query match changes
 * @internal
 */
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
        destroy = (): void => {
          cleanupMql();
          s.dispose();
        };
      }
    } catch {
      // matchMedia may throw in non-browser environments
    }
  }

  return withDestroy(readonly(s), destroy);
};

/**
 * Returns a reactive signal indicating whether the user prefers reduced motion.
 *
 * Tracks the `(prefers-reduced-motion: reduce)` media query. Returns `true`
 * when the user has requested reduced motion in their system settings.
 *
 * @returns A readonly reactive signal handle. Call `destroy()` to remove listeners.
 *
 * @example
 * ```ts
 * import { prefersReducedMotion } from '@bquery/bquery/a11y';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const reduced = prefersReducedMotion();
 * effect(() => {
 *   if (reduced.value) {
 *     console.log('User prefers reduced motion');
 *   }
 * });
 * ```
 */
export const prefersReducedMotion = (): MediaPreferenceSignal<boolean> => {
  return createMediaSignal('(prefers-reduced-motion: reduce)', false);
};

/**
 * Returns a reactive signal tracking the user's preferred color scheme.
 *
 * Tracks the `(prefers-color-scheme: dark)` media query. Returns `'dark'`
 * when the user prefers a dark color scheme, `'light'` otherwise.
 *
 * @returns A readonly reactive signal handle with `'light'` or `'dark'`
 *
 * @example
 * ```ts
 * import { prefersColorScheme } from '@bquery/bquery/a11y';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const scheme = prefersColorScheme();
 * effect(() => {
 *   document.body.dataset.theme = scheme.value;
 * });
 * ```
 */
export const prefersColorScheme = (): MediaPreferenceSignal<ColorScheme> => {
  const s = signal<ColorScheme>('light');
  let destroy = (): void => {
    s.dispose();
  };

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      s.value = mql.matches ? 'dark' : 'light';

      const handler = (e: MediaQueryListEvent | MediaQueryList): void => {
        s.value = e.matches ? 'dark' : 'light';
      };

      const cleanupMql = bindMediaQueryListener(mql, handler);
      if (cleanupMql) {
        destroy = (): void => {
          cleanupMql();
          s.dispose();
        };
      }
    } catch {
      // matchMedia may throw in non-browser environments
    }
  }

  return withDestroy(readonly(s), destroy);
};

/**
 * Returns a reactive signal tracking the user's contrast preference.
 *
 * Tracks the `(prefers-contrast)` media query. Returns:
 * - `'more'` — user prefers higher contrast
 * - `'less'` — user prefers lower contrast
 * - `'custom'` — user has set a custom contrast level
 * - `'no-preference'` — no explicit preference
 *
 * @returns A readonly reactive signal handle
 *
 * @example
 * ```ts
 * import { prefersContrast } from '@bquery/bquery/a11y';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const contrast = prefersContrast();
 * effect(() => {
 *   if (contrast.value === 'more') {
 *     document.body.classList.add('high-contrast');
 *   }
 * });
 * ```
 */
export const prefersContrast = (): MediaPreferenceSignal<ContrastPreference> => {
  const s = signal<ContrastPreference>('no-preference');
  let destroy = (): void => {
    s.dispose();
  };

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    let mql: MediaQueryList | undefined;
    let mqlLess: MediaQueryList | undefined;
    let mqlCustom: MediaQueryList | undefined;

    const update = (): void => {
      // Defensive guard for environments where matchMedia setup fails before
      // listeners are attached; update() is only expected to run after init.
      if (!mql || !mqlLess || !mqlCustom) {
        return;
      }

      if (mql.matches) {
        s.value = 'more';
      } else if (mqlLess.matches) {
        s.value = 'less';
      } else if (mqlCustom.matches) {
        s.value = 'custom';
      } else {
        s.value = 'no-preference';
      }
    };

    // Listen for changes on the contrast preference variants
    try {
      mql = window.matchMedia('(prefers-contrast: more)');
      mqlLess = window.matchMedia('(prefers-contrast: less)');
      mqlCustom = window.matchMedia('(prefers-contrast: custom)');
      update();
      const cleanupFns = [mql, mqlLess, mqlCustom]
        .map((entry) =>
          bindMediaQueryListener(entry, () => {
            update();
          })
        )
        .filter((cleanup): cleanup is () => void => cleanup !== undefined);

      if (cleanupFns.length > 0) {
        destroy = (): void => {
          for (const cleanup of cleanupFns) {
            cleanup();
          }
          s.dispose();
        };
      }
    } catch {
      // matchMedia may throw in non-browser environments
    }
  }

  return withDestroy(readonly(s), destroy);
};
