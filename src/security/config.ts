/**
 * Global sanitizer configuration.
 *
 * `sanitizeHtml()` picks a backend the same way `src/ssr` picks a renderer: a
 * DOM one when the runtime has `document` and `DOMParser`, a DOM-free string
 * one otherwise. Apps that want the choice pinned — to get identical output
 * on the server and in the browser, or to force the DOM path after installing
 * `linkedom`/`happy-dom` globals — set it explicitly (#229).
 *
 * @module bquery/security
 */

/**
 * Backend used by `sanitizeHtml()` and `stripTags()`.
 *
 * - `'auto'` (default) — use the DOM when the runtime has one, else strings.
 * - `'dom'` — always use `DOMParser`. Throws where no DOM exists.
 * - `'string'` — always use the DOM-free scanner, even in a browser.
 */
export type SanitizerBackend = 'auto' | 'dom' | 'string';

interface SanitizerConfig {
  backend: SanitizerBackend;
}

const config: SanitizerConfig = {
  backend: 'auto',
};

/**
 * Update the global sanitizer configuration.
 *
 * @example Pin the DOM-free backend so server and browser output match
 * ```ts
 * import { configureSanitizer } from '@bquery/bquery/security';
 *
 * configureSanitizer({ backend: 'string' });
 * ```
 */
export const configureSanitizer = (options: Partial<SanitizerConfig>): void => {
  if (options.backend !== undefined) config.backend = options.backend;
};

/** A snapshot of the current sanitizer configuration. */
export const getSanitizerConfig = (): Readonly<SanitizerConfig> => ({ backend: config.backend });

/**
 * Whether the current runtime can run the DOM backend.
 * @internal
 */
export const hasDomSupport = (): boolean =>
  typeof globalThis.document !== 'undefined' &&
  typeof globalThis.document.createDocumentFragment === 'function' &&
  typeof globalThis.DOMParser === 'function';

/**
 * Resolve the backend to use right now. Honours `configureSanitizer()` and
 * otherwise detects what the runtime offers.
 * @internal
 */
export const resolveSanitizerBackend = (): 'dom' | 'string' => {
  if (config.backend === 'dom') return 'dom';
  if (config.backend === 'string') return 'string';
  return hasDomSupport() ? 'dom' : 'string';
};
