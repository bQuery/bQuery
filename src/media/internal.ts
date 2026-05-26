/**
 * Internal helpers shared by media composables (1.14+).
 *
 * Provides a small `createMediaSignal()` factory that standardises SSR
 * safety, idempotent `destroy()`, and `AbortSignal` teardown so individual
 * composables can focus on their event wiring.
 *
 * @internal
 * @module bquery/media
 */

import { readonly, signal } from '../reactive/index';
import type { MediaSignalHandle } from './types';

/**
 * Options accepted by every 1.14+ media composable for auto-teardown.
 *
 * @internal
 */
export interface AbortableOptions {
  /**
   * Optional `AbortSignal`. When the signal aborts the composable destroys
   * itself, matching the convention adopted by `@bquery/bquery/motion` in 1.13.
   */
  signal?: AbortSignal;
}

/**
 * Shared factory that wraps a writable signal in the standard
 * {@link MediaSignalHandle} shape, attaches a single `destroy()`
 * implementation, and wires an optional `AbortSignal`.
 *
 * @param initial   - The initial value of the signal.
 * @param setup     - Called immediately when the DOM is available. Must return
 *                    a cleanup function (or `undefined`) that detaches any
 *                    listeners or browser-side observers.
 * @param options   - Optional configuration (currently just `signal`).
 * @returns         - The readonly handle exposed to user code.
 *
 * @internal
 */
export const createMediaSignal = <T>(
  initial: T,
  setup: (set: (value: T) => void) => (() => void) | void,
  options?: AbortableOptions
): MediaSignalHandle<T> => {
  const s = signal<T>(initial);
  let cleanup: (() => void) | undefined;
  let destroyed = false;
  let abortSignal: AbortSignal | undefined;
  let onAbort: (() => void) | undefined;

  const set = (value: T): void => {
    if (destroyed) return;
    s.value = value;
  };

  if (typeof window !== 'undefined') {
    try {
      const result = setup(set);
      cleanup = typeof result === 'function' ? result : undefined;
    } catch {
      // Setup failures should never crash import-time consumers — leave
      // the signal at its initial value and proceed without listeners.
    }
  }

  const ro = readonly(s) as MediaSignalHandle<T>;

  const clearAbortListener = (): void => {
    if (abortSignal && onAbort) {
      abortSignal.removeEventListener('abort', onAbort);
    }
    abortSignal = undefined;
    onAbort = undefined;
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    try {
      cleanup?.();
    } finally {
      clearAbortListener();
      s.dispose();
    }
  };

  Object.defineProperty(ro, 'destroy', {
    enumerable: false,
    configurable: true,
    value: destroy,
  });

  if (options?.signal) {
    abortSignal = options.signal;
    if (abortSignal.aborted) {
      destroy();
    } else {
      onAbort = (): void => {
        destroy();
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return ro;
};

/**
 * Returns `true` when running inside a DOM-capable environment.
 * @internal
 */
export const hasDom = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Writable counterpart of {@link createMediaSignal}.
 *
 * Returns both the readonly handle and a `set()` writer so internal helpers
 * (e.g. {@link useWakeLock}) can update the signal in response to imperative
 * API calls outside of the `setup` closure.
 *
 * @internal
 */
export const createWritableMediaSignal = <T>(
  initial: T,
  setup?: (set: (value: T) => void) => (() => void) | void,
  options?: AbortableOptions
): { handle: MediaSignalHandle<T>; set: (value: T) => void; destroy: () => void } => {
  const s = signal<T>(initial);
  let cleanup: (() => void) | undefined;
  let destroyed = false;
  let abortSignal: AbortSignal | undefined;
  let onAbort: (() => void) | undefined;

  const set = (value: T): void => {
    if (destroyed) return;
    s.value = value;
  };

  if (typeof window !== 'undefined' && setup) {
    try {
      const result = setup(set);
      cleanup = typeof result === 'function' ? result : undefined;
    } catch {
      // swallow — leave at initial value
    }
  }

  const ro = readonly(s) as MediaSignalHandle<T>;

  const clearAbortListener = (): void => {
    if (abortSignal && onAbort) {
      abortSignal.removeEventListener('abort', onAbort);
    }
    abortSignal = undefined;
    onAbort = undefined;
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    try {
      cleanup?.();
    } finally {
      clearAbortListener();
      s.dispose();
    }
  };

  Object.defineProperty(ro, 'destroy', {
    enumerable: false,
    configurable: true,
    value: destroy,
  });

  if (options?.signal) {
    abortSignal = options.signal;
    if (abortSignal.aborted) destroy();
    else {
      onAbort = (): void => {
        destroy();
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return { handle: ro, set, destroy };
};
