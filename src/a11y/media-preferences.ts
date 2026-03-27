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
const createMediaSignal = (query: string, initialValue: boolean): MediaPreferenceSignal<boolean> => {
  const s = signal(initialValue);
  let destroy = (): void => {
    s.dispose();
  };

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia(query);
      s.value = mql.matches;

      const handler = (e: MediaQueryListEvent): void => {
        s.value = e.matches;
      };

      mql.addEventListener('change', handler);
      destroy = (): void => {
        mql.removeEventListener('change', handler);
        s.dispose();
      };
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

      const handler = (e: MediaQueryListEvent): void => {
        s.value = e.matches ? 'dark' : 'light';
      };

      mql.addEventListener('change', handler);
      destroy = (): void => {
        mql.removeEventListener('change', handler);
        s.dispose();
      };
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
    const update = (): void => {
      try {
        if (window.matchMedia('(prefers-contrast: more)').matches) {
          s.value = 'more';
        } else if (window.matchMedia('(prefers-contrast: less)').matches) {
          s.value = 'less';
        } else if (window.matchMedia('(prefers-contrast: custom)').matches) {
          s.value = 'custom';
        } else {
          s.value = 'no-preference';
        }
      } catch {
        // matchMedia may throw in non-browser environments
      }
    };

    update();

    // Listen for changes on the contrast preference variants
    try {
      const mql = window.matchMedia('(prefers-contrast: more)');
      mql.addEventListener('change', update);

      const mqlLess = window.matchMedia('(prefers-contrast: less)');
      mqlLess.addEventListener('change', update);

      const mqlCustom = window.matchMedia('(prefers-contrast: custom)');
      mqlCustom.addEventListener('change', update);
      destroy = (): void => {
        mql.removeEventListener('change', update);
        mqlLess.removeEventListener('change', update);
        mqlCustom.removeEventListener('change', update);
        s.dispose();
      };
    } catch {
      // matchMedia may throw in non-browser environments
    }
  }

  return withDestroy(readonly(s), destroy);
};
