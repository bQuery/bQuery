/**
 * Runtime detection helpers for the SSR module.
 *
 * Detects whether the current runtime is Bun, Deno, Node.js, a browser,
 * or a Web-Worker / edge runtime (Cloudflare Workers / `workerd`).
 * Detection is feature-based and never throws; calling these helpers is
 * safe in any environment that provides `globalThis`.
 *
 * @module bquery/ssr
 */

/**
 * Identifier for a recognised JavaScript runtime.
 */
export type SSRRuntime = 'bun' | 'deno' | 'node' | 'browser' | 'workerd' | 'unknown';

interface BunGlobal {
  version?: string;
}

interface DenoGlobal {
  version?: { deno?: string };
}

interface NodeProcess {
  versions?: { node?: string };
}

const safeGlobal = (): Record<string, unknown> => {
  return (typeof globalThis !== 'undefined' ? globalThis : {}) as Record<string, unknown>;
};

/**
 * Detects the current runtime via feature checks on `globalThis`.
 * Order matters: Bun and Deno expose Node compatibility shims, so they are
 * checked first.
 *
 * @returns The detected runtime identifier, or `'unknown'` if none match.
 *
 * @example
 * ```ts
 * import { detectRuntime } from '@bquery/bquery/ssr';
 *
 * if (detectRuntime() === 'deno') {
 *   // Deno-specific behaviour
 * }
 * ```
 */
export const detectRuntime = (): SSRRuntime => {
  const g = safeGlobal();

  if (typeof (g.Bun as BunGlobal | undefined)?.version === 'string') {
    return 'bun';
  }

  if (typeof (g.Deno as DenoGlobal | undefined)?.version?.deno === 'string') {
    return 'deno';
  }

  // workerd / Cloudflare Workers expose `navigator.userAgent === 'Cloudflare-Workers'`
  // and lack `process.versions.node`.
  const navigator = g.navigator as { userAgent?: string } | undefined;
  if (
    typeof navigator?.userAgent === 'string' &&
    navigator.userAgent.toLowerCase().includes('cloudflare-workers')
  ) {
    return 'workerd';
  }

  if (typeof (g.process as NodeProcess | undefined)?.versions?.node === 'string') {
    return 'node';
  }

  if (typeof g.window !== 'undefined' && typeof g.document !== 'undefined') {
    return 'browser';
  }

  return 'unknown';
};

/**
 * Returns `true` when called inside a server-side runtime (Bun, Deno, Node,
 * Cloudflare Workers / `workerd`).
 */
export const isServerRuntime = (): boolean => {
  const rt = detectRuntime();
  return rt === 'bun' || rt === 'deno' || rt === 'node' || rt === 'workerd';
};

/**
 * Returns `true` when called inside a browser-like runtime (full DOM available).
 */
export const isBrowserRuntime = (): boolean => detectRuntime() === 'browser';

/**
 * Lightweight feature-detection report for runtime capabilities relevant to SSR.
 */
export interface SSRRuntimeFeatures {
  /** Whether `Request`/`Response`/`fetch` are available on `globalThis`. */
  fetchApi: boolean;
  /** Whether `ReadableStream` is available on `globalThis`. */
  webStreams: boolean;
  /** Whether `TextEncoder` is available on `globalThis`. */
  textEncoder: boolean;
  /** Whether `crypto.subtle` is available (used for ETag hashing). */
  subtleCrypto: boolean;
  /** Whether `crypto.randomUUID()` is available. */
  randomUuid: boolean;
  /** Whether the global `DOMParser` is available. */
  domParser: boolean;
}

/**
 * Returns a feature-detection report for the current runtime. All checks are
 * non-throwing; missing globals yield `false`.
 */
export const getSSRRuntimeFeatures = (): SSRRuntimeFeatures => {
  const g = safeGlobal();
  const crypto = g.crypto as { subtle?: unknown; randomUUID?: () => string } | undefined;
  return {
    fetchApi:
      typeof g.Request === 'function' &&
      typeof g.Response === 'function' &&
      typeof g.fetch === 'function',
    webStreams: typeof g.ReadableStream === 'function',
    textEncoder: typeof g.TextEncoder === 'function',
    subtleCrypto: typeof crypto?.subtle === 'object' && crypto?.subtle !== null,
    randomUuid: typeof crypto?.randomUUID === 'function',
    domParser: typeof g.DOMParser === 'function',
  };
};
