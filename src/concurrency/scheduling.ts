/**
 * Client-side async-concurrency primitives for keeping the UI responsive.
 *
 * These are about **UI scheduling**, not worker offloading: a declarative
 * async boundary (`suspense`), a non-urgent update marker (`startTransition`),
 * and a trailing value wrapper (`deferred`). They build directly on bQuery
 * signals, add no dependencies, and are independently tree-shakeable.
 *
 * @module bquery/concurrency
 */

import { batch } from '../reactive/batch';
import { signal } from '../reactive/core';
import { effect } from '../reactive/effect';
import { readonly, type ReadonlySignalHandle } from '../reactive/readonly';
import { toValue, type MaybeSignal } from '../reactive/to-value';
import { untrack } from '../reactive/untrack';
import type {
  DeferredOptions,
  DeferredSource,
  SuspendableState,
  SuspenseBoundary,
  SuspenseOptions,
  SuspenseSource,
  StartTransitionOptions,
  Transition,
  TransitionStart,
} from './types';

interface ScheduledHandle {
  cancel(): void;
}

interface IdleScheduler {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

/**
 * Schedules low-priority work. A positive `timeout` uses a trailing
 * `setTimeout`; otherwise it prefers `requestIdleCallback` and falls back to a
 * macrotask so non-urgent updates never block the current input frame.
 */
// Upper bound (ms) on how long an idle callback may be deferred. Without it,
// `requestIdleCallback` offers no liveness guarantee, so a perpetually busy
// main thread could starve a deferred scope forever (e.g. `isPending` stuck
// true). The timeout forces the callback to run by the deadline at the latest.
const IDLE_CALLBACK_TIMEOUT_MS = 100;

const scheduleDeferred = (callback: () => void, timeout?: number): ScheduledHandle => {
  if (typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0) {
    const id = setTimeout(callback, timeout);
    return { cancel: () => clearTimeout(id) };
  }

  const scheduler = globalThis as unknown as IdleScheduler;
  if (
    typeof scheduler.requestIdleCallback === 'function' &&
    typeof scheduler.cancelIdleCallback === 'function'
  ) {
    const id = scheduler.requestIdleCallback(callback, { timeout: IDLE_CALLBACK_TIMEOUT_MS });
    const cancel = scheduler.cancelIdleCallback;
    return { cancel: () => cancel(id) };
  }

  const id = setTimeout(callback, 0);
  return { cancel: () => clearTimeout(id) };
};

/**
 * Marks updates as non-urgent so urgent work (typing, clicks) stays responsive.
 *
 * `start(scope)` flips `isPending` to `true` immediately, then runs `scope` on a
 * low-priority schedule inside a reactive `batch`. The expensive reactive
 * fallout of the update is decoupled from the urgent event that triggered it.
 *
 * @example
 * ```ts
 * import { startTransition } from '@bquery/bquery/concurrency';
 *
 * const [isPending, start] = startTransition();
 * input.addEventListener('input', (event) => {
 *   query.value = event.target.value;           // urgent: keeps the field snappy
 *   start(() => filter.value = event.target.value); // non-urgent: heavy list update
 * });
 * ```
 */
export function startTransition(options: StartTransitionOptions = {}): Transition {
  const pending = signal(false);
  let inFlight = 0;

  const start: TransitionStart = (scope) => {
    if (typeof scope !== 'function') {
      throw new TypeError('startTransition() start requires a function scope.');
    }

    inFlight += 1;
    if (!pending.peek()) {
      pending.value = true;
    }

    scheduleDeferred(() => {
      try {
        batch(scope);
      } catch (error) {
        // Contain a buggy non-urgent scope rather than letting it escape as an
        // uncaught exception in the timer/idle task — mirrors effect()'s
        // reporting so an error in deferred work cannot take down the host.
        console.error('bQuery concurrency: Error in startTransition scope', error);
      } finally {
        inFlight -= 1;
        if (inFlight === 0) {
          pending.value = false;
        }
      }
    }, options.timeout);
  };

  return [readonly(pending), start];
}

const readDeferredSource = <T>(source: DeferredSource<T>): T =>
  typeof source === 'function' ? (source as () => T)() : toValue(source as MaybeSignal<T>);

/**
 * Produces a readonly signal that lags behind its source, throttling expensive
 * derived UI. Rapid source changes coalesce into a single trailing update.
 *
 * The deferred signal exposes the previous value until the scheduler flushes,
 * so a heavy computed driven by it does not recompute on every keystroke.
 *
 * @example
 * ```ts
 * import { deferred } from '@bquery/bquery/concurrency';
 * import { computed } from '@bquery/bquery/reactive';
 *
 * const deferredQuery = deferred(query);            // lags `query`
 * const results = computed(() => expensiveSearch(deferredQuery.value));
 * ```
 */
export function deferred<T>(
  source: DeferredSource<T>,
  options: DeferredOptions = {}
): ReadonlySignalHandle<T> {
  const mirror = signal<T>(untrack(() => readDeferredSource(source)));

  effect(() => {
    const next = readDeferredSource(source);
    const scheduled = scheduleDeferred(() => {
      untrack(() => {
        if (!Object.is(mirror.peek(), next)) {
          mirror.value = next;
        }
      });
    }, options.timeout);

    return () => scheduled.cancel();
  });

  return readonly(mirror);
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as PromiseLike<unknown>).then === 'function';

const normalizeSuspenseError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Suspense source failed.');
};

