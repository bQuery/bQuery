/**
 * CSP-safe module workers.
 *
 * `defineWorker()` / `defineRpcWorker()` describe a pre-bundled worker script by
 * URL on the main thread; `exposeTask()` / `exposeRpc()` wire that script up to
 * the bQuery worker protocol inside the worker. Because the worker body is a
 * real module loaded by URL — never a serialized function revived with
 * `new Function(...)` — this path runs under a strict Content-Security-Policy
 * without `'unsafe-eval'` or a `blob:` worker source.
 *
 * @module bquery/concurrency
 */

import { TaskWorkerSerializationError, TaskWorkerUnsupportedError } from './errors';
import {
  WORKER_ERROR_MESSAGE,
  WORKER_MODULE_BRAND,
  WORKER_RESULT_MESSAGE,
  WORKER_RPC_MESSAGE,
  WORKER_RUN_MESSAGE,
  isWorkerModuleDescriptor,
  type SerializedWorkerError,
} from './internal';
import type {
  DefineWorkerOptions,
  RpcWorkerModule,
  WorkerExecutionMode,
  WorkerHostScope,
  WorkerModule,
  WorkerRpcHandlers,
  WorkerTaskHandler,
} from './types';

const normalizeWorkerType = (type: WorkerExecutionMode | undefined): WorkerExecutionMode => {
  const resolved = type ?? 'module';
  if (resolved !== 'module' && resolved !== 'classic') {
    throw new RangeError(`Unsupported worker type "${String(type)}". Use 'module' or 'classic'.`);
  }

  return resolved;
};

const createModuleDescriptor = (
  url: string | URL,
  options: DefineWorkerOptions
): { readonly url: string | URL; readonly type: WorkerExecutionMode } => {
  const isUsableString = typeof url === 'string' && url.length > 0;
  if (!isUsableString && !(url instanceof URL)) {
    throw new TaskWorkerSerializationError(
      'defineWorker() requires a non-empty worker URL string or URL instance.'
    );
  }

  return Object.freeze({
    url,
    type: normalizeWorkerType(options.type),
    [WORKER_MODULE_BRAND]: true,
  }) as { readonly url: string | URL; readonly type: WorkerExecutionMode };
};

/**
 * Describes a CSP-safe task worker module addressed by URL.
 *
 * @example
 * ```ts
 * import { defineWorker, createTaskWorker } from '@bquery/bquery/concurrency';
 *
 * const heavy = defineWorker<number, number>(new URL('./heavy.worker.ts', import.meta.url));
 * const worker = createTaskWorker(heavy);
 * const result = await worker.run(21);
 * worker.terminate();
 * ```
 */
export function defineWorker<TInput = void, TResult = unknown>(
  url: string | URL,
  options: DefineWorkerOptions = {}
): WorkerModule<TInput, TResult> {
  return createModuleDescriptor(url, options) as WorkerModule<TInput, TResult>;
}

/**
 * Describes a CSP-safe RPC worker module addressed by URL.
 *
 * @example
 * ```ts
 * import { defineRpcWorker, createRpcWorker } from '@bquery/bquery/concurrency';
 *
 * type Routes = { sum(input: { values: number[] }): number };
 * const calc = defineRpcWorker<Routes>(new URL('./calc.worker.ts', import.meta.url));
 * const rpc = createRpcWorker(calc);
 * const total = await rpc.call('sum', { values: [1, 2, 3] });
 * rpc.terminate();
 * ```
 */
export function defineRpcWorker<TRoutes extends WorkerRpcHandlers>(
  url: string | URL,
  options: DefineWorkerOptions = {}
): RpcWorkerModule<TRoutes> {
  return createModuleDescriptor(url, options) as RpcWorkerModule<TRoutes>;
}

/**
 * Returns `true` when a value is a {@link WorkerModule} / {@link RpcWorkerModule}
 * produced by `defineWorker()` / `defineRpcWorker()`.
 */
export function isWorkerModule(
  value: unknown
): value is WorkerModule<unknown, unknown> | RpcWorkerModule {
  return isWorkerModuleDescriptor(value);
}

const serializeHostError = (error: unknown): SerializedWorkerError => {
  if (error && typeof error === 'object') {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      name?: unknown;
      stack?: unknown;
    };

    return {
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : 'Worker task failed.',
      name: typeof candidate.name === 'string' ? candidate.name : 'Error',
      stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
    };
  }

  return {
    message: typeof error === 'string' ? error : 'Worker task failed.',
    name: 'Error',
  };
};

