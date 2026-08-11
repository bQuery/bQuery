/**
 * Miscellaneous utility helpers.
 *
 * @module bquery/core/utils/misc
 */

/**
 * Creates a stable unique ID for DOM usage.
 *
 * @param prefix - Optional prefix for the ID (default: 'bQuery')
 * @returns A unique identifier string
 *
 * @example
 * ```ts
 * const id = uid('modal'); // 'modal_x7k2m9p'
 * ```
 */
export function uid(prefix = 'bQuery'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Delays execution for a specified number of milliseconds.
 *
 * @param ms - Milliseconds to delay
 * @returns A promise that resolves after the delay
 *
 * @example
 * ```ts
 * await sleep(1000); // Wait 1 second
 * console.log('Done!');
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parses a JSON string, returning a default value on error.
 *
 * @template T - The expected type of the parsed value
 * @param json - The JSON string to parse
 * @param fallback - The default value if parsing fails
 * @returns The parsed value or the fallback
 *
 * @example
 * ```ts
 * parseJson('{"name":"bQuery"}', {}); // { name: 'bQuery' }
 * parseJson('invalid', {}); // {}
 * ```
 */
export function parseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Checks for emptiness across common value types.
 *
 * @param value - The value to check
 * @returns True if the value is empty (null, undefined, empty string, empty array, or empty object)
 *
 * @example
 * ```ts
 * isEmpty('');       // true
 * isEmpty([]);       // true
 * isEmpty({});       // true
 * isEmpty(null);     // true
 * isEmpty('hello');  // false
 * isEmpty([1, 2]);   // false
 * ```
 */
export function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/**
 * Returns an RFC 4122 v4 UUID. Uses `crypto.randomUUID()` when available,
 * falling back to `crypto.getRandomValues()`-backed assembly, and finally
 * to a `Math.random()`-based variant. The fallback path is **not**
 * cryptographically secure.
 */
export function uuid(): string {
  const cryptoApi: Crypto | undefined =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex: string[] = [];
    for (const b of bytes) hex.push(b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  // Math.random fallback.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Tuple returned by {@link tryCatch}. */
export type TryCatchResult<T, E = unknown> = [E, undefined] | [null, T];

type TryCatchThenableResult<T, E = unknown> = TryCatchResult<T, E> &
  PromiseLike<TryCatchResult<T, E>> & {
    catch<TResult = never>(
      onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ): Promise<TryCatchResult<T, E> | TResult>;
    finally(onFinally?: (() => void) | null): Promise<TryCatchResult<T, E>>;
  };

function toThenableResult<T, E = unknown>(
  tuple: TryCatchResult<T, E>
): TryCatchThenableResult<T, E> {
  const settledTuple = [tuple[0], tuple[1]] as TryCatchResult<T, E>;
  const promise = Promise.resolve(settledTuple);
  const thenable = tuple as TryCatchThenableResult<T, E>;
  Object.defineProperties(thenable, {
    then: {
      value: promise.then.bind(promise),
      enumerable: false,
    },
    catch: {
      value: promise.catch.bind(promise),
      enumerable: false,
    },
    finally: {
      value: promise.finally.bind(promise),
      enumerable: false,
    },
  });
  return thenable;
}

/**
 * Runs a synchronous or asynchronous function and returns a Go-style
 * `[error, value]` tuple instead of throwing. The synchronous result
 * variant returns the tuple directly; the async variant returns a Promise.
 * Synchronous throws from Promise-typed callbacks still remain await/then-compatible.
 *
 * @example
 * ```ts
 * const [err, value] = tryCatch(() => JSON.parse(text));
 * const [aErr, data] = await tryCatch(() => fetch('/api').then((r) => r.json()));
 * ```
 */
export function tryCatch<T, E = unknown>(fn: () => Promise<T>): Promise<TryCatchResult<T, E>>;
export function tryCatch<T, E = unknown>(fn: () => T): TryCatchResult<T, E>;
export function tryCatch<T, E = unknown>(
  fn: () => T | Promise<T>
): TryCatchResult<T, E> | Promise<TryCatchResult<T, E>> {
  try {
    const result = fn();
    if (result && typeof (result as Promise<T>).then === 'function') {
      return (result as Promise<T>).then(
        (v) => [null, v] as TryCatchResult<T, E>,
        (e: E) => [e, undefined] as TryCatchResult<T, E>
      );
    }
    return [null, result as T];
  } catch (e) {
    return toThenableResult([e as E, undefined] as TryCatchResult<T, E>);
  }
}

/**
 * Invokes `fn(i)` `n` times and returns the collected results.
 *
 * @example
 * ```ts
 * times(3, (i) => i * 2); // [0, 2, 4]
 * ```
 */
export function times<T>(n: number, fn: (index: number) => T): T[] {
  const result: T[] = [];
  for (let i = 0; i < Math.max(0, Math.floor(n)); i += 1) result.push(fn(i));
  return result;
}

/** Options for {@link pollUntil}. */
export interface PollUntilOptions {
  /** Interval between polls in ms (default: 50). */
  interval?: number;
  /** Total timeout in ms; rejects when exceeded (default: 5000). */
  timeout?: number;
  /** Optional AbortSignal. */
  signal?: AbortSignal;
}

/**
 * Polls `predicate()` on a fixed interval until it returns a truthy value,
 * resolving with that value. Rejects on timeout or abort.
 *
 * Distinct from the reactive `polling()` helper — this is a small,
 * one-shot promise-based variant intended for synchronous DOM/state checks.
 *
 * @example
 * ```ts
 * const el = await pollUntil(() => document.getElementById('lazy'));
 * ```
 */
export function pollUntil<T>(
  predicate: () => T | false | null | undefined | Promise<T | false | null | undefined>,
  options: PollUntilOptions = {}
): Promise<T> {
  const { interval = 50, timeout = 5000, signal } = options;
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Aborted'));
      return;
    }
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      if (timer !== undefined) clearTimeout(timer);
      reject(signal?.reason ?? new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const tick = async () => {
      try {
        const result = await predicate();
        if (result) {
          signal?.removeEventListener('abort', onAbort);
          resolve(result as T);
          return;
        }
        if (Date.now() - start >= timeout) {
          signal?.removeEventListener('abort', onAbort);
          reject(new Error(`pollUntil timed out after ${timeout}ms`));
          return;
        }
        if (signal?.aborted) return;
        timer = setTimeout(tick, interval);
      } catch (err) {
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      }
    };
    tick();
  });
}

/**
 * Resolves on the next animation frame. Falls back to `setTimeout(0)` when
 * `requestAnimationFrame` is unavailable. Resolves with the frame timestamp
 * (or `Date.now()` in the fallback case).
 */
export function nextFrame(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame((t) => resolve(t));
    } else {
      setTimeout(() => resolve(Date.now()), 0);
    }
  });
}

/**
 * Resolves on the next microtask (or `Promise.resolve().then(...)` fallback
 * when `queueMicrotask` is unavailable).
 */
export function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(resolve);
    } else {
      Promise.resolve().then(resolve);
    }
  });
}
