/**
 * Reactive wrappers around reusable concurrency primitives.
 *
 * @module bquery/concurrency
 */

import { batch } from '../reactive/batch';
import { signal, type Signal } from '../reactive/core';
import { readonly } from '../reactive/readonly';
import { createRpcPool, createTaskPool } from './pool';
import { createRpcWorker } from './rpc';
import { createTaskWorker } from './task';
import type {
  CreateRpcPoolOptions,
  CreateRpcWorkerOptions,
  CreateTaskPoolOptions,
  CreateTaskWorkerOptions,
  ReactiveRpcPool,
  ReactiveRpcWorker,
  ReactiveTaskPool,
  ReactiveTaskWorker,
  TaskPool,
  TaskRunOptions,
  TaskWorker,
  TaskWorkerState,
  WorkerRpcHandlers,
  WorkerTaskHandler,
} from './types';

interface WorkerSignalMirror {
  busy: Signal<boolean>;
  state: Signal<TaskWorkerState>;
}

interface PoolSignalMirror extends WorkerSignalMirror {
  concurrency: Signal<number>;
  pending: Signal<number>;
  size: Signal<number>;
}

type WorkerStateSource = Pick<TaskWorker<unknown, unknown>, 'busy' | 'state'>;
type PoolStateSource = Pick<
  TaskPool<unknown, unknown>,
  'busy' | 'concurrency' | 'pending' | 'size' | 'state'
>;

const syncWorkerSignals = (source: WorkerStateSource, mirror: WorkerSignalMirror): void => {
  batch(() => {
    mirror.state.value = source.state;
    mirror.busy.value = source.busy;
  });
};

const syncPoolSignals = (source: PoolStateSource, mirror: PoolSignalMirror): void => {
  batch(() => {
    mirror.state.value = source.state;
    mirror.busy.value = source.busy;
    mirror.concurrency.value = source.concurrency;
    mirror.pending.value = source.pending;
    mirror.size.value = source.size;
  });
};

const createWorkerSignalMirror = (source: WorkerStateSource): WorkerSignalMirror => {
  return {
    busy: signal(source.busy),
    state: signal(source.state),
  };
};

const createPoolSignalMirror = (source: PoolStateSource): PoolSignalMirror => {
  return {
    busy: signal(source.busy),
    concurrency: signal(source.concurrency),
    pending: signal(source.pending),
    size: signal(source.size),
    state: signal(source.state),
  };
};

const attachRunSync = <TResult>(run: Promise<TResult>, sync: () => void): Promise<TResult> => {
  sync();
  return run.finally(() => {
    sync();
    queueMicrotask(sync);
  });
};

/**
 * Creates a reactive wrapper around a reusable task worker.
 *
 * The returned wrapper preserves the standard `run()` / `terminate()` API and
 * adds readonly signals such as `state$` and `busy$` for UI bindings.
 *
 * @example
 * ```ts
 * import { createReactiveTaskWorker } from '@bquery/bquery/concurrency';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const worker = createReactiveTaskWorker((value: number) => value * 2);
 *
 * effect(() => {
 *   console.log(worker.state$.value, worker.busy$.value);
 * });
 *
 * await worker.run(21);
 * worker.terminate();
 * ```
 */
export function createReactiveTaskWorker<TInput = void, TResult = unknown>(
  handler: WorkerTaskHandler<TInput, TResult>,
  options: CreateTaskWorkerOptions = {}
): ReactiveTaskWorker<TInput, TResult> {
  const worker = createTaskWorker(handler, options);
  const mirror = createWorkerSignalMirror(worker as WorkerStateSource);
  const sync = (): void => {
    syncWorkerSignals(worker as WorkerStateSource, mirror);
  };

  return {
    get busy(): boolean {
      return worker.busy;
    },
    get state(): TaskWorkerState {
      return worker.state;
    },
    busy$: readonly(mirror.busy),
    state$: readonly(mirror.state),
    run(input: TInput, runOptions: TaskRunOptions = {}): Promise<TResult> {
      return attachRunSync(worker.run(input, runOptions), sync);
    },
    terminate(): void {
      worker.terminate();
      sync();
    },
  };
}

/**
 * Creates a reactive wrapper around a reusable RPC worker.
 *
 * The returned wrapper preserves the standard `call()` / `terminate()` API and
 * adds readonly signals such as `state$` and `busy$` for UI bindings.
 *
 * @example
 * ```ts
 * import { createReactiveRpcWorker } from '@bquery/bquery/concurrency';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const rpc = createReactiveRpcWorker({
 *   sum: ({ values }: { values: number[] }) => values.reduce((total, value) => total + value, 0),
 * });
 *
 * effect(() => {
 *   console.log(rpc.state$.value, rpc.busy$.value);
 * });
 *
 * await rpc.call('sum', { values: [1, 2, 3] });
 * rpc.terminate();
 * ```
 */
