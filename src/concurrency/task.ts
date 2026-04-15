/**
 * Zero-build worker task helpers.
 *
 * @module bquery/concurrency
 */

import {
  TaskWorkerAbortError,
  TaskWorkerError,
  TaskWorkerSerializationError,
  TaskWorkerTimeoutError,
  TaskWorkerUnsupportedError,
} from './errors';
import {
  createWorkerInstance,
  normalizeTimeout,
  restoreWorkerError,
  validateTaskHandler,
  type SerializedWorkerError,
} from './internal';
import { isConcurrencySupported } from './support';
import type {
  CreateTaskWorkerOptions,
  RunTaskOptions,
  TaskRunOptions,
  TaskWorker,
  TaskWorkerState,
  WorkerTaskHandler,
} from './types';

interface WorkerSuccessMessage<TResult> {
  id: number;
  result: TResult;
  type: 'bq:result';
}

interface WorkerErrorMessage {
  error: SerializedWorkerError;
  id: number;
  type: 'bq:error';
}

type WorkerResponse<TResult> = WorkerSuccessMessage<TResult> | WorkerErrorMessage;

interface PendingRun<TResult> {
  abortHandler?: () => void;
  id: number;
  reject: (reason?: unknown) => void;
  resolve: (value: TResult | PromiseLike<TResult>) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

const WORKER_RUN_MESSAGE = 'bq:run';

const createWorkerScript = (handlerSource: string): string => {
  return `'use strict';
const serializeError = (error) => {
  if (error && typeof error === 'object') {
    return {
      code: typeof error.code === 'string' ? error.code : undefined,
      message: typeof error.message === 'string' ? error.message : 'Worker task failed.',
      name: typeof error.name === 'string' ? error.name : 'Error',
      stack: typeof error.stack === 'string' ? error.stack : undefined,
    };
  }

  return {
    message: typeof error === 'string' ? error : 'Worker task failed.',
    name: 'Error',
  };
};

const handler = (${handlerSource});

if (typeof handler !== 'function') {
  throw new TypeError('The worker task handler must evaluate to a function.');
}

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.type !== '${WORKER_RUN_MESSAGE}') {
    return;
  }

  try {
    const result = await handler(message.payload);
    self.postMessage({ id: message.id, result, type: 'bq:result' });
  } catch (error) {
    self.postMessage({ error: serializeError(error), id: message.id, type: 'bq:error' });
  }
};`;
};

/**
 * Creates a reusable worker task handle around a standalone function.
 *
 * @example
 * ```ts
 * import { createTaskWorker } from '@bquery/bquery/concurrency';
 *
 * const worker = createTaskWorker((value: number) => value * value, { name: 'square-worker' });
 * const result = await worker.run(12);
 * worker.terminate();
 * ```
 */
export function createTaskWorker<TInput = void, TResult = unknown>(
  handler: WorkerTaskHandler<TInput, TResult>,
  options: CreateTaskWorkerOptions = {}
): TaskWorker<TInput, TResult> {
  if (!isConcurrencySupported()) {
    throw new TaskWorkerUnsupportedError();
  }

  const handlerSource = validateTaskHandler(handler);
  const scriptSource = createWorkerScript(handlerSource);
  const defaultTimeout = normalizeTimeout(options.timeout);
  let disposed = false;
  let worker: Worker | null = null;
  let pending: PendingRun<TResult> | null = null;
  let nextRunId = 0;

  const cleanupPending = (): void => {
    if (!pending) {
      return;
    }

    if (pending.timeoutId !== undefined) {
      clearTimeout(pending.timeoutId);
    }

    if (pending.abortHandler) {
      pendingAbortSignal?.removeEventListener('abort', pending.abortHandler);
    }

    pending = null;
    pendingAbortSignal = undefined;
  };

  let pendingAbortSignal: AbortSignal | undefined;

  const detachWorker = (): void => {
    if (!worker) {
      return;
    }

    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    worker = null;
  };

  const rejectPending = (error: Error): void => {
    if (!pending) {
      return;
    }

    const current = pending;
    cleanupPending();
    current.reject(error);
  };

  const ensureWorker = (): Worker => {
    if (disposed) {
      throw new TaskWorkerError('The task worker has already been terminated.', 'TERMINATED');
    }

    if (worker) {
      return worker;
    }

    const instance = createWorkerInstance(scriptSource, options.name);
    instance.onmessage = (event: MessageEvent<WorkerResponse<TResult>>) => {
      const current = pending;
      if (!current) {
        return;
      }

      const message = event.data;
      if (!message || message.id !== current.id) {
        return;
      }

      cleanupPending();

      if (message.type === 'bq:error') {
        current.reject(restoreWorkerError(message.error));
        return;
      }

      current.resolve(message.result);
    };

    instance.onerror = (event: ErrorEvent) => {
      const error = new TaskWorkerError(event.message || 'Worker execution failed.', 'WORKER');
      detachWorker();
      rejectPending(error);
    };

    worker = instance;
    return instance;
  };

  const resetAfterInterruptedRun = (error: Error): void => {
    detachWorker();
    rejectPending(error);
  };

  return {
    get busy(): boolean {
      return pending !== null;
    },
    get state(): TaskWorkerState {
      if (disposed) {
        return 'terminated';
      }

      return pending ? 'running' : 'idle';
    },
    run(input: TInput, runOptions: TaskRunOptions = {}): Promise<TResult> {
      if (disposed) {
        return Promise.reject(
          new TaskWorkerError('The task worker has already been terminated.', 'TERMINATED')
        );
      }

      if (pending) {
        return Promise.reject(
          new TaskWorkerError(
            'This task worker is already running a task. Create another worker or wait for the current task to finish.',
            'BUSY'
          )
        );
      }

      if (runOptions.signal?.aborted) {
        return Promise.reject(new TaskWorkerAbortError());
      }

      const activeWorker = ensureWorker();
      const timeout = normalizeTimeout(runOptions.timeout) ?? defaultTimeout;
      const runId = nextRunId++;

      return new Promise<TResult>((resolve, reject) => {
        const current: PendingRun<TResult> = {
          id: runId,
          reject,
          resolve,
        };

        if (runOptions.signal) {
          current.abortHandler = () => {
            resetAfterInterruptedRun(new TaskWorkerAbortError());
          };
          pendingAbortSignal = runOptions.signal;
          runOptions.signal.addEventListener('abort', current.abortHandler, { once: true });
        }

        if (timeout !== undefined) {
          current.timeoutId = setTimeout(() => {
            resetAfterInterruptedRun(
              new TaskWorkerTimeoutError(`Worker task exceeded the timeout of ${timeout}ms.`)
            );
          }, timeout);
        }

        pending = current;

        try {
          activeWorker.postMessage(
            { id: runId, payload: input, type: WORKER_RUN_MESSAGE },
            runOptions.transfer ?? []
          );
        } catch (error) {
          detachWorker();
          rejectPending(
            new TaskWorkerSerializationError(
              'Failed to serialize the task input or transfer list for worker execution.',
              error
            )
          );
        }
      });
    },
    terminate(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      detachWorker();
      rejectPending(new TaskWorkerError('The task worker was terminated.', 'TERMINATED'));
    },
  };
}

/**
 * Executes a single task in a fresh worker and tears it down afterwards.
 *
 * @example
 * ```ts
 * import { runTask } from '@bquery/bquery/concurrency';
 *
 * const result = await runTask((value: number) => value * 2, 21);
 * ```
 */
export async function runTask<TInput = void, TResult = unknown>(
  handler: WorkerTaskHandler<TInput, TResult>,
  input: TInput,
  options: RunTaskOptions = {}
): Promise<TResult> {
  const worker = createTaskWorker(handler, options);

  try {
    return await worker.run(input, options);
  } finally {
    worker.terminate();
  }
}
