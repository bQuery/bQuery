/**
 * Function-focused utility helpers.
 *
 * @module bquery/core/utils/function
 */

/** Options for the enhanced {@link debounce} signature. */
export interface DebounceOptions {
  /** Invoke on the leading edge of the timeout (default: false). */
  leading?: boolean;
  /** Invoke on the trailing edge of the timeout (default: true). */
  trailing?: boolean;
  /** Maximum time `fn` may be delayed before being forced to run. */
  maxWait?: number;
}

/** A debounced function with `cancel()` and `flush()` controls. */
export interface DebouncedFn<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** Cancels the pending debounced invocation. */
  cancel(): void;
  /**
   * Immediately invokes any pending call with the most recent arguments,
   * if a trailing call is scheduled. No-op when nothing is pending.
   */
  flush(): void;
}

/** Options for the enhanced {@link throttle} signature. */
export interface ThrottleOptions {
  /** Invoke on the leading edge of the interval (default: true). */
  leading?: boolean;
  /** Invoke on the trailing edge of the interval (default: true). */
  trailing?: boolean;
}

/** A throttled function with `cancel()` and `flush()` controls. */
export interface ThrottledFn<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** Resets the throttle timer, allowing the next call to execute immediately. */
  cancel(): void;
  /** Immediately invokes any pending trailing call with the most recent arguments. */
  flush(): void;
}

/**
 * Creates a debounced function that delays execution until after
 * the specified delay has elapsed since the last call.
 *
 * Backward-compatible: `debounce(fn, ms)` keeps the trailing-only semantics
 * and synchronous `cancel()` of earlier releases. Pass
 * `{ leading, trailing, maxWait }` to opt in to enhanced behavior.
 *
 * @example
 * ```ts
 * const search = debounce((query: string) => doSearch(query), 300);
 * const leading = debounce(fn, 200, { leading: true, trailing: false });
 * const capped = debounce(fn, 500, { maxWait: 1500 });
 * capped.flush(); // run pending trailing call immediately
 * ```
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number,
  options: DebounceOptions = {}
): DebouncedFn<TArgs> {
  const leading = options.leading ?? false;
  const trailing = options.trailing ?? true;
  const maxWait = options.maxWait;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let maxTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: TArgs | undefined;
  let lastInvokeTime = 0;
  let leadingDone = false;

  const invoke = (args: TArgs): void => {
    lastInvokeTime = Date.now();
    pendingArgs = undefined;
    fn(...args);
  };

  const clearTrailing = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  const clearMax = () => {
    if (maxTimeoutId !== undefined) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = undefined;
    }
  };

  const trailingTrigger = () => {
    timeoutId = undefined;
    clearMax();
    if (trailing && pendingArgs) {
      invoke(pendingArgs);
    } else {
      pendingArgs = undefined;
    }
    leadingDone = false;
  };

  const debounced = ((...args: TArgs): void => {
    pendingArgs = args;
    const now = Date.now();
    if (leading && !leadingDone) {
      leadingDone = true;
      invoke(args);
    }
    clearTrailing();
    timeoutId = setTimeout(trailingTrigger, delayMs);

    if (maxWait !== undefined && maxTimeoutId === undefined) {
      const elapsed = lastInvokeTime === 0 ? 0 : now - lastInvokeTime;
      const remaining = Math.max(0, maxWait - elapsed);
      maxTimeoutId = setTimeout(() => {
        maxTimeoutId = undefined;
        clearTrailing();
        if (pendingArgs) invoke(pendingArgs);
        leadingDone = false;
      }, remaining);
    }
  }) as DebouncedFn<TArgs>;

  debounced.cancel = () => {
    clearTrailing();
    clearMax();
    pendingArgs = undefined;
    lastInvokeTime = 0;
    leadingDone = false;
  };

  debounced.flush = () => {
    if (pendingArgs) {
      const args = pendingArgs;
      clearTrailing();
      clearMax();
      invoke(args);
      leadingDone = false;
    }
  };

  return debounced;
}

/**
 * Creates a throttled function that runs at most once per interval.
 *
 * Backward-compatible: `throttle(fn, ms)` continues to execute on the
 * leading edge and ignore subsequent calls within the interval (no trailing
 * call), matching earlier releases. Pass `{ leading, trailing }` to opt in
 * to leading/trailing edge control.
 */
export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  intervalMs: number,
  options: ThrottleOptions = {}
): ThrottledFn<TArgs> {
  const leading = options.leading ?? true;
  const trailing = options.trailing ?? false;
  let lastRun = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: TArgs | undefined;

  const invoke = (args: TArgs): void => {
    lastRun = Date.now();
    pendingArgs = undefined;
    fn(...args);
  };

  const throttled = ((...args: TArgs): void => {
    const now = Date.now();
    const remaining = intervalMs - (now - lastRun);

    if (remaining <= 0 || remaining > intervalMs) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (leading) {
        invoke(args);
      } else {
        lastRun = now;
        pendingArgs = args;
        if (trailing) {
          timeoutId = setTimeout(() => {
            timeoutId = undefined;
            if (pendingArgs) invoke(pendingArgs);
          }, intervalMs);
        }
      }
    } else if (trailing) {
      pendingArgs = args;
      if (timeoutId === undefined) {
        timeoutId = setTimeout(() => {
          timeoutId = undefined;
          if (pendingArgs) invoke(pendingArgs);
        }, remaining);
      }
    }
  }) as ThrottledFn<TArgs>;

  throttled.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    pendingArgs = undefined;
    lastRun = 0;
  };

  throttled.flush = () => {
    if (pendingArgs) {
      const args = pendingArgs;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      invoke(args);
    }
  };

  return throttled;
}

