/**
 * Global SSR configuration.
 *
 * Lets users opt into a custom DOM implementation (`linkedom`, `happy-dom`,
 * `jsdom`, …) for the legacy `DOMParser`-based renderer, or force the
 * DOM-free renderer everywhere. Defaults are runtime-aware: if a global
 * `DOMParser` exists, it is used (preserves legacy behaviour); otherwise the
 * DOM-free renderer kicks in automatically.
 *
 * @module bquery/ssr
 */

/**
 * Backend used by `renderToString()` and `renderToStringAsync()`.
 */
export type SSRRendererBackend = 'auto' | 'pure' | 'dom';

/**
 * DOM implementation injected by `configureSSR()` for the `'dom'` backend.
 */
export interface SSRDocumentImpl {
  /** A `DOMParser` constructor compatible with the WHATWG spec. */
  DOMParser: typeof globalThis.DOMParser;
}

interface SSRConfig {
  backend: SSRRendererBackend;
  documentImpl: SSRDocumentImpl | null;
}

const config: SSRConfig = {
  backend: 'auto',
  documentImpl: null,
};

/**
 * Updates the global SSR configuration. All options are optional and merged
 * shallowly with the existing configuration.
 *
 * @example
 * ```ts
 * import { configureSSR } from '@bquery/bquery/ssr';
 * import { DOMParser } from 'linkedom';
 *
 * configureSSR({ backend: 'dom', documentImpl: { DOMParser } });
 * ```
 */
export const configureSSR = (
  options: Partial<{ backend: SSRRendererBackend; documentImpl: SSRDocumentImpl | null }>
): void => {
  if (options.backend !== undefined) config.backend = options.backend;
  if (options.documentImpl !== undefined) config.documentImpl = options.documentImpl;
};

/**
 * Returns a snapshot of the current SSR configuration.
 */
export const getSSRConfig = (): Readonly<SSRConfig> => ({
  backend: config.backend,
  documentImpl: config.documentImpl,
});

/**
 * Resolves the renderer backend that should actually be used right now.
 * Honours `configureSSR()` and falls back to runtime feature detection.
 *
 * @internal
 */
export const resolveBackend = (): 'pure' | 'dom' => {
  if (config.backend === 'pure') return 'pure';
  if (config.backend === 'dom') return 'dom';

  if (config.documentImpl) return 'dom';
  if (typeof globalThis.DOMParser === 'function') return 'dom';
  return 'pure';
};

/**
 * Returns the configured `DOMParser` constructor or the global one.
 * @internal
 */
export const getDOMParserImpl = (): typeof globalThis.DOMParser | null => {
  if (config.documentImpl) return config.documentImpl.DOMParser;
  if (typeof globalThis.DOMParser === 'function') return globalThis.DOMParser;
  return null;
};
