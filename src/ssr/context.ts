/**
 * Server-side rendering context.
 *
 * Encapsulates everything a render path may need to know about the incoming
 * request and to produce response-side metadata (head tags, asset hints,
 * nonces, etc.). The context is propagated explicitly through the public
 * async APIs (`renderToStringAsync`, `renderToStream`, `renderToResponse`)
 * and is available to template loaders.
 *
 * @module bquery/ssr
 */

import { generateNonce } from '../security/csp';
import { isPrototypePollutionKey } from '../core/utils/object';
import { createAssetManager, createHeadManager, type AssetManager, type HeadManager } from './head';

/** Options for `createSSRContext()`. */
export interface CreateSSRContextOptions {
  /** Pre-built request to use as the source of URL/headers/cookies/etc. */
  request?: Request;
  /** Override the URL (defaults to `request.url` or `'http://localhost/'`). */
  url?: string | URL;
  /** Override the user agent string. */
  userAgent?: string;
  /** Override the request locale; defaults to `Accept-Language` parsing. */
  locale?: string;
  /** Provide an `AbortSignal` for cancellation. Default: `request.signal`. */
  signal?: AbortSignal;
  /** Pre-computed CSP nonce. If omitted and `crypto.getRandomValues` exists, a fresh nonce is generated. */
  nonce?: string;
  /** Render mode hint — used by streaming/string renderers for diagnostics. */
  mode?: 'string' | 'stream';
  /** Optional error sink invoked for non-fatal render errors. */
  onError?: (error: unknown) => void;
}

/** Public SSR context shape. */
export interface SSRContext {
  /** The originating `Request` (may be a synthetic one if none was provided). */
  request: Request;
  /** Parsed URL of the request. */
  url: URL;
  /** Request headers (via `Request.headers`). */
  headers: Headers;
  /** Resolved cookie map from `Cookie` header. */
  cookies: Record<string, string>;
  /** Best-effort user agent string. */
  userAgent: string;
  /** Best-effort locale parsed from `Accept-Language`. */
  locale: string;
  /** Cancellation signal — render paths must respect it. */
  signal: AbortSignal;
  /** CSP nonce applied to all generated `<script>` tags. */
  nonce: string;
  /** Render mode hint. */
  mode: 'string' | 'stream';
  /** Head manager — call `head.add(...)`, `head.render()`, or read `head.state()`. */
  head: HeadManager;
  /** Asset manifest — call `assets.preload()`/`module()`/`style()`. */
  assets: AssetManager;
  /** Status code suggested by render paths (loaders, error boundaries). */
  status: number;
  /** Outgoing response headers (used by `renderToResponse()`). */
  responseHeaders: Headers;
  /** Reports a non-fatal error. */
  reportError(error: unknown): void;
}

const parseCookies = (header: string): Record<string, string> => {
  const out = Object.create(null) as Record<string, string>;
  if (!header) return out;
  for (const pair of header.split(/;\s*/)) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!name || isPrototypePollutionKey(name)) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
};

