/**
 * Function-focused utility helpers.
 *
 * @module bquery/core/utils/function
 */

/**
 * Creates a debounced function that delays execution until after
 * the specified delay has elapsed since the last call.
 *
 * @template TArgs - The argument types of the function
 * @param fn - The function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns A debounced version of the function
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
 * ```
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number
): (...args: TArgs) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (...args: TArgs) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

/**
 * Creates a throttled function that runs at most once per interval.
 *
 * @template TArgs - The argument types of the function
 * @param fn - The function to throttle
 * @param intervalMs - Minimum interval between calls in milliseconds
 * @returns A throttled version of the function
 *
 * @example
 * ```ts
 * const handleScroll = throttle(() => {
 *   console.log('Scroll position:', window.scrollY);
 * }, 100);
 *
 * window.addEventListener('scroll', handleScroll);
 * ```
 */
export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  intervalMs: number
): (...args: TArgs) => void {
  let lastRun = 0;
  return (...args: TArgs) => {
    const now = Date.now();
    if (now - lastRun >= intervalMs) {
      lastRun = now;
      fn(...args);
    }
  };
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