/**
 * Ensures a function only runs once. Subsequent calls return the first result.
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
 */
export function noop(): void {
  // Intentionally empty
}

/** A memoized function with cache controls. */
export interface MemoizedFn<TArgs extends unknown[], TResult> {
  (...args: TArgs): TResult;
  /** Clear the entire cache. */
  clear(): void;
  /** Delete a single cached entry by its computed key. */
  delete(key: string): boolean;
}

/**
 * Caches the result of `fn` keyed by `JSON.stringify(args)` (or a custom
 * `keyFn`). The cache is unbounded; use `keyFn` and `clear()` for control.
 *
 * @example
 * ```ts
 * const factorial = memoize((n: number) => (n <= 1 ? 1 : n * factorial(n - 1)));
 * factorial.clear();
 * ```
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  keyFn?: (...args: TArgs) => string
): MemoizedFn<TArgs, TResult> {
  const cache = new Map<string, TResult>();
  const memo = ((...args: TArgs): TResult => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key) as TResult;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as MemoizedFn<TArgs, TResult>;
  memo.clear = () => cache.clear();
  memo.delete = (key) => cache.delete(key);
  return memo;
}

/**
 * Right-to-left function composition. `compose(f, g)(x) === f(g(x))`.
 * Returns an identity function with no arguments.
 */
export function compose<T>(...fns: Array<(value: T) => T>): (value: T) => T {
  if (fns.length === 0) return (value) => value;
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value);
}

/**
 * Left-to-right function composition. `pipe(f, g)(x) === g(f(x))`.
 */
export function pipe<T>(...fns: Array<(value: T) => T>): (value: T) => T {
  if (fns.length === 0) return (value) => value;
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value);
}

/**
 * Curries a function of fixed arity, returning a chain of single-argument
 * functions that collect arguments until the original arity is satisfied.
 *
 * @example
 * ```ts
 * const add = (a: number, b: number, c: number) => a + b + c;
 * const curried = curry(add);
 * curried(1)(2)(3); // 6
 * curried(1, 2)(3); // 6
 * ```
 */
export function curry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult
): (...args: Partial<TArgs>) => unknown {
  const arity = fn.length;
  const curried = (...args: unknown[]): unknown => {
    if (args.length >= arity) {
      return fn(...(args.slice(0, arity) as TArgs));
    }
    return (...more: unknown[]) => curried(...args, ...more);
  };
  return curried as (...args: Partial<TArgs>) => unknown;
}

/**
 * Returns a partially-applied function with the given preset arguments
 * baked in as the leading parameters.
 */
export function partial<TPreset extends unknown[], TRest extends unknown[], TResult>(
  fn: (...args: [...TPreset, ...TRest]) => TResult,
  ...preset: TPreset
): (...args: TRest) => TResult {
  return (...args: TRest) => fn(...preset, ...args);
}

/** Options for {@link retry}. */
export interface RetryOptions {
  /** Maximum attempt count (default: 3). */
  attempts?: number;
  /** Initial delay between attempts in ms (default: 100). */
  baseDelay?: number;
  /** Exponential backoff factor (default: 2). */
  factor?: number;
  /** Maximum delay between attempts, in ms (default: 30_000). */
  maxDelay?: number;
  /** Random jitter ratio in [0, 1) added to each delay (default: 0). */
  jitter?: number;
  /** Optional `AbortSignal` to cancel retrying. */
  signal?: AbortSignal;
  /**
   * Predicate to decide whether to retry on a given error. Default: always
   * retry until attempts are exhausted.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Optional hook invoked before each delay. */
  onRetry?: (error: unknown, attempt: number, nextDelayMs: number) => void;
}

/**
 * Runs an async function with exponential-backoff retries.
 *
 * @example
 * ```ts
 * const value = await retry(() => fetchJSON('/api/v1'), {
 *   attempts: 5,
 *   baseDelay: 200,
 *   factor: 2,
 *   jitter: 0.25,
 * });
 * ```
 */
export async function retry<T>(
  fn: () => T | Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    baseDelay = 100,
    factor = 2,
    maxDelay = 30_000,
    jitter = 0,
    signal,
    shouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      if (shouldRetry && !shouldRetry(error, attempt)) break;
      const exp = Math.min(maxDelay, baseDelay * Math.pow(factor, attempt - 1));
      const noise = jitter > 0 ? Math.random() * jitter * exp : 0;
      const delay = Math.min(maxDelay, exp + noise);
      onRetry?.(error, attempt, delay);
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        }, delay);
        const onAbort = () => {
          clearTimeout(t);
          reject(signal?.reason ?? new Error('Aborted'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    }
  }
  throw lastError;
}
