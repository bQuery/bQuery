/**
 * Resumability hooks.
 *
 * A *very* small primitive that lets the server publish JSON-serializable
 * values which the client can read back without re-running the producer.
 * Think of it as a typed key/value store that survives the serialization
 * boundary.
 *
 * It is intentionally not a full Qwik-style resumability system — bQuery's
 * reactive graph is rebuilt on the client. Instead, this primitive helps
 * applications avoid double-fetching loader-style data by parking it on
 * `window.__BQUERY_RESUME__` (or a custom global) inside a CSP-nonce-aware
 * `<script>` tag.
 *
 * @module bquery/ssr
 */

import { isPrototypePollutionKey } from '../core/utils/object';

const escapeForScript = (str: string): string =>
  str
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\u002f')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const escapeForHtmlAttribute = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Server-side resumable state collector. */
export interface ResumableState {
  /** Stash a JSON-serializable value under `key`. */
  set: (key: string, value: unknown) => void;
  /** Read a value back (server-side, useful for tests). */
  get: <T = unknown>(key: string) => T | undefined;
  /** All collected entries. */
  entries: () => Record<string, unknown>;
  /** Build the `<script>` tag to embed in HTML. */
  render: (options?: { nonce?: string; scriptId?: string; globalKey?: string }) => string;
}

/** Options for `createResumableState()`. */
export interface CreateResumableStateOptions {
  /** Initial entries. */
  initial?: Record<string, unknown>;
}

/**
 * Creates a server-side resumable state collector.
 *
 * @example
 * ```ts
 * const resume = createResumableState();
 * resume.set('user', { id: 1, name: 'Ada' });
 *
 * // Inject into HTML:
 * const tag = resume.render({ nonce: ctx.nonce });
 * ```
 */
export const createResumableState = (options: CreateResumableStateOptions = {}): ResumableState => {
  const data: Record<string, unknown> = Object.create(null);
  if (options.initial) {
    for (const [k, v] of Object.entries(options.initial)) {
      if (!isPrototypePollutionKey(k)) data[k] = v;
    }
  }
  return {
    set(key, value) {
      if (isPrototypePollutionKey(key)) return;
      data[key] = value;
    },
    get<T = unknown>(key: string): T | undefined {
      return data[key] as T | undefined;
    },
    entries() {
      return { ...data };
    },
    render(opts = {}) {
      const scriptId = opts.scriptId ?? '__BQUERY_RESUME__';
      const globalKey = opts.globalKey ?? '__BQUERY_RESUME__';
      if (isPrototypePollutionKey(scriptId) || isPrototypePollutionKey(globalKey)) {
        return '';
      }
      const json = JSON.stringify(data);
      const escapedJson = escapeForScript(json);
      const escapedKey = escapeForScript(JSON.stringify(globalKey));
      const escapedId = escapeForHtmlAttribute(scriptId);
      const nonceAttr = opts.nonce ? ` nonce="${escapeForHtmlAttribute(opts.nonce)}"` : '';
      return `<script id="${escapedId}"${nonceAttr}>window[${escapedKey}]=${escapedJson}</script>`;
    },
  };
};

/** Reader returned by `resumeState()`. */
export interface ResumeReader {
  /** Get a typed value from the resumable snapshot. */
  get: <T = unknown>(key: string) => T | undefined;
  /** Whether the snapshot was found. */
  hasSnapshot: boolean;
  /** All entries (read-only). */
  entries: () => Record<string, unknown>;
}

/**
 * Reads a previously-emitted resumable snapshot from `window` and cleans it
 * up. Safe to call in any environment; returns an empty reader when no
 * snapshot is present (server, tests, etc.).
 */
export const resumeState = (
  globalKey = '__BQUERY_RESUME__',
  scriptId = '__BQUERY_RESUME__'
): ResumeReader => {
  const empty: ResumeReader = {
    get: () => undefined,
    hasSnapshot: false,
    entries: () => ({}),
  };
  if (isPrototypePollutionKey(globalKey) || isPrototypePollutionKey(scriptId)) return empty;
  if (typeof window === 'undefined') return empty;
  const raw = (window as unknown as Record<string, unknown>)[globalKey];
  try {
    delete (window as unknown as Record<string, unknown>)[globalKey];
  } catch {
    (window as unknown as Record<string, unknown>)[globalKey] = undefined;
  }
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    const el = document.getElementById(scriptId);
    if (el) el.remove();
  }
  if (!raw || typeof raw !== 'object') return empty;
  const data = raw as Record<string, unknown>;
  return {
    hasSnapshot: true,
    get<T = unknown>(key: string): T | undefined {
      if (isPrototypePollutionKey(key)) return undefined;
      return data[key] as T | undefined;
    },
    entries() {
      return { ...data };
    },
  };
};
