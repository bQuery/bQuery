/**
 * RPC-style worker communication helpers.
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
  CallWorkerMethodOptions,
  CreateRpcWorkerOptions,
  RpcWorker,
  TaskRunOptions,
  TaskWorkerState,
  WorkerRpcHandlers,
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

const WORKER_RPC_MESSAGE = 'bq:rpc';

const validateRpcHandlers = <TRoutes extends WorkerRpcHandlers>(
  handlers: TRoutes
): Array<[keyof TRoutes & string, string]> => {
  const methodNames = Object.keys(handlers) as Array<keyof TRoutes & string>;

  if (methodNames.length === 0) {
    throw new TaskWorkerSerializationError(
      'RPC workers require at least one standalone method handler.'
    );
  }

  return methodNames.map((method) => {
    const handler = handlers[method];
    if (typeof handler !== 'function') {
      throw new TaskWorkerSerializationError(
        `RPC handler "${method}" must be a standalone function.`
      );
    }

    return [method, validateTaskHandler(handler)];
  });
};

const createRpcWorkerScript = (handlerSources: Array<[string, string]>): string => {
  const assignments = handlerSources
    .map(([method, source]) => `handlers[${JSON.stringify(method)}] = (${source});`)
    .join('\n');

  return `'use strict';
const serializeError = (error) => {
  if (error && typeof error === 'object') {
    return {
      code: typeof error.code === 'string' ? error.code : undefined,
      message: typeof error.message === 'string' ? error.message : 'Worker RPC call failed.',
      name: typeof error.name === 'string' ? error.name : 'Error',
      stack: typeof error.stack === 'string' ? error.stack : undefined,
    };
  }

  return {
    message: typeof error === 'string' ? error : 'Worker RPC call failed.',
    name: 'Error',
  };
};

const handlers = Object.create(null);
${assignments}

const hasOwn = Object.prototype.hasOwnProperty;

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.type !== '${WORKER_RPC_MESSAGE}') {
    return;
  }

  const method = typeof message.method === 'string' ? message.method : '';
  if (!hasOwn.call(handlers, method)) {
    self.postMessage({
      error: {
        code: 'METHOD_NOT_FOUND',
        message: 'Unknown RPC method "' + String(method) + '".',
        name: 'TaskWorkerError',
      },
      id: message.id,
      type: 'bq:error',
    });
    return;
  }

  try {
    const result = await handlers[method](message.payload);
    self.postMessage({ id: message.id, result, type: 'bq:result' });
  } catch (error) {
    self.postMessage({ error: serializeError(error), id: message.id, type: 'bq:error' });
  }
};`;
};

/**
 * Creates a reusable RPC-style worker with explicit named method dispatch.
 *
 * The worker processes one request at a time to keep lifecycle, timeout, abort,
 * and cleanup semantics aligned with the minimal Milestone 1 task API.
 *
 * @example
 * ```ts
 * import { createRpcWorker } from '@bquery/bquery/concurrency';
 *
 * const rpc = createRpcWorker({
 *   sum: ({ values }: { values: number[] }) => values.reduce((total, value) => total + value, 0),
 *   double: (value: number) => value * 2,
 * });
 *
 * const total = await rpc.call('sum', { values: [1, 2, 3] });
 * rpc.terminate();
 * ```
 */
export function createRpcWorker<TRoutes extends WorkerRpcHandlers>(
  handlers: TRoutes,
  options: CreateRpcWorkerOptions = {}
): RpcWorker<TRoutes> {
  if (!isConcurrencySupported()) {
    throw new TaskWorkerUnsupportedError();
  }

  const handlerSources = validateRpcHandlers(handlers);
  const scriptSource = createRpcWorkerScript(handlerSources);
  const defaultTimeout = normalizeTimeout(options.timeout);
  let disposed = false;
  let worker: Worker | null = null;
  let pending: PendingRun<unknown> | null = null;
  let nextRunId = 0;
  let pendingAbortSignal: AbortSignal | undefined;

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
      throw new TaskWorkerError('The RPC worker has already been terminated.', 'TERMINATED');
    }

    if (worker) {
      return worker;
    }

    const instance = createWorkerInstance(scriptSource, options.name);
    instance.onmessage = (event: MessageEvent<WorkerResponse<unknown>>) => {
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
      const error = new TaskWorkerError(event.message || 'Worker RPC execution failed.', 'WORKER');
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
    call<TMethod extends keyof TRoutes & string>(
      method: TMethod,
      input: Parameters<TRoutes[TMethod]>[0],
      runOptions: TaskRunOptions = {}
    ): Promise<Awaited<ReturnType<TRoutes[TMethod]>>> {
      if (disposed) {
        return Promise.reject(
          new TaskWorkerError('The RPC worker has already been terminated.', 'TERMINATED')
        );
      }

      if (pending) {
        return Promise.reject(
          new TaskWorkerError(
            'This RPC worker is already processing a request. Wait for the current call to finish or create another worker.',
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

      return new Promise<Awaited<ReturnType<TRoutes[TMethod]>>>((resolve, reject) => {
        const current: PendingRun<Awaited<ReturnType<TRoutes[TMethod]>>> = {
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
              new TaskWorkerTimeoutError(`Worker RPC call exceeded the timeout of ${timeout}ms.`)
            );
          }, timeout);
        }

        pending = current as PendingRun<unknown>;

        try {
          activeWorker.postMessage(
            { id: runId, method, payload: input, type: WORKER_RPC_MESSAGE },
            runOptions.transfer ?? []
          );
        } catch (error) {
          detachWorker();
          rejectPending(
            new TaskWorkerSerializationError(
              'Failed to serialize the RPC payload or transfer list for worker execution.',
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
      rejectPending(new TaskWorkerError('The RPC worker was terminated.', 'TERMINATED'));
    },
  };
}

/**
 * Executes a single named RPC method in a fresh worker and tears it down after
 * the response is received.
 *
 * @example
 * ```ts
 * import { callWorkerMethod } from '@bquery/bquery/concurrency';
 *
 * const total = await callWorkerMethod(
 *   {
 *     sum: ({ values }: { values: number[] }) =>
 *       values.reduce((result, value) => result + value, 0),
 *   },
 *   'sum',
 *   { values: [1, 2, 3] }
 * );
 * ```
 */
export async function callWorkerMethod<
  TRoutes extends WorkerRpcHandlers,
  TMethod extends keyof TRoutes & string,
>(
  handlers: TRoutes,
  method: TMethod,
  input: Parameters<TRoutes[TMethod]>[0],
  options: CallWorkerMethodOptions = {}
): Promise<Awaited<ReturnType<TRoutes[TMethod]>>> {
  const worker = createRpcWorker(handlers, options);

  try {
    return await worker.call(method, input, options);
  } finally {
    worker.terminate();
  }
}
