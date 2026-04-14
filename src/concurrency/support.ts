/**
 * Runtime support checks for the concurrency module.
 *
 * @module bquery/concurrency
 */

import type { ConcurrencySupport } from './types';

/**
 * Returns a feature snapshot for zero-build inline worker execution.
 *
 * @example
 * ```ts
 * if (!isConcurrencySupported()) {
 *   console.warn('Worker tasks are unavailable in this environment.');
 * }
 * ```
 */
export function getConcurrencySupport(): ConcurrencySupport {
  const worker = typeof globalThis.Worker === 'function';
  const blob = typeof globalThis.Blob === 'function';
  const hasUrl = typeof globalThis.URL !== 'undefined' && globalThis.URL !== null;
  const objectUrl =
    hasUrl &&
    typeof globalThis.URL.createObjectURL === 'function' &&
    typeof globalThis.URL.revokeObjectURL === 'function';
  const abortController = typeof globalThis.AbortController === 'function';

  return {
    worker,
    blob,
    objectUrl,
    abortController,
    supported: worker && blob && objectUrl,
  };
}

/**
 * Returns `true` when bQuery can create inline worker tasks in the current
 * environment.
 */
export function isConcurrencySupported(): boolean {
  return getConcurrencySupport().supported;
}
