/**
 * Async / streaming render entry points.
 *
 * Builds on top of the synchronous `renderToString()` and adds:
 * - `renderToStringAsync()` — awaits Promise/`defer()` values in the context.
 * - `renderToStream()` — emits the HTML as a Web `ReadableStream<Uint8Array>`.
 * - `renderToResponse()` — wraps the stream in a `Response` with sensible
 *   defaults (`Content-Type`, `Cache-Control`, ETag, head injection, store
 *   state injection).
 *
 * All three run on Bun, Deno and Node ≥ 24 without external dependencies.
 *
 * @module bquery/ssr
 */

import type { BindingContext } from '../view/types';
import { createSSRCache, type SSRCache } from './cache';
import { resolveContext } from './async';
import { createSSRContext, type SSRContext } from './context';
import { renderToString } from './render';
import { serializeStoreState } from './serialize';
import type { RenderOptions, SSRResult } from './types';

const FLUSH_BOUNDARY_MARKER = '<!--bq-flush-->';

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * HTML ASCII whitespace used between tag names and attributes. Includes form
 * feed (`\f`) because the HTML tokenizer treats it as whitespace alongside
 * spaces, tabs, CR and LF.
 */
const isHtmlWhitespace = (ch: string | undefined): boolean =>
  ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f';

const injectScriptNonce = (scriptTag: string, nonce: string): string => {
  const scriptPrefix = '<script';
  if (scriptTag.slice(0, scriptPrefix.length).toLowerCase() !== scriptPrefix) {
    return scriptTag;
  }

  const next = scriptTag[scriptPrefix.length];
  if (next !== '>' && !isHtmlWhitespace(next)) {
    return scriptTag;
  }

  return `<script nonce="${escapeAttr(nonce)}"${scriptTag.slice(scriptPrefix.length)}`;
};

/**
 * Options accepted by the async render APIs. Extends the base `RenderOptions`
 * with response-shaping switches.
 */
export interface AsyncRenderOptions extends RenderOptions {
  /** Pre-built SSR context. Created automatically if omitted. */
  context?: SSRContext;
  /**
   * Whether to inject the head manager output, asset manifest and store-state
   * `<script>` tag into the output HTML when the template contains
   * `</head>`/`</body>` markers. Default: `true`.
   */
  injectHead?: boolean;
  /**
   * Custom store-state script ID/global key forwarded to `serializeStoreState()`.
   */
  storeScriptId?: string;
  storeGlobalKey?: string;
}

/** Result of an async render call. */
export interface AsyncSSRResult extends SSRResult {
  /** SSR context that produced this result. */
  context: SSRContext;
  /** Aggregated head HTML (already injected when `injectHead` is true). */
  headHtml: string;
  /** Aggregated asset preload HTML (already injected when `injectHead` is true). */
  assetsHtml: string;
  /** `<script>` tag with serialized store state, if any. */
  storeScriptTag: string;
}

/**
 * Marks a manual stream flush boundary in an SSR template.
 */
export const flushBoundary = (): string => FLUSH_BOUNDARY_MARKER;

const injectIntoHead = (html: string, fragment: string): string => {
  if (!fragment) return html;
  const idx = html.toLowerCase().indexOf('</head>');
  if (idx === -1) return html;
  return html.slice(0, idx) + fragment + html.slice(idx);
};

const injectBeforeBodyEnd = (html: string, fragment: string): string => {
  if (!fragment) return html;
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return html;
  return html.slice(0, idx) + fragment + html.slice(idx);
};

const injectStreamFragments = (
  chunks: string[],
  headFragment: string,
  bodyFragment: string
): string[] => {
  if (!headFragment && !bodyFragment) {
    return chunks;
  }

  const output = [...chunks];

  if (headFragment) {
    const headChunkIndex = output.findIndex((chunk) => chunk.toLowerCase().includes('</head>'));
    if (headChunkIndex !== -1) {
      output[headChunkIndex] = injectIntoHead(output[headChunkIndex], headFragment);
    }
  }

  if (bodyFragment) {
    for (let index = output.length - 1; index >= 0; index--) {
      if (!output[index].toLowerCase().includes('</body>')) {
        continue;
      }
      output[index] = injectBeforeBodyEnd(output[index], bodyFragment);
      break;
    }
  }

  return output;
};

const mergeHeaderValues = (existingValue: string | null, nextValues: readonly string[]): string | null => {
  const merged = new Map<string, string>();

  const addValues = (values: readonly string[]): void => {
    for (const value of values) {
      const normalized = value.trim();
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, normalized);
      }
    }
  };

  if (existingValue) {
    addValues(existingValue.split(','));
  }
  addValues(nextValues);

  return merged.size > 0 ? [...merged.values()].join(', ') : null;
};

