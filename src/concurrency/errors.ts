/**
 * Error types for the concurrency module.
 *
 * @module bquery/concurrency
 */

import type { TaskWorkerErrorCode } from './types';

/** Base error for concurrency task failures. */
export class TaskWorkerError extends Error {
  /** Stable error code for programmatic handling. */
  code: TaskWorkerErrorCode;

  constructor(message: string, code: TaskWorkerErrorCode, cause?: unknown) {
    super(message);
    this.name = 'TaskWorkerError';
    this.code = code;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

/** Thrown when the environment cannot create inline Web Workers. */
export class TaskWorkerUnsupportedError extends TaskWorkerError {
  constructor(
    message = 'Concurrency tasks are not supported in this environment.',
    cause?: unknown
  ) {
    super(message, 'UNSUPPORTED', cause);
    this.name = 'TaskWorkerUnsupportedError';
  }
}

/** Thrown when the task handler or payload cannot be serialized safely. */
export class TaskWorkerSerializationError extends TaskWorkerError {
  constructor(message: string, cause?: unknown) {
    super(message, 'SERIALIZATION', cause);
    this.name = 'TaskWorkerSerializationError';
  }
}

/** Thrown when a task exceeds its configured timeout. */
export class TaskWorkerTimeoutError extends TaskWorkerError {
  constructor(message: string, cause?: unknown) {
    super(message, 'TIMEOUT', cause);
    this.name = 'TaskWorkerTimeoutError';
  }
}

/** Thrown when a task is aborted via `AbortSignal`. */
export class TaskWorkerAbortError extends TaskWorkerError {
  constructor(message = 'The worker task was aborted.', cause?: unknown) {
    super(message, 'ABORT', cause);
    this.name = 'TaskWorkerAbortError';
  }
}
