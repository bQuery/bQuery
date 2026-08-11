/**
 * Internal helpers shared across concurrency implementations.
 *
 * @internal
 */

import { TaskWorkerError, TaskWorkerSerializationError, TaskWorkerTimeoutError } from './errors';
import type {
  RpcWorkerModule,
  TaskWorkerErrorCode,
  WorkerExecutionMode,
  WorkerModule,
  WorkerTaskHandler,
} from './types';

/**
 * Shared worker message protocol identifiers.
 *
 * These are duplicated verbatim inside the inline `Blob` worker scripts (which
 * must be fully self-contained strings); the constants keep the main-thread and
 * module-worker (`exposeTask` / `exposeRpc`) sides in sync with them.
 *
 * @internal
 */
export const WORKER_RUN_MESSAGE = 'bq:run';
/** @internal */
export const WORKER_RPC_MESSAGE = 'bq:rpc';
/** @internal */
export const WORKER_RESULT_MESSAGE = 'bq:result';
/** @internal */
export const WORKER_ERROR_MESSAGE = 'bq:error';

/** @internal */
export interface SerializedWorkerError {
  /** Untrusted serialized worker payload; validate against TaskWorkerErrorCode before use. */
  code?: string;
  message?: string;
  name?: string;
  stack?: string;
}

const TASK_WORKER_ERROR_CODES = new Set<TaskWorkerErrorCode>([
  'ABORT',
  'BUSY',
  'CONCURRENT_LIMIT',
  'METHOD_NOT_FOUND',
  'QUEUE_CLEARED',
  'QUEUE_FULL',
  'SERIALIZATION',
  'TERMINATED',
  'TIMEOUT',
  'UNSUPPORTED',
  'WORKER',
]);

const NATIVE_FUNCTION_SOURCE_RE = /\{\s*\[native code\]\s*\}$/u;

/** @internal */
export const isTaskWorkerErrorCode = (code: string | undefined): code is TaskWorkerErrorCode => {
  return typeof code === 'string' && TASK_WORKER_ERROR_CODES.has(code as TaskWorkerErrorCode);
};

/** @internal */
export const normalizeTimeout = (timeout?: number): number | undefined => {
  if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0) {
    return undefined;
  }

  return timeout;
};

/** @internal */
export const validateTaskHandler = <TInput, TResult>(
  handler: WorkerTaskHandler<TInput, TResult>
): string => {
  const source = Function.prototype.toString.call(handler).trim();

  if (!source || NATIVE_FUNCTION_SOURCE_RE.test(source)) {
    throw new TaskWorkerSerializationError(
      'Task handlers must be standalone user-defined functions or arrow functions.'
    );
  }

  try {
    const revived = new Function(`return (${source});`)() as unknown;
    if (typeof revived !== 'function') {
      throw new TypeError('Task handler did not revive as a function.');
    }
  } catch (error) {
    throw new TaskWorkerSerializationError(
      'Task handlers must be standalone functions that can be reconstructed in a worker context.',
      error
    );
  }

  return source;
};

/** @internal */
export const createWorkerInstance = (scriptSource: string, name?: string): Worker => {
  const blob = new Blob([scriptSource], { type: 'text/javascript' });
  const scriptUrl = URL.createObjectURL(blob);

  try {
    return new Worker(scriptUrl, name ? { name } : undefined);
  } finally {
    URL.revokeObjectURL(scriptUrl);
  }
};

/** @internal Runtime brand marking a {@link WorkerModule} / {@link RpcWorkerModule}. */
export const WORKER_MODULE_BRAND: unique symbol = Symbol('bquery.concurrency.workerModule');

interface BrandedWorkerModule {
  readonly [WORKER_MODULE_BRAND]: true;
  readonly url: string | URL;
  readonly type: WorkerExecutionMode;
}

/** @internal Detects a CSP-safe module descriptor produced by `defineWorker()`. */
export const isWorkerModuleDescriptor = (
  value: unknown
): value is WorkerModule<unknown, unknown> | RpcWorkerModule => {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<BrandedWorkerModule>)[WORKER_MODULE_BRAND] === true
  );
};

/** @internal Instantiates a CSP-safe module worker addressed by URL (no eval/blob). */
export const createModuleWorkerInstance = (
  module: WorkerModule<unknown, unknown> | RpcWorkerModule,
  name?: string
): Worker => {
  if (typeof Worker !== 'function') {
    throw new TaskWorkerError(
      'The Worker constructor is unavailable in this environment.',
      'UNSUPPORTED'
    );
  }

  const options: WorkerOptions = { type: module.type };
  if (name) {
    options.name = name;
  }

  return new Worker(module.url, options);
};

/** @internal */
export const restoreWorkerError = (payload: SerializedWorkerError | undefined): TaskWorkerError => {
  const message = payload?.message || 'Worker task failed.';
  const code = isTaskWorkerErrorCode(payload?.code) ? payload.code : 'WORKER';
  const error =
    code === 'TIMEOUT' ? new TaskWorkerTimeoutError(message) : new TaskWorkerError(message, code);

  error.name = payload?.name || error.name;
  if (payload?.stack) {
    error.stack = payload.stack;
  }

  return error;
};
