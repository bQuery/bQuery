/**
 * `whenIdle` and `useAsync` lifecycle / async helpers.
 *
 * @module bquery/component
 */

import { signal } from '../reactive/index';
import type { Signal } from '../reactive/index';
import { getCurrentScope } from './scope';

type IdleCallbackHandle = number;

const requestIdle = (callback: () => void): IdleCallbackHandle => {
  type IdleRequester = (cb: () => void, opts?: { timeout?: number }) => number;
  const global = globalThis as unknown as { requestIdleCallback?: IdleRequester };
  if (typeof global.requestIdleCallback === 'function') {
    return global.requestIdleCallback(callback, { timeout: 200 });
  }
  return setTimeout(callback, 1) as unknown as number;
};

const cancelIdle = (handle: IdleCallbackHandle): void => {
  type IdleCanceller = (handle: number) => void;
  const global = globalThis as unknown as { cancelIdleCallback?: IdleCanceller };
  if (typeof global.cancelIdleCallback === 'function') {
    global.cancelIdleCallback(handle);
  } else {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  }
};

/**
 * Schedule a callback to run when the browser is idle.
 *
 * Uses `requestIdleCallback` when available with a fallback to
 * `setTimeout(fn, 1)`. The pending callback is canceled automatically when the
 * component disconnects. Returns a manual cancel function.
 *
 * @example
 * ```ts
 * connected() {
 *   whenIdle(() => prefetchHeavyData());
 * }
 * ```
 */
export const whenIdle = (callback: () => void): (() => void) => {
  let cancelled = false;
  const handle = requestIdle(() => {
    if (cancelled) return;
    try {
      callback();
    } catch (error) {
      console.error('bQuery component: whenIdle() callback threw', error);
    }
  });
  const cancel = (): void => {
    if (cancelled) return;
    cancelled = true;
    cancelIdle(handle);
  };
  getCurrentScope()?.addDisposer(cancel);
  return cancel;
};

/**
 * Result shape returned by {@link useAsync}.
 */
export type UseAsyncResult<T> = {
  data: Signal<T | undefined>;
  error: Signal<unknown>;
  loading: Signal<boolean>;
  refresh: () => Promise<void>;
};

/**
 * Run an async function with reactive `data`, `error`, and `loading` signals.
 *
 * The async function receives an `AbortSignal`; if the component disconnects
 * (or `refresh()` is called again) the previous run is aborted via the standard
 * `AbortController` protocol.
 *
 * @example
 * ```ts
 * connected() {
 *   const { data, error, loading, refresh } = useAsync(async (signal) => {
 *     const res = await fetch('/api/me', { signal });
 *     return res.json();
 *   });
 *   this._refresh = refresh;
 * }
 * ```
 */
export const useAsync = <T>(
  fn: (signal: AbortSignal) => Promise<T>
): UseAsyncResult<T> => {
  const scope = getCurrentScope();
  if (!scope) {
    throw new Error(
      'bQuery component: useAsync() must be called inside a component lifecycle hook.'
    );
  }
  const data = signal<T | undefined>(undefined);
  const errorSignal = signal<unknown>(null);
  const loading = signal(false);

  let controller: AbortController | undefined;

  const refresh = async (): Promise<void> => {
    controller?.abort();
    controller = new AbortController();
    const currentController = controller;
    loading.value = true;
    errorSignal.value = null;
    try {
      const result = await fn(currentController.signal);
      if (currentController.signal.aborted) return;
      data.value = result;
    } catch (err) {
      if (currentController.signal.aborted) return;
      errorSignal.value = err;
    } finally {
      if (controller === currentController) {
        loading.value = false;
      }
    }
  };

  scope.addDisposer(() => {
    controller?.abort();
    data.dispose();
    errorSignal.dispose();
    loading.dispose();
  });

  // Kick off the initial run, but don't await it.
  void refresh();

  return { data, error: errorSignal, loading, refresh };
};
