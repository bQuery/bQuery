/**
 * Worker pools with bounded concurrency and explicit queueing.
 *
 * @module bquery/concurrency
 */

import { TaskWorkerAbortError, TaskWorkerError } from './errors';
import { createRpcWorker } from './rpc';
import { createTaskWorker } from './task';
import type {
  CreateRpcPoolOptions,
  CreateTaskPoolOptions,
  RpcPool,
  RpcWorker,
  TaskPool,
  TaskRunOptions,
  TaskWorker,
  TaskWorkerState,
  WorkerRpcHandlers,
  WorkerTaskHandler,
} from './types';

const DEFAULT_POOL_CONCURRENCY = 4;

interface QueueEntry<TJob, TResult> {
  abortHandler?: () => void;
  job: TJob;
  options: TaskRunOptions;
  reject: (reason?: unknown) => void;
  resolve: (value: TResult | PromiseLike<TResult>) => void;
  signal?: AbortSignal;
}

interface PoolRuntime<TJob, TResult> {
  readonly state: TaskWorkerState;
  readonly busy: boolean;
  readonly concurrency: number;
  readonly pending: number;
  readonly size: number;
  enqueue(job: TJob, options?: TaskRunOptions): Promise<TResult>;
  clear(): void;
  terminate(): void;
}

interface CreatePoolRuntimeOptions<TWorker extends { busy: boolean }, TJob, TResult> {
  abortedWhileQueuedMessage: string;
  clearMessage: string;
  concurrency: number;
  createWorkers: (concurrency: number) => TWorker[];
  queueFullMessage: string;
  terminatedMessage: string;
  workerTerminatedMessage: string;
  runWorker: (worker: TWorker, job: TJob, options: TaskRunOptions) => Promise<TResult>;
  maxQueue: number;
}

const normalizeConcurrency = (concurrency: number | undefined, label: string): number => {
  if (concurrency === undefined) {
    return DEFAULT_POOL_CONCURRENCY;
  }

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`${label} concurrency must be a positive integer.`);
  }

  return concurrency;
};

const normalizeMaxQueue = (maxQueue: number | undefined, label: string): number => {
  if (maxQueue === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  if (maxQueue === Number.POSITIVE_INFINITY) {
    return maxQueue;
  }

  if (!Number.isInteger(maxQueue) || maxQueue < 0) {
    throw new RangeError(`${label} maxQueue must be a non-negative integer or Infinity.`);
  }

  return maxQueue;
};

const detachAbortListener = <TJob, TResult>(entry: QueueEntry<TJob, TResult>): void => {
  if (entry.abortHandler && entry.signal) {
    entry.signal.removeEventListener('abort', entry.abortHandler);
  }

  entry.abortHandler = undefined;
  entry.signal = undefined;
};

const createPoolRuntime = <TWorker extends { busy: boolean }, TJob, TResult>({
  abortedWhileQueuedMessage,
  clearMessage,
  concurrency,
  createWorkers,
  queueFullMessage,
  terminatedMessage,
  workerTerminatedMessage,
  runWorker,
  maxQueue,
}: CreatePoolRuntimeOptions<TWorker, TJob, TResult>): PoolRuntime<TJob, TResult> => {
  const queue: Array<QueueEntry<TJob, TResult>> = [];
  const workers = createWorkers(concurrency);
  let disposed = false;
  let running = 0;

  const drain = (): void => {
    if (disposed || queue.length === 0) {
      return;
    }

    for (const worker of workers) {
      if (queue.length === 0) {
        return;
      }

      if (worker.busy) {
        continue;
      }

      const entry = queue.shift()!;
      if (entry.signal?.aborted) {
        detachAbortListener(entry);
        entry.reject(new TaskWorkerAbortError(abortedWhileQueuedMessage));
        continue;
      }

      detachAbortListener(entry);
      running++;
      void runWorker(worker, entry.job, entry.options)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          running--;
          drain();
        });
    }
  };

  const rejectQueued = (error: TaskWorkerError): void => {
    const queued = queue.splice(0);
    for (const entry of queued) {
      detachAbortListener(entry);
      entry.reject(error);
    }
  };

  return {
    get state(): TaskWorkerState {
      if (disposed) {
        return 'terminated';
      }

      return running > 0 || queue.length > 0 ? 'running' : 'idle';
    },
    get busy(): boolean {
      return running > 0 || queue.length > 0;
    },
    concurrency,
    get pending(): number {
      return running;
    },
    get size(): number {
      return queue.length;
    },
    enqueue(job: TJob, options: TaskRunOptions = {}): Promise<TResult> {
      if (disposed) {
        return Promise.reject(new TaskWorkerError(workerTerminatedMessage, 'TERMINATED'));
      }

      if (options.signal?.aborted) {
        return Promise.reject(new TaskWorkerAbortError());
      }

      return new Promise<TResult>((resolve, reject) => {
        const entry: QueueEntry<TJob, TResult> = {
          job,
          options,
          reject,
          resolve,
        };

        const idleWorker = workers.find((worker) => !worker.busy);
        if (idleWorker) {
          running++;
          void runWorker(idleWorker, job, options)
            .then(resolve, reject)
            .finally(() => {
              running--;
              drain();
            });
          return;
        }

        if (queue.length >= maxQueue) {
          reject(new TaskWorkerError(queueFullMessage, 'QUEUE_FULL'));
          return;
        }

        if (options.signal) {
          entry.signal = options.signal;
          entry.abortHandler = () => {
            const index = queue.indexOf(entry);
            if (index === -1) {
              return;
            }

            queue.splice(index, 1);
            detachAbortListener(entry);
            reject(new TaskWorkerAbortError(abortedWhileQueuedMessage));
          };
          options.signal.addEventListener('abort', entry.abortHandler, { once: true });
        }

        queue.push(entry);
      });
    },
    clear(): void {
      if (disposed || queue.length === 0) {
        return;
      }

      rejectQueued(new TaskWorkerError(clearMessage, 'QUEUE_CLEARED'));
    },
    terminate(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      rejectQueued(new TaskWorkerError(terminatedMessage, 'TERMINATED'));
      for (const worker of workers) {
        if ('terminate' in worker && typeof worker.terminate === 'function') {
          worker.terminate();
        }
      }
    },
  };
};