const renderResolvedToStringResult = (
  template: string,
  resolvedData: BindingContext,
  context: SSRContext,
  options: AsyncRenderOptions,
  startedAt = performance.now()
): AsyncSSRResult => {
  const baseOptions: RenderOptions = {
    prefix: options.prefix,
    stripDirectives: options.stripDirectives,
    includeStoreState: false,
    annotateHydration: options.annotateHydration,
  };

  let { html, storeState } = renderToString(template, resolvedData, baseOptions);

  const headHtml = context.head.render({ nonce: context.nonce });
  const assetsHtml = context.assets.render({ nonce: context.nonce });

  let storeScriptTag = '';
  if (options.includeStoreState) {
    const storeIds = Array.isArray(options.includeStoreState) ? options.includeStoreState : undefined;
    const result = serializeStoreState({
      storeIds,
      scriptId: options.storeScriptId,
      globalKey: options.storeGlobalKey,
    });
    storeState = result.stateJson;
    storeScriptTag = result.scriptTag;
    if (context.nonce) {
      storeScriptTag = injectScriptNonce(storeScriptTag, context.nonce);
    }
  }

  if (options.injectHead !== false) {
    html = injectIntoHead(html, headHtml + assetsHtml);
    html = injectBeforeBodyEnd(html, storeScriptTag);
  }

  context.metrics?.recordRender(performance.now() - startedAt);

  return {
    html,
    storeState,
    context,
    headHtml,
    assetsHtml,
    storeScriptTag,
  };
};

/**
 * Async-aware render. Resolves all `Promise`/`defer()` values in the context,
 * then delegates to `renderToString()` and applies head/asset/store-state
 * injection based on the SSR context.
 */
export const renderToStringAsync = async (
  template: string,
  data: BindingContext,
  options: AsyncRenderOptions = {}
): Promise<AsyncSSRResult> => {
  const startedAt = performance.now();
  const context = options.context ?? createSSRContext({ mode: 'string' });

  if (context.signal.aborted) {
    throw new DOMException('SSR render aborted', 'AbortError');
  }

  const resolvedData = await resolveContext(data, context);

  if (context.signal.aborted) {
    throw new DOMException('SSR render aborted', 'AbortError');
  }

  return renderResolvedToStringResult(template, resolvedData, context, options, startedAt);
};

const getEncoder = (): TextEncoder => {
  if (typeof TextEncoder === 'undefined') {
    throw new Error('bQuery SSR: TextEncoder is not available in this runtime.');
  }
  return new TextEncoder();
};

/**
 * Renders a template into a Web `ReadableStream<Uint8Array>`. The stream is
 * single-chunk for now (the HTML is fully resolved before flushing) but is
 * exposed as a stream so adapters can pipe it directly into Bun/Deno/Node
 * responses without buffering into memory twice.
 *
 * Future Suspense-style streaming patches will reuse the same return type.
 */
export const renderToStream = (
  template: string,
  data: BindingContext,
  options: AsyncRenderOptions = {}
): ReadableStream<Uint8Array> => {
  if (typeof ReadableStream === 'undefined') {
    throw new Error('bQuery SSR: ReadableStream is not available in this runtime.');
  }

  const encoder = getEncoder();
  const ctx = options.context ?? createSSRContext({ ...options, mode: 'stream' });
  const merged: AsyncRenderOptions = { ...options, context: ctx };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const onAbort = () => {
        try {
          controller.error(new DOMException('SSR stream aborted', 'AbortError'));
        } catch {
          /* already closed */
        }
      };
      if (ctx.signal.aborted) {
        onAbort();
        return;
      }
      ctx.signal.addEventListener('abort', onAbort, { once: true });

      try {
        if (template.includes(FLUSH_BOUNDARY_MARKER)) {
          const parts = template.split(FLUSH_BOUNDARY_MARKER);
          const chunks: string[] = [];
          let headHtml = '';
          let assetsHtml = '';
          let storeScriptTag = '';
          const resolvedData = await resolveContext(data, ctx);
          for (const part of parts) {
            if (!part) {
              continue;
            }
            if (ctx.signal.aborted) {
              throw new DOMException('SSR stream aborted', 'AbortError');
            }
            const result = renderResolvedToStringResult(part, resolvedData, ctx, {
              ...merged,
              injectHead: false,
            });
            headHtml = result.headHtml;
            assetsHtml = result.assetsHtml;
            storeScriptTag = result.storeScriptTag;
            if (result.html) {
              chunks.push(result.html);
            }
          }
          const renderedChunks =
            merged.injectHead === false
              ? chunks
              : injectStreamFragments(chunks, headHtml + assetsHtml, storeScriptTag);
          for (const chunk of renderedChunks) {
            controller.enqueue(encoder.encode(chunk));
          }
        } else {
          const result = await renderToStringAsync(template, data, merged);
          controller.enqueue(encoder.encode(result.html));
        }
        controller.close();
      } catch (error) {
        ctx.signal.removeEventListener('abort', onAbort);
        try {
          controller.error(error);
        } catch {
          /* already errored */
        }
      } finally {
        ctx.signal.removeEventListener('abort', onAbort);
      }
    },
  });
};

