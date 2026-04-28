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
import { resolveContext } from './async';
import { createSSRContext, type SSRContext } from './context';
import { renderToString } from './render';
import { serializeStoreState } from './serialize';
import type { RenderOptions, SSRResult } from './types';

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

const injectIntoHead = (html: string, fragment: string): string => {
  if (!fragment) return html;
  const idx = html.toLowerCase().indexOf('</head>');
  if (idx === -1) return fragment + html;
  return html.slice(0, idx) + fragment + html.slice(idx);
};

const injectBeforeBodyEnd = (html: string, fragment: string): string => {
  if (!fragment) return html;
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return html + fragment;
  return html.slice(0, idx) + fragment + html.slice(idx);
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
  const context = options.context ?? createSSRContext({ mode: 'string' });

  if (context.signal.aborted) {
    throw new DOMException('SSR render aborted', 'AbortError');
  }

  const resolvedData = await resolveContext(data, context);

  if (context.signal.aborted) {
    throw new DOMException('SSR render aborted', 'AbortError');
  }

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
    const storeIds = Array.isArray(options.includeStoreState)
      ? options.includeStoreState
      : undefined;
    const result = serializeStoreState({
      storeIds,
      scriptId: options.storeScriptId,
      globalKey: options.storeGlobalKey,
    });
    storeState = result.stateJson;
    storeScriptTag = result.scriptTag;
    if (context.nonce) {
      // Inject nonce into the script tag.
      storeScriptTag = injectScriptNonce(storeScriptTag, context.nonce);
    }
  }

  if (options.injectHead !== false) {
    html = injectIntoHead(html, headHtml + assetsHtml);
    html = injectBeforeBodyEnd(html, storeScriptTag);
  }

  return {
    html,
    storeState,
    context,
    headHtml,
    assetsHtml,
    storeScriptTag,
  };
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
        const result = await renderToStringAsync(template, data, merged);
        controller.enqueue(encoder.encode(result.html));
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
}

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
  const merged: AsyncRenderOptions = { ...options, context: ctx };
  const result = await renderToStringAsync(template, data, merged);
  const status = options.status ?? ctx.status ?? 200;

  const headers = new Headers(options.headers);
  for (const [k, v] of ctx.responseHeaders) headers.append(k, v);
  if (!headers.has('content-type')) {
    headers.set('content-type', options.contentType ?? 'text/html; charset=utf-8');
  }
  if (options.cacheControl) headers.set('cache-control', options.cacheControl);

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

  return new Response(result.html, { status, headers });
};