const createWorkerNames = (
  name: string | undefined,
  concurrency: number
): Array<string | undefined> => {
  if (!name) {
    return Array.from({ length: concurrency }, () => undefined);
  }

  if (concurrency === 1) {
    return [name];
  }

  return Array.from({ length: concurrency }, (_, index) => `${name}-${index + 1}`);
};

/**
 * Creates a reusable pool of task workers with bounded concurrency and FIFO queueing.
 *
 * @example
 * ```ts
 * import { createTaskPool } from '@bquery/bquery/concurrency';
 *
 * const pool = createTaskPool(
 *   ({ value }: { value: number }) => value * 2,
 *   { concurrency: 4, maxQueue: 16, name: 'double-pool' }
 * );
 *
 * const results = await Promise.all([
 *   pool.run({ value: 1 }),
 *   pool.run({ value: 2 }),
 *   pool.run({ value: 3 }),
 * ]);
 *
 * pool.terminate();
 * ```
 */
export function createTaskPool<TInput = void, TResult = unknown>(
  handler: WorkerTaskHandler<TInput, TResult>,
  options: CreateTaskPoolOptions = {}
): TaskPool<TInput, TResult> {
  const {
    concurrency: concurrencyOption,
    maxQueue: maxQueueOption,
    ...workerOptions
  } = options;
  const concurrency = normalizeConcurrency(concurrencyOption, 'Task pool');
  const maxQueue = normalizeMaxQueue(maxQueueOption, 'Task pool');

  const runtime = createPoolRuntime<TaskWorker<TInput, TResult>, TInput, TResult>({
    abortedWhileQueuedMessage: 'The queued task was aborted before execution started.',
    clearMessage: 'The task pool queue was cleared.',
    concurrency,
    createWorkers(poolConcurrency) {
      const workers: Array<TaskWorker<TInput, TResult>> = [];
      const names = createWorkerNames(workerOptions.name, poolConcurrency);

      try {
        for (let index = 0; index < poolConcurrency; index++) {
          workers.push(
            createTaskWorker(handler, {
              ...workerOptions,
              name: names[index],
            })
          );
        }
      } catch (error) {
        for (const worker of workers) {
          worker.terminate();
        }
        throw error;
      }

      return workers;
    },
    queueFullMessage:
      'The task pool queue is full. Increase maxQueue, wait for pending tasks, or raise pool concurrency.',
    terminatedMessage: 'The task pool was terminated.',
    workerTerminatedMessage: 'The task pool has already been terminated.',
    runWorker(worker, job, runOptions) {
      return worker.run(job, runOptions);
    },
    maxQueue,
  });

  return {
    get state(): TaskWorkerState {
      return runtime.state;
    },
    get busy(): boolean {
      return runtime.busy;
    },
    get concurrency(): number {
      return runtime.concurrency;
    },
    get pending(): number {
      return runtime.pending;
    },
    get size(): number {
      return runtime.size;
    },
    run(input: TInput, runOptions?: TaskRunOptions): Promise<TResult> {
      return runtime.enqueue(input, runOptions);
    },
    clear(): void {
      runtime.clear();
    },
    terminate(): void {
      runtime.terminate();
    },
  };
}