const resolveWorkerScope = (): WorkerHostScope => {
  const scope = globalThis as unknown as WorkerHostScope & { postMessage?: unknown };
  const hasPostMessage = typeof scope.postMessage === 'function';
  const workerGlobalScopeCtor = (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope;
  const inWorkerGlobalScope =
    typeof workerGlobalScopeCtor === 'function' &&
    globalThis instanceof (workerGlobalScopeCtor as new () => object);
  const noDocument = typeof (globalThis as { document?: unknown }).document === 'undefined';

  if (!hasPostMessage || (!inWorkerGlobalScope && !noDocument)) {
    throw new TaskWorkerUnsupportedError(
      'exposeTask() / exposeRpc() must run inside a Web Worker. Pass an explicit scope to host the protocol elsewhere.'
    );
  }

  return scope;
};

interface IncomingTaskMessage {
  id?: number;
  payload?: unknown;
  type?: string;
}

interface IncomingRpcMessage extends IncomingTaskMessage {
  method?: unknown;
}

/**
 * Wires a standalone handler into the bQuery worker protocol from inside a
 * module worker. Pairs with `createTaskWorker(defineWorker(...))` on the main
 * thread.
 *
 * @example
 * ```ts
 * // heavy.worker.ts
 * import { exposeTask } from '@bquery/bquery/concurrency';
 *
 * exposeTask((value: number) => value * value);
 * ```
 *
 * @param handler - Worker-side task handler
 * @param scope - Worker global scope; defaults to the ambient worker `self`
 */
export function exposeTask<TInput = void, TResult = unknown>(
  handler: WorkerTaskHandler<TInput, TResult>,
  scope: WorkerHostScope = resolveWorkerScope()
): void {
  if (typeof handler !== 'function') {
    throw new TaskWorkerSerializationError('exposeTask() requires a task handler function.');
  }

  scope.onmessage = (event): void => {
    const message = event.data as IncomingTaskMessage | null;
    if (!message || message.type !== WORKER_RUN_MESSAGE) {
      return;
    }

    void Promise.resolve()
      .then(() => handler(message.payload as TInput))
      .then(
        (result) => {
          scope.postMessage({ id: message.id, result, type: WORKER_RESULT_MESSAGE });
        },
        (error: unknown) => {
          scope.postMessage({
            error: serializeHostError(error),
            id: message.id,
            type: WORKER_ERROR_MESSAGE,
          });
        }
      );
  };
}

/**
 * Wires a map of named RPC handlers into the bQuery worker protocol from inside
 * a module worker. Pairs with `createRpcWorker(defineRpcWorker(...))` on the
 * main thread.
 *
 * @example
 * ```ts
 * // calc.worker.ts
 * import { exposeRpc } from '@bquery/bquery/concurrency';
 *
 * exposeRpc({
 *   sum: ({ values }: { values: number[] }) => values.reduce((a, b) => a + b, 0),
 * });
 * ```
 *
 * @param handlers - Worker-side RPC handler map
 * @param scope - Worker global scope; defaults to the ambient worker `self`
 */
export function exposeRpc<TRoutes extends WorkerRpcHandlers>(
  handlers: TRoutes,
  scope: WorkerHostScope = resolveWorkerScope()
): void {
  if (!handlers || typeof handlers !== 'object') {
    throw new TaskWorkerSerializationError('exposeRpc() requires a map of RPC handlers.');
  }

  const routes: Record<string, WorkerTaskHandler<unknown, unknown>> = Object.create(null);
  const names = Object.keys(handlers);
  if (names.length === 0) {
    throw new TaskWorkerSerializationError(
      'exposeRpc() requires at least one named RPC handler.'
    );
  }

  for (const name of names) {
    const handler = handlers[name];
    if (typeof handler !== 'function') {
      throw new TaskWorkerSerializationError(`RPC handler "${name}" must be a function.`);
    }

    routes[name] = handler as WorkerTaskHandler<unknown, unknown>;
  }

  const hasOwn = Object.prototype.hasOwnProperty;

  scope.onmessage = (event): void => {
    const message = event.data as IncomingRpcMessage | null;
    if (!message || message.type !== WORKER_RPC_MESSAGE) {
      return;
    }

    const method = typeof message.method === 'string' ? message.method : '';
    if (!hasOwn.call(routes, method)) {
      scope.postMessage({
        error: {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown RPC method "${String(method)}".`,
          name: 'TaskWorkerError',
        },
        id: message.id,
        type: WORKER_ERROR_MESSAGE,
      });
      return;
    }

    void Promise.resolve()
      .then(() => routes[method]!(message.payload))
      .then(
        (result) => {
          scope.postMessage({ id: message.id, result, type: WORKER_RESULT_MESSAGE });
        },
        (error: unknown) => {
          scope.postMessage({
            error: serializeHostError(error),
            id: message.id,
            type: WORKER_ERROR_MESSAGE,
          });
        }
      );
  };
}
