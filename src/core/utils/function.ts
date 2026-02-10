/**
 * Function-focused utility helpers.
 *
 * @module bquery/core/utils/function
 */

/** A debounced function with a cancel method to clear the pending timeout. */
export interface DebouncedFn<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** Cancels the pending debounced invocation. */
  cancel(): void;
}

/** A throttled function with a cancel method to reset the throttle timer. */
export interface ThrottledFn<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** Resets the throttle timer, allowing the next call to execute immediately. */
  cancel(): void;
}

/**
 * Creates a debounced function that delays execution until after
 * the specified delay has elapsed since the last call.
 *
 * @template TArgs - The argument types of the function
 * @param fn - The function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns A debounced version of the function with a `cancel()` method
 *
 * @example
 * ```ts
 * const search = debounce((query: string) => {
 *   console.log('Searching:', query);
 * }, 300);
 *
 * search('h');
 * search('he');
 * search('hello'); // Only this call executes after 300ms
 *
 * search('cancel me');
 * search.cancel(); // Cancels the pending invocation
 * ```
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number
): DebouncedFn<TArgs> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const debounced: DebouncedFn<TArgs> = Object.assign(
    (...args: TArgs) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => fn(...args), delayMs);
    },
    {
      cancel: () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      },
    }
  );
  return debounced;
}

/**
 * Creates a throttled function that runs at most once per interval.
 *
 * @template TArgs - The argument types of the function
 * @param fn - The function to throttle
 * @param intervalMs - Minimum interval between calls in milliseconds
 * @returns A throttled version of the function with a `cancel()` method
 *
 * @example
 * ```ts
 * const handleScroll = throttle(() => {
 *   console.log('Scroll position:', window.scrollY);
 * }, 100);
 *
 * window.addEventListener('scroll', handleScroll);
 *
 * handleScroll.cancel(); // Resets throttle, next call executes immediately
 * ```
 */
export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  intervalMs: number
): ThrottledFn<TArgs> {
  let lastRun = 0;
  const throttled: ThrottledFn<TArgs> = Object.assign(
    (...args: TArgs) => {
      const now = Date.now();
      if (now - lastRun >= intervalMs) {
        lastRun = now;
        fn(...args);
      }
    },
    {
      cancel: () => {
        lastRun = 0;
      },
    }
  );
  return throttled;
}

/**
 * Ensures a function only runs once. Subsequent calls return the first result.
 *
 * @template TArgs - The argument types of the function
 * @template TResult - The return type of the function
 * @param fn - The function to wrap
 * @returns A function that only runs once
 *
 * @example
 * ```ts
 * const init = once(() => ({ ready: true }));
 * init();
 * init(); // only runs once
 * ```
 */
export function once<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  let hasRun = false;
  let result!: TResult;
  return (...args: TArgs) => {
    if (!hasRun) {
      result = fn(...args);
      hasRun = true;
    }
    return result;
  };
}

/**
 * A no-operation function.
 *
 * @example
 * ```ts
 * noop();
 * ```
 */
export function noop(): void {
  // Intentionally empty
}