const parseLocale = (acceptLanguage: string | null): string => {
  if (!acceptLanguage) return 'en';
  // Pick the highest-quality entry. Header parsing is intentionally minimal.
  const entries = acceptLanguage
    .split(',')
    .map((entry) => {
      const [tag, ...params] = entry.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.split('=')[1]) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((e) => e.tag);
  if (!entries.length) return 'en';
  entries.sort((a, b) => b.q - a.q);
  return entries[0].tag;
};

const safeNonce = (): string => {
  try {
    return generateNonce();
  } catch {
    // Runtime lacks `crypto.getRandomValues` / `btoa` — fall back to empty.
    return '';
  }
};

const createHeadersFallback = (): Headers => {
  const store = new Map<string, string[]>();
  const api = {
    append(name: string, value: string): void {
      const key = String(name).toLowerCase();
      const existing = store.get(key);
      if (existing) existing.push(String(value));
      else store.set(key, [String(value)]);
    },
    delete(name: string): void {
      store.delete(String(name).toLowerCase());
    },
    get(name: string): string | null {
      const values = store.get(String(name).toLowerCase());
      return values ? values.join(', ') : null;
    },
    has(name: string): boolean {
      return store.has(String(name).toLowerCase());
    },
    set(name: string, value: string): void {
      store.set(String(name).toLowerCase(), [String(value)]);
    },
    forEach(
      callback: (value: string, key: string, parent: Headers) => void,
      thisArg?: unknown
    ): void {
      for (const [key, values] of store) {
        callback.call(thisArg, values.join(', '), key, api as unknown as Headers);
      }
    },
    *entries(): IterableIterator<[string, string]> {
      for (const [key, values] of store) {
        yield [key, values.join(', ')];
      }
    },
    [Symbol.iterator](): IterableIterator<[string, string]> {
      return api.entries();
    },
  };
  return api as unknown as Headers;
};

const createAbortSignalFallback = (): AbortSignal =>
  ({
    aborted: false,
    onabort: null,
    reason: undefined,
    addEventListener() {
      /* no-op */
    },
    removeEventListener() {
      /* no-op */
    },
    dispatchEvent() {
      return false;
    },
    throwIfAborted() {
      /* no-op */
    },
  }) as unknown as AbortSignal;

const hasHeadersApi = (value: unknown): value is Headers =>
  typeof value === 'object' && value !== null && typeof (value as Headers).get === 'function';

const hasAbortSignalApi = (value: unknown): value is AbortSignal =>
  typeof value === 'object' && value !== null && typeof (value as AbortSignal).aborted === 'boolean';

const createHeadersLike = (): Headers =>
  typeof Headers === 'function' ? new Headers() : createHeadersFallback();

/**
 * Creates a fully populated SSR context.
 *
 * @example
 * ```ts
 * const ctx = createSSRContext({ request });
 * const { html } = await renderToStringAsync(template, data, { context: ctx });
 * ```
 */
export const createSSRContext = (options: CreateSSRContextOptions = {}): SSRContext => {
  // SSRContext relies on Web `Request`/`Headers`/`AbortSignal`. All target
  // runtimes (Node ≥ 24, Deno, Bun, browsers) provide these natively. The
  // structural fallback below only exists so the helper does not throw in
  // exotic embedded runtimes; downstream code that expects real `Request`
  // methods should ensure the runtime ships them.
  const fallbackRequestUrl =
    options.url instanceof URL
      ? options.url.toString()
      : typeof options.url === 'string'
        ? new URL(options.url, 'http://localhost/').toString()
        : 'http://localhost/';
  const request =
    options.request ??
    (typeof Request === 'function'
      ? new Request(fallbackRequestUrl)
      : ({
          url: fallbackRequestUrl,
          headers: createHeadersFallback(),
          signal: createAbortSignalFallback(),
        } as unknown as Request));

  const urlSource = options.url ?? request.url;
  const url =
    urlSource instanceof URL ? urlSource : new URL(String(urlSource), 'http://localhost/');

  const headers = hasHeadersApi(request.headers) ? request.headers : createHeadersLike();
  const cookies = parseCookies(headers.get('cookie') ?? '');
  const userAgent = options.userAgent ?? headers.get('user-agent') ?? '';
  const locale = options.locale ?? parseLocale(headers.get('accept-language'));
  const signal = options.signal ?? (hasAbortSignalApi(request.signal) ? request.signal : createAbortSignalFallback());
  const nonce = options.nonce ?? safeNonce();

  const ctx: SSRContext = {
    request,
    url,
    headers,
    cookies,
    userAgent,
    locale,
    signal,
    nonce,
    mode: options.mode ?? 'string',
    head: createHeadManager(),
    assets: createAssetManager(),
    status: 200,
    responseHeaders: createHeadersLike(),
    reportError(error) {
      options.onError?.(error);
    },
  };

  return ctx;
};
