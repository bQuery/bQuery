/**
 * Reduced motion detection and global toggle helpers.
 *
 * @module bquery/motion
 */

import { readonly, signal, type ReadonlySignal } from '../reactive/index';

/**
 * Global override for reduced motion preference.
 * When `null`, the system preference is used.
 * When `true`, reduced motion is forced on.
 * When `false`, reduced motion is forced off.
 *
 * @internal
 */
let reducedMotionOverride: boolean | null = null;

/**
 * Subscribers receiving notifications when the effective reduced-motion
 * preference changes.
 * @internal
 */
const reducedMotionListeners = new Set<(reduced: boolean) => void>();

let lastDispatchedValue: boolean | null = null;
let mediaQueryList: MediaQueryList | null = null;
let mediaQueryHandler: ((event: MediaQueryListEvent) => void) | null = null;

const evaluateCurrent = (): boolean => {
  if (reducedMotionOverride !== null) return reducedMotionOverride;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const dispatchIfChanged = (): void => {
  const value = evaluateCurrent();
  if (value === lastDispatchedValue) return;
  lastDispatchedValue = value;
  for (const listener of reducedMotionListeners) listener(value);
};

const ensureMediaQuerySubscription = (): void => {
  if (mediaQueryList || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  try {
    mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    mediaQueryList = null;
    return;
  }
  mediaQueryHandler = () => dispatchIfChanged();
  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', mediaQueryHandler);
  } else if (typeof (mediaQueryList as MediaQueryList & {
    addListener?: (cb: (event: MediaQueryListEvent) => void) => void;
  }).addListener === 'function') {
    (mediaQueryList as MediaQueryList & {
      addListener: (cb: (event: MediaQueryListEvent) => void) => void;
    }).addListener(mediaQueryHandler);
  }
};

const teardownMediaQuerySubscription = (): void => {
  if (!mediaQueryList || !mediaQueryHandler) return;
  if (typeof mediaQueryList.removeEventListener === 'function') {
    mediaQueryList.removeEventListener('change', mediaQueryHandler);
  } else if (typeof (mediaQueryList as MediaQueryList & {
    removeListener?: (cb: (event: MediaQueryListEvent) => void) => void;
  }).removeListener === 'function') {
    (mediaQueryList as MediaQueryList & {
      removeListener: (cb: (event: MediaQueryListEvent) => void) => void;
    }).removeListener(mediaQueryHandler);
  }
  mediaQueryList = null;
  mediaQueryHandler = null;
};

/**
 * Check whether reduced motion should be applied.
 *
 * Returns the global override if set via {@link setReducedMotion},
 * otherwise checks the user's system preference.
 *
 * @returns `true` if reduced motion should be applied
 *
 * @example
 * ```ts
 * if (prefersReducedMotion()) {
 *   // skip animation
 * }
 * ```
 */
export const prefersReducedMotion = (): boolean => {
  return evaluateCurrent();
};

/**
 * Programmatically override the reduced motion preference globally.
 *
 * When set to `true`, all motion functions that respect reduced motion
 * will skip animations. When set to `false`, animations run regardless
 * of system settings. Pass `null` to restore system-preference detection.
 *
 * @param override - `true` to force reduced motion, `false` to force
 *   full motion, or `null` to use system preference
 *
 * @example
 * ```ts
 * // Force all animations to be instant
 * setReducedMotion(true);
 *
 * // Re-enable animations regardless of system
 * setReducedMotion(false);
 *
 * // Restore system preference
 * setReducedMotion(null);
 * ```
 */
export const setReducedMotion = (override: boolean | null): void => {
  reducedMotionOverride = override;
  dispatchIfChanged();
};

/**
 * Subscribe to changes in the effective reduced-motion preference.
 *
 * The callback receives the new value and is invoked whenever the system
 * preference changes (via `matchMedia` change events) or when
 * {@link setReducedMotion} updates the override. Returns an unsubscribe
 * function.
 *
 * @example
 * ```ts
 * const off = onReducedMotionChange((reduced) => {
 *   document.documentElement.dataset.reducedMotion = String(reduced);
 * });
 * // ... later
 * off();
 * ```
 */
export const onReducedMotionChange = (callback: (reduced: boolean) => void): (() => void) => {
  reducedMotionListeners.add(callback);
  if (lastDispatchedValue === null) lastDispatchedValue = evaluateCurrent();
  ensureMediaQuerySubscription();
  return () => {
    reducedMotionListeners.delete(callback);
    if (reducedMotionListeners.size === 0) teardownMediaQuerySubscription();
  };
};

/**
 * Reactive readonly signal that tracks the effective reduced-motion
 * preference. The signal updates automatically when the user's system
 * preference changes or when {@link setReducedMotion} is called.
 *
 * @example
 * ```ts
 * import { effect } from '@bquery/bquery/reactive';
 * const reduced = reducedMotionSignal();
 * effect(() => console.log('reduced motion:', reduced.value));
 * ```
 */
export const reducedMotionSignal = (): ReadonlySignal<boolean> => {
  const inner = signal(evaluateCurrent());
  onReducedMotionChange((value) => {
    inner.value = value;
  });
  return readonly(inner);
};
