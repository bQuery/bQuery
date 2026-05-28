/**
 * Reduced motion detection and global toggle helpers.
 *
 * @module bquery/motion
 */

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

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

let lastDispatchedValue: boolean | null = null;
let mediaQueryList: MediaQueryList | null = null;
let mediaQueryHandler: ((event: MediaQueryListEvent) => void) | null = null;
let subscribedMatchMedia: ((query: string) => MediaQueryList) | null = null;
let subscribedMatchMediaSource: ((query: string) => MediaQueryList) | null = null;

const resolveMatchMedia = (): {
  readonly source: (query: string) => MediaQueryList;
  readonly call: (query: string) => MediaQueryList;
} | null => {
  if (typeof window === 'undefined') return null;
  try {
    const { matchMedia } = window;
    return typeof matchMedia === 'function'
      ? {
          source: matchMedia,
          call: matchMedia.bind(window),
        }
      : null;
  } catch {
    return null;
  }
};

const syncMediaQuerySubscription = (
  currentMatchMedia: ReturnType<typeof resolveMatchMedia>
): void => {
  if (!mediaQueryList || subscribedMatchMediaSource === currentMatchMedia?.source) return;

  const previousValue = mediaQueryList.matches;
  const hadListeners = reducedMotionListeners.size > 0;

  teardownMediaQuerySubscription();

  if (!hadListeners) return;

  ensureMediaQuerySubscription(currentMatchMedia);
  lastDispatchedValue = previousValue;
  dispatchIfChanged();
};

const evaluateCurrent = (): boolean => {
  if (reducedMotionOverride !== null) return reducedMotionOverride;
  const currentMatchMedia = resolveMatchMedia();
  syncMediaQuerySubscription(currentMatchMedia);
  if (mediaQueryList) return mediaQueryList.matches;
  if (!currentMatchMedia) return false;
  try {
    return currentMatchMedia.call(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
};

const dispatchIfChanged = (): void => {
  const value = evaluateCurrent();
  if (value === lastDispatchedValue) return;
  lastDispatchedValue = value;
  for (const listener of reducedMotionListeners) listener(value);
};

const ensureMediaQuerySubscription = (
  currentMatchMedia: ReturnType<typeof resolveMatchMedia> = resolveMatchMedia()
): void => {
  if (mediaQueryList || !currentMatchMedia) return;
  try {
    subscribedMatchMediaSource = currentMatchMedia.source;
    subscribedMatchMedia = currentMatchMedia.call;
    mediaQueryList = subscribedMatchMedia(REDUCED_MOTION_QUERY);
  } catch {
    mediaQueryList = null;
    subscribedMatchMedia = null;
    subscribedMatchMediaSource = null;
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
  subscribedMatchMedia = null;
  subscribedMatchMediaSource = null;
  lastDispatchedValue = null;
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
