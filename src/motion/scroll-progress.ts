/**
 * Scroll-progress and in-view helpers.
 *
 * `scrollProgress()` exposes a 0..1 scroll-linked value as a stream of
 * callback invocations, and `inView()` resolves a Promise (or invokes a
 * signal-like callback) when an element enters the viewport.
 *
 * @module bquery/motion
 */

/**
 * Options for {@link scrollProgress}.
 */
export interface ScrollProgressOptions {
  /**
   * Currently ignored by `scrollProgress()`.
   * Included as a compatibility option for future root-relative support.
   */
  root?: Element | Document | null;
  /**
   * Currently ignored by `scrollProgress()`.
   * Included as a compatibility option for future root-relative support.
   */
  rootMargin?: string;
  /**
   * Currently ignored by `scrollProgress()`.
   * Included as a compatibility option for future offset parsing support.
   *
   * Anchor points (start, end) controlling when progress hits 0 and 1.
   * Defaults to `['top bottom', 'bottom top']` — the element's top entering
   * the viewport bottom is `0`, its bottom leaving the viewport top is `1`.
   */
  offset?: [string, string];
  /** Invoked on every progress change with a value in `[0, 1]`. */
  onProgress: (progress: number) => void;
}

/**
 * Cleanup function returned by {@link scrollProgress} and {@link inView}.
 */
export type ScrollProgressCleanup = () => void;

/**
 * Drive a `[0, 1]` scroll-progress signal as an element moves through the
 * viewport. The callback is invoked on every relevant scroll/resize tick.
 *
 * Progress is computed against the window's height: `0` when the element's
 * top sits at the viewport bottom (about to enter) and `1` when the
 * element's bottom passes the viewport top (just exited above).
 * `root`, `rootMargin`, and `offset` are currently no-op compatibility
 * options; the computation is always window-relative.
 *
 * @returns A cleanup function that detaches listeners and observers.
 *
 * @example
 * ```ts
 * const cleanup = scrollProgress(section, {
 *   onProgress: (p) => header.style.opacity = String(1 - p),
 * });
 * ```
 */
export const scrollProgress = (
  element: Element,
  options: ScrollProgressOptions
): ScrollProgressCleanup => {
  if (
    typeof window === 'undefined' ||
    typeof window.addEventListener !== 'function' ||
    typeof window.removeEventListener !== 'function'
  ) {
    return () => {};
  }

  const { onProgress } = options;
  let frameId: number | null = null;
  let destroyed = false;
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : ((cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 16) as unknown as number);
  const caf =
    typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

  const compute = () => {
    if (destroyed) return;
    const rect = element.getBoundingClientRect();
    const ownerDocument = element.ownerDocument;
    const globalDocument = typeof document !== 'undefined' ? document : undefined;
    const viewport =
      typeof window.innerHeight === 'number' && window.innerHeight > 0
        ? window.innerHeight
        : (ownerDocument?.documentElement?.clientHeight ??
          globalDocument?.documentElement?.clientHeight ??
          0);
    if (viewport <= 0) {
      onProgress(0);
      return;
    }
    const total = rect.height + viewport;
    const traveled = viewport - rect.top;
    const progress = Math.min(1, Math.max(0, traveled / total));
    onProgress(progress);
  };

  const onScroll = () => {
    if (destroyed) return;
    if (frameId !== null) return;
    frameId = raf(() => {
      frameId = null;
      compute();
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Initial sample.
  compute();

  return () => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    if (frameId !== null) caf(frameId);
    frameId = null;
  };
};

/**
 * Options for {@link inView}.
 */
export interface InViewOptions {
  /** IntersectionObserver root (default: viewport). */
  root?: Element | Document | null;
  /** Root margin (default: `'0px'`). */
  rootMargin?: string;
  /** Intersection threshold (default: `0`). */
  threshold?: number | number[];
  /**
   * When provided, invoked every time the element enters or leaves the
   * viewport; the returned cleanup stops observing. If omitted, `inView()`
   * resolves the first time the element enters and detaches automatically.
   */
  onChange?: (entered: boolean) => void;
}

/**
 * Result returned by {@link inView}. The `then`-able form makes the result
 * `await`-friendly while the `cancel()` method lets callers stop observing
 * before the element enters.
 */
export interface InViewHandle extends PromiseLike<void> {
  /** Stop observing. */
  cancel(): void;
}

/**
 * Wait for an element to enter the viewport.
 *
 * Awaiting the return value resolves the first time the element becomes
 * visible. Pass `onChange` for a reactive callback-style usage that fires
 * on every enter/leave transition until the returned `.cancel()` is invoked.
 *
 * @example
 * ```ts
 * await inView(card);
 * card.classList.add('visible');
 * ```
 */
export const inView = (element: Element, options: InViewOptions = {}): InViewHandle => {
  const { root = null, rootMargin = '0px', threshold = 0, onChange } = options;
  let cancelled = false;
  let observer: IntersectionObserver | null = null;
  let resolved = false;
  let resolveEntered!: () => void;

  const enteredPromise = new Promise<void>((resolve) => {
    resolveEntered = resolve;
  });

  if (typeof IntersectionObserver === 'undefined') {
    // Conservatively assume in-view in non-DOM environments.
    onChange?.(true);
    resolveEntered();
    resolved = true;
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target !== element) continue;
          if (onChange) {
            onChange(entry.isIntersecting);
          }
          if (entry.isIntersecting && !resolved) {
            resolved = true;
            resolveEntered();
            if (!onChange) {
              observer?.disconnect();
              observer = null;
            }
          }
        }
      },
      { root: root as Element | Document | null, rootMargin, threshold }
    );
    observer.observe(element);
  }

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    observer?.disconnect();
    observer = null;
    if (!resolved) {
      resolved = true;
      resolveEntered();
    }
  };

  return {
    cancel,
    then<TResult1 = void, TResult2 = never>(
      onFulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      return enteredPromise.then(onFulfilled, onRejected);
    },
  };
};