export function createReactiveRpcWorker<TRoutes extends WorkerRpcHandlers>(
  handlers: TRoutes,
  options: CreateRpcWorkerOptions = {}
): ReactiveRpcWorker<TRoutes> {
  const worker = createRpcWorker(handlers, options);
  const mirror = createWorkerSignalMirror(worker as WorkerStateSource);
  const sync = (): void => {
    syncWorkerSignals(worker as WorkerStateSource, mirror);
  };

  return {
    get busy(): boolean {
      return worker.busy;
    },
    get state(): TaskWorkerState {
      return worker.state;
    },
    busy$: readonly(mirror.busy),
    state$: readonly(mirror.state),
    call<TMethod extends keyof TRoutes & string>(
      method: TMethod,
      input: Parameters<TRoutes[TMethod]>[0],
      runOptions: TaskRunOptions = {}
    ): Promise<Awaited<ReturnType<TRoutes[TMethod]>>> {
      return attachRunSync(worker.call(method, input, runOptions), sync);
    },
    terminate(): void {
      worker.terminate();
      sync();
    },
  };
}

/**
 * Creates a reactive wrapper around a reusable task pool.
 *
 * The returned wrapper preserves the standard `run()` / `clear()` /
 * `terminate()` API and adds readonly signals for pool state and queue load.
 *
 * @example
 * ```ts
 * import { createReactiveTaskPool } from '@bquery/bquery/concurrency';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const pool = createReactiveTaskPool((value: number) => value * 2, { concurrency: 2 });
 *
 * effect(() => {
 *   console.log(pool.pending$.value, pool.size$.value, pool.state$.value);
 * });
 *
 * await Promise.all([pool.run(1), pool.run(2), pool.run(3)]);
 * pool.terminate();
 * ```
 */
export function createReactiveTaskPool<TInput = void, TResult = unknown>(
  handler: WorkerTaskHandler<TInput, TResult>,
  options: CreateTaskPoolOptions = {}
): ReactiveTaskPool<TInput, TResult> {
  const pool = createTaskPool(handler, options);
  const mirror = createPoolSignalMirror(pool as PoolStateSource);
  const sync = (): void => {
    syncPoolSignals(pool as PoolStateSource, mirror);
  };

  return {
    get busy(): boolean {
      return pool.busy;
    },
    get concurrency(): number {
      return pool.concurrency;
    },
    get pending(): number {
      return pool.pending;
    },
    get size(): number {
      return pool.size;
    },
    get state(): TaskWorkerState {
      return pool.state;
    },
    busy$: readonly(mirror.busy),
    concurrency$: readonly(mirror.concurrency),
    pending$: readonly(mirror.pending),
    size$: readonly(mirror.size),
    state$: readonly(mirror.state),
    run(input: TInput, runOptions: TaskRunOptions = {}): Promise<TResult> {
      return attachRunSync(pool.run(input, runOptions), sync);
    },
    clear(): void {
      pool.clear();
      sync();
    },
    terminate(): void {
      pool.terminate();
      sync();
    },
  };
}

/**
 * Creates a reactive wrapper around a reusable RPC pool.
 *
 * The returned wrapper preserves the standard `call()` / `clear()` /
 * `terminate()` API and adds readonly signals for pool state and queue load.
 *
 * @example
 * ```ts
 * import { createReactiveRpcPool } from '@bquery/bquery/concurrency';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const pool = createReactiveRpcPool(
 *   {
 *     sum: ({ values }: { values: number[] }) => values.reduce((total, value) => total + value, 0),
 *   },
 *   { concurrency: 2 }
 * );
 *
 * effect(() => {
 *   console.log(pool.pending$.value, pool.size$.value, pool.state$.value);
 * });
 *
 * await Promise.all([
 *   pool.call('sum', { values: [1, 2] }),
 *   pool.call('sum', { values: [3, 4] }),
 *   pool.call('sum', { values: [5, 6] }),
 * ]);
 *
 * pool.terminate();
 * ```
 */
export function createReactiveRpcPool<TRoutes extends WorkerRpcHandlers>(
  handlers: TRoutes,
  options: CreateRpcPoolOptions = {}
): ReactiveRpcPool<TRoutes> {
  const pool = createRpcPool(handlers, options);
  const mirror = createPoolSignalMirror(pool as PoolStateSource);
  const sync = (): void => {
    syncPoolSignals(pool as PoolStateSource, mirror);
  };

  return {
    get busy(): boolean {
      return pool.busy;
    },
    get concurrency(): number {
      return pool.concurrency;
    },
    get pending(): number {
      return pool.pending;
    },
    get size(): number {
      return pool.size;
    },
    get state(): TaskWorkerState {
      return pool.state;
    },
    busy$: readonly(mirror.busy),
    concurrency$: readonly(mirror.concurrency),
    pending$: readonly(mirror.pending),
    size$: readonly(mirror.size),
    state$: readonly(mirror.state),
    call<TMethod extends keyof TRoutes & string>(
      method: TMethod,
      input: Parameters<TRoutes[TMethod]>[0],
      runOptions: TaskRunOptions = {}
    ): Promise<Awaited<ReturnType<TRoutes[TMethod]>>> {
      return attachRunSync(pool.call(method, input, runOptions), sync);
    },
    clear(): void {
      pool.clear();
      sync();
    },
    terminate(): void {
      pool.terminate();
      sync();
    },
  };
}