/**
 * Creates a reusable pool of RPC workers with bounded concurrency and FIFO queueing.
 *
 * @example
 * ```ts
 * import { createRpcPool } from '@bquery/bquery/concurrency';
 *
 * const pool = createRpcPool(
 *   {
 *     sum: ({ values }: { values: number[] }) => values.reduce((total, value) => total + value, 0),
 *   },
 *   { concurrency: 2, maxQueue: 8 }
 * );
 *
 * const total = await pool.call('sum', { values: [1, 2, 3] });
 * pool.terminate();
 * ```
 */
export function createRpcPool<TRoutes extends WorkerRpcHandlers>(
  handlers: TRoutes,
  options: CreateRpcPoolOptions = {}
): RpcPool<TRoutes> {
  const {
    concurrency: concurrencyOption,
    maxQueue: maxQueueOption,
    ...workerOptions
  } = options;
  const concurrency = normalizeConcurrency(concurrencyOption, 'RPC pool');
  const maxQueue = normalizeMaxQueue(maxQueueOption, 'RPC pool');

  type RpcJob = {
    input: unknown;
    method: keyof TRoutes & string;
  };

  const runtime = createPoolRuntime<RpcWorker<TRoutes>, RpcJob, unknown>({
    abortedWhileQueuedMessage: 'The queued RPC call was aborted before execution started.',
    clearMessage: 'The RPC pool queue was cleared.',
    concurrency,
    createWorkers(poolConcurrency) {
      const workers: Array<RpcWorker<TRoutes>> = [];
      const names = createWorkerNames(workerOptions.name, poolConcurrency);

      try {
        for (let index = 0; index < poolConcurrency; index++) {
          workers.push(
            createRpcWorker(handlers, {
              ...workerOptions,
              name: names[index],
            })
          );
        }
      } catch (error) {
        for (const worker of workers) {
          worker.terminate();
        }
        throw error;
      }

      return workers;
    },
    queueFullMessage:
      'The RPC pool queue is full. Increase maxQueue, wait for pending calls, or raise pool concurrency.',
    terminatedMessage: 'The RPC pool was terminated.',
    workerTerminatedMessage: 'The RPC pool has already been terminated.',
    runWorker(worker, job, runOptions) {
      return worker.call(job.method, job.input as never, runOptions);
    },
    maxQueue,
  });

  return {
    get state(): TaskWorkerState {
      return runtime.state;
    },
    get busy(): boolean {
      return runtime.busy;
    },
    get concurrency(): number {
      return runtime.concurrency;
    },
    get pending(): number {
      return runtime.pending;
    },
    get size(): number {
      return runtime.size;
    },
    call<TMethod extends keyof TRoutes & string>(
      method: TMethod,
      input: Parameters<TRoutes[TMethod]>[0],
      runOptions?: TaskRunOptions
    ): Promise<Awaited<ReturnType<TRoutes[TMethod]>>> {
      return runtime.enqueue({ input, method }, runOptions) as Promise<
        Awaited<ReturnType<TRoutes[TMethod]>>
      >;
    },
    clear(): void {
      runtime.clear();
    },
    terminate(): void {
      runtime.terminate();
    },
  };
}