/**
 * Declarative async boundary: aggregates promises and reactive async states
 * (e.g. `useAsyncData()` / `useResource()`) into reactive `pending` / `settled`
 * / `error` signals so the view can swap fallback and content without bespoke
 * loading flags. Pairs with SSR suspense streaming so the same boundary streams
 * on the server and suspends on the client.
 *
 * @example
 * ```ts
 * import { suspense } from '@bquery/bquery/concurrency';
 * import { useAsyncData } from '@bquery/bquery/reactive';
 *
 * const user = useAsyncData(() => fetchUser(id));
 * const boundary = suspense(user);
 *
 * // <div bq-show="boundary.pending">Loading…</div>
 * // <div bq-show="boundary.settled">…content…</div>
 * effect(() => {
 *   if (boundary.error.value) reportError(boundary.error.value);
 * });
 * ```
 *
 * @param sources - One source or an array of promises / reactive states / pending getters
 * @param options - Boundary behavior (e.g. `retrigger`)
 */
export function suspense(
  sources: SuspenseSource | readonly SuspenseSource[],
  options: SuspenseOptions = {}
): SuspenseBoundary {
  const list = Array.isArray(sources)
    ? (sources as readonly SuspenseSource[])
    : [sources as SuspenseSource];
  const retrigger = options.retrigger !== false;

  const pendingSignal = signal(false);
  const settledSignal = signal(false);
  const errorSignal = signal<Error | null>(null);

  const pendingReaders: Array<() => boolean> = [];
  const errorReaders: Array<() => Error | null> = [];
  const disposers: Array<() => void> = [];

  const recordError = (error: unknown): void => {
    const normalized = normalizeSuspenseError(error);
    untrack(() => {
      if (errorSignal.peek() === null) {
        errorSignal.value = normalized;
      }
    });
  };

  for (const source of list) {
    if (isPromiseLike(source)) {
      const sourcePending = signal(true);
      let active = true;

      Promise.resolve(source).then(
        () => {
          if (active) {
            sourcePending.value = false;
          }
        },
        (error: unknown) => {
          if (!active) {
            return;
          }

          recordError(error);
          sourcePending.value = false;
        }
      );

      disposers.push(() => {
        active = false;
      });
      pendingReaders.push(() => sourcePending.value);
    } else if (typeof source === 'function') {
      pendingReaders.push(() => Boolean((source as () => boolean)()));
    } else {
      const state = source as SuspendableState;
      pendingReaders.push(() => Boolean(state.pending?.value));
      if (state.error) {
        const errorState = state.error;
        errorReaders.push(() => errorState.value ?? null);
      }
    }
  }

  let latchedSettled = false;

  const stop = effect(() => {
    let anyPending = false;
    for (const read of pendingReaders) {
      if (read()) {
        anyPending = true;
      }
    }

    let firstError: Error | null = null;
    for (const read of errorReaders) {
      const error = read();
      if (error && !firstError) {
        firstError = error;
      }
    }

    untrack(() => {
      batch(() => {
        if (pendingSignal.peek() !== anyPending) {
          pendingSignal.value = anyPending;
        }

        if (firstError && errorSignal.peek() === null) {
          errorSignal.value = firstError;
        }

        if (!anyPending) {
          latchedSettled = true;
        }

        const nextSettled = retrigger ? !anyPending : latchedSettled;
        if (settledSignal.peek() !== nextSettled) {
          settledSignal.value = nextSettled;
        }
      });
    });
  });

  return {
    pending: readonly(pendingSignal),
    settled: readonly(settledSignal),
    error: readonly(errorSignal),
    dispose(): void {
      stop();
      for (const disposer of disposers) {
        disposer();
      }
    },
  };
}
