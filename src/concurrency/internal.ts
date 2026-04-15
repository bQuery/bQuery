/**
 * Internal helpers shared across concurrency implementations.
 *
 * @internal
 */

import { TaskWorkerError, TaskWorkerSerializationError, TaskWorkerTimeoutError } from './errors';
import type { TaskWorkerErrorCode, WorkerTaskHandler } from './types';

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