const computeWeakEtag = async (text: string): Promise<string | null> => {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) return null;
  try {
    const digest = await subtle.digest('SHA-1', getEncoder().encode(text));
    const bytes = new Uint8Array(digest);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return `W/"${hex.slice(0, 27)}"`;
  } catch {
    return null;
  }
};

/** Options for `renderToResponse()`. */
export interface RenderToResponseCacheOptions {
  /** Cache-Control s-maxage in seconds. */
  sMaxAge?: number;
  /** Cache-Control stale-while-revalidate in seconds. */
  staleWhileRevalidate?: number;
  /** Cache-Control stale-if-error in seconds. */
  staleIfError?: number;
  /** Vary header names that participate in caching. */
  vary?: string[];
}

export interface RenderToResponseOptions extends AsyncRenderOptions {
  /** Override the response status code. */
  status?: number;
  /** Override the `Content-Type` header. Default: `text/html; charset=utf-8`. */
  contentType?: string;
  /** Set a `Cache-Control` header value. */
  cacheControl?: string;
  /** Whether to compute a weak ETag from the rendered HTML. Default: `false`. */
  etag?: boolean;
  /** Extra headers merged into the response. */
  headers?: HeadersInit;
  /** Cache-Control shaping and optional in-memory cache integration. */
  cache?:
    | RenderToResponseCacheOptions
    | (RenderToResponseCacheOptions & {
        store: SSRCache;
      });
}

const applyCacheHeaders = (headers: Headers, cacheOptions: RenderToResponseCacheOptions): void => {
  const directives: string[] = [];
  if (typeof cacheOptions.sMaxAge === 'number' && cacheOptions.sMaxAge >= 0) {
    directives.push(`s-maxage=${Math.trunc(cacheOptions.sMaxAge)}`);
  }
  if (
    typeof cacheOptions.staleWhileRevalidate === 'number' &&
    cacheOptions.staleWhileRevalidate >= 0
  ) {
    directives.push(
      `stale-while-revalidate=${Math.trunc(cacheOptions.staleWhileRevalidate)}`
    );
  }
  if (typeof cacheOptions.staleIfError === 'number' && cacheOptions.staleIfError >= 0) {
    directives.push(`stale-if-error=${Math.trunc(cacheOptions.staleIfError)}`);
  }
  if (directives.length > 0) {
    if (!headers.has('cache-control')) {
      headers.set('cache-control', directives.join(', '));
    }
  }
  if (cacheOptions.vary && cacheOptions.vary.length > 0) {
    const vary = mergeHeaderValues(headers.get('vary'), cacheOptions.vary);
    if (vary) {
      headers.set('vary', vary);
    }
  }
};

/**
 * Renders a template and returns a `Response` ready to be returned from a
 * `fetch`-style handler (`Bun.serve`, `Deno.serve`, Hono, Elysia, etc.).
 *
 * Honours `SSRContext.signal` for cancellation and `SSRContext.responseHeaders`
 * for headers added during the render path.
 */
export const renderToResponse = async (
  template: string,
  data: BindingContext,
  options: RenderToResponseOptions = {}
): Promise<Response> => {
  const ctx = options.context ?? createSSRContext({ ...options, mode: 'string' });
  const cacheStore =
    options.cache && 'store' in options.cache ? options.cache.store : undefined;
  const cacheKey =
    cacheStore && options.cache
      ? cacheStore.getKey({
          headers: ctx.headers,
          url: ctx.url,
          vary: options.cache.vary,
        })
      : '';

  if (cacheStore && cacheKey) {
    const cached = cacheStore.get(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        headers: new Headers(cached.headers),
        status: cached.status,
      });
    }
  }

  const merged: AsyncRenderOptions = { ...options, context: ctx };
  const result = await renderToStringAsync(template, data, merged);
  const status = options.status ?? ctx.status ?? 200;

  const headers = new Headers(options.headers);
  for (const [k, v] of ctx.responseHeaders) headers.append(k, v);
  if (!headers.has('content-type')) {
    headers.set('content-type', options.contentType ?? 'text/html; charset=utf-8');
  }
  if (options.cacheControl) headers.set('cache-control', options.cacheControl);
  if (options.cache) {
    applyCacheHeaders(headers, options.cache);
  }

  if (options.etag) {
    const etag = await computeWeakEtag(result.html);
    if (etag) {
      headers.set('etag', etag);
      const ifNoneMatch = ctx.headers.get('if-none-match');
      if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers });
      }
    }
  }

  const response = new Response(result.html, { status, headers });
  if (cacheStore && cacheKey && response.ok) {
    cacheStore.set(cacheKey, {
      body: result.html,
      createdAt: Date.now(),
      headers: [...headers.entries()],
      status,
    });
  }
  return response;
};

export { createSSRCache };
