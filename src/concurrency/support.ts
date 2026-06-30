/**
 * Runtime support checks for the concurrency module.
 *
 * @module bquery/concurrency
 */

import type { ConcurrencySupport } from './types';

const detectConcurrencyRuntime = (): ConcurrencySupport['runtime'] => {
  const g = globalThis as typeof globalThis & {
    Bun?: { version?: string };
    Deno?: { version?: { deno?: string } };
    process?: { versions?: { node?: string } };
    window?: unknown;
    document?: unknown;
  };

  if (typeof g.Bun?.version === 'string') {
    return 'bun';
  }

  if (typeof g.Deno?.version?.deno === 'string') {
    return 'deno';
  }

  if (typeof g.process?.versions?.node === 'string') {
    return 'node';
  }

  if (typeof g.window !== 'undefined' && typeof g.document !== 'undefined') {
    return 'browser';
  }

  return 'unknown';
};

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
  const runtime = detectConcurrencyRuntime();
  const worker = typeof globalThis.Worker === 'function';
  const blob = typeof globalThis.Blob === 'function';
  const hasUrl = typeof globalThis.URL !== 'undefined' && globalThis.URL !== null;
  const objectUrl =
    hasUrl &&
    typeof globalThis.URL.createObjectURL === 'function' &&
    typeof globalThis.URL.revokeObjectURL === 'function';
  const abortController = typeof globalThis.AbortController === 'function';
  const sharedArrayBuffer = typeof globalThis.SharedArrayBuffer === 'function';
  const crossOriginIsolated = globalThis.crossOriginIsolated === true;

  return {
    runtime,
    worker,
    blob,
    objectUrl,
    moduleWorker: worker,
    abortController,
    sharedArrayBuffer,
    crossOriginIsolated,
    supported: worker && blob && objectUrl,
  };
}

/**
 * Returns `true` when bQuery can create inline worker tasks (dynamic mode) in
 * the current environment. Dynamic workers need `Worker`, `Blob`, and
 * `URL.createObjectURL` and therefore a relaxed CSP allowing `'unsafe-eval'`.
 */
export function isConcurrencySupported(): boolean {
  return getConcurrencySupport().supported;
}

/**
 * Returns `true` when bQuery can create CSP-safe module workers in the current
 * environment. Module workers only require the `Worker` constructor, so they
 * run under a strict CSP without `'unsafe-eval'` or `blob:` worker sources.
 */
export function isModuleWorkerSupported(): boolean {
  return getConcurrencySupport().moduleWorker;
}
