/**
 * Runtime adapters for SSR.
 *
 * Provide thin glue functions that turn a bQuery render handler into a
 * runtime-native server callback. They share a common signature so the same
 * application can be served by Bun, Deno, Node and any Web-`fetch` host.
 *
 * @module bquery/ssr
 */

import type { SSRContext } from './context';
import { detectRuntime } from './runtime';

/** A handler that turns a request into a Response (Web-fetch style). */
export type SSRRequestHandler = (
  request: Request,
  context?: SSRContext
) => Promise<Response> | Response;

export interface EdgeHandlerOptions {
  /** Optional error mapper for fetch-style edge runtimes. */
  onError?: (error: unknown, request: Request) => Promise<Response> | Response;
}

/* ---------------------------------------------------------------------------
 * Web (generic fetch) adapter
 * ------------------------------------------------------------------------- */

/**
 * Identity adapter for Web-`fetch` style hosts (Hono, Elysia, Workerd, edge
 * runtimes). Exists for symmetry and future logging hooks.
 */
export const createWebHandler = (handler: SSRRequestHandler): SSRRequestHandler => handler;

/**
 * Wraps a fetch-style handler for edge runtimes with optional error handling.
 */
export const createEdgeHandler = (
  handler: SSRRequestHandler,
  options: EdgeHandlerOptions = {}
): SSRRequestHandler => {
  return async (request, context) => {
    try {
      return await Promise.resolve(handler(request, context));
    } catch (error) {
      if (options.onError) {
        return await Promise.resolve(options.onError(error, request));
      }
      throw error;
    }
  };
};

/* ---------------------------------------------------------------------------
 * Bun adapter
 * ------------------------------------------------------------------------- */

/**
 * Wraps a handler for `Bun.serve()`. Returns a function with Bun's expected
 * signature `(request, server) => Response | Promise<Response>`.
 */
export const createBunHandler = (
  handler: SSRRequestHandler
): ((request: Request) => Promise<Response>) => {
  return async (request) => Promise.resolve(handler(request));
};

/* ---------------------------------------------------------------------------
 * Deno adapter
 * ------------------------------------------------------------------------- */

/**
 * Wraps a handler for `Deno.serve()`. Returns a function with Deno's expected
 * signature `(request, info?) => Response | Promise<Response>`.
 */
export const createDenoHandler = (
  handler: SSRRequestHandler
): ((request: Request) => Promise<Response>) => {
  return async (request) => Promise.resolve(handler(request));
};

/* ---------------------------------------------------------------------------
 * Node adapter (`node:http`)
 * ------------------------------------------------------------------------- */

/** Minimal subset of `node:http` IncomingMessage we rely on. */
export interface NodeIncomingMessage {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', listener: (chunk: Uint8Array | string) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (err: unknown) => void): void;
  destroy?(error?: Error): void;
  /** Stop emitting `data` events (backpressure). */
  pause?(): void;
  /** Resume emitting `data` events. */
  resume?(): void;
}

/** Minimal subset of `node:http` ServerResponse we rely on. */
export interface NodeServerResponse {
  statusCode: number;
  setHeader(name: string, value: string | number | readonly string[]): void;
  write(chunk: Uint8Array | string): boolean;
  end(chunk?: Uint8Array | string): void;
  once?(event: 'drain' | 'error' | 'close', listener: (error?: unknown) => void): void;
  on?(event: 'drain' | 'error' | 'close', listener: (error?: unknown) => void): void;
  removeListener?(event: 'drain' | 'error' | 'close', listener: (error?: unknown) => void): void;
  /** Whether the status line and headers were already sent. */
  headersSent?: boolean;
  /** Whether every chunk was flushed to the socket after `end()`. */
  writableFinished?: boolean;
  destroy?(error?: Error): void;
  getHeaderNames?(): string[];
  removeHeader?(name: string): void;
}

/** Optional hardening settings for the `node:http` adapter. */
export interface NodeHandlerOptions {
  /**
   * Reject request bodies that exceed this many bytes. A larger declared
   * `Content-Length` is answered with `413` before the handler runs; a
   * chunked body that grows past the limit errors the body stream and destroys
   * the connection. Default: unlimited.
   *
   * The body is streamed to the handler on demand, so a route that never reads
   * it never buffers it.
   */
  maxBodyBytes?: number;
}

const shouldReadNodeBody = (method: string): boolean => method !== 'GET' && method !== 'HEAD';

/**
 * Raised by the Node adapter when a request body exceeds `maxBodyBytes`.
 *
 * @internal
 */
export class NodeRequestLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeRequestLimitError';
  }
}

/**
 * Whether `error` (or its `cause`, as `Request#arrayBuffer()` may wrap a stream
 * error) is a {@link NodeRequestLimitError}.
 *
 * @internal
 */
export const isNodeRequestLimitError = (error: unknown): error is Error => {
  if (error instanceof NodeRequestLimitError) return true;
  const cause = (error as { cause?: unknown } | null)?.cause;
  return cause instanceof NodeRequestLimitError;
};

const getSingleHeader = (
  headers: NodeIncomingMessage['headers'],
  name: string
): string | undefined => {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
};

const getContentLength = (req: NodeIncomingMessage): number | null => {
  const header = getSingleHeader(req.headers, 'content-length');
  if (!header) return null;
  const value = Number.parseInt(header, 10);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

/**
 * Expose the Node request body as a `ReadableStream` that only starts reading
 * when the handler pulls from it. Nothing is buffered up front, and
 * `pause()`/`resume()` carry backpressure through to the socket.
 */
const createNodeBodyStream = (
  req: NodeIncomingMessage,
  maxBodyBytes?: number
): ReadableStream<Uint8Array> => {
  let attached = false;
  let done = false;
  let total = 0;

  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (attached) {
          req.resume?.();
          return;
        }
        attached = true;
        req.on('data', (chunk) => {
          if (done) return;
          const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
          total += bytes.byteLength;
          if (maxBodyBytes !== undefined && total > maxBodyBytes) {
            done = true;
            const error = new NodeRequestLimitError(`Request body exceeds ${maxBodyBytes} bytes.`);
            req.destroy?.(error);
            controller.error(error);
            return;
          }
          controller.enqueue(bytes);
          if ((controller.desiredSize ?? 0) <= 0) req.pause?.();
        });
        req.on('end', () => {
          if (done) return;
          done = true;
          controller.close();
        });
        req.on('error', (error) => {
          if (done) return;
          done = true;
          controller.error(error);
        });
      },
      cancel() {
        // Discard the rest instead of destroying the socket, so the response
        // (often a 413 from a route-level limit) can still be delivered.
        done = true;
        req.resume?.();
      },
    },
    { highWaterMark: 0 }
  );
};

const buildNodeUrl = (req: NodeIncomingMessage, protocol: string): URL => {
  const fallbackOrigin = `${protocol}://localhost`;
  const host = getSingleHeader(req.headers, 'host') || 'localhost';
  try {
    return new URL(req.url ?? '/', `${protocol}://${host}`);
  } catch {
    try {
      return new URL(req.url ?? '/', fallbackOrigin);
    } catch {
      return new URL('/', fallbackOrigin);
    }
  }
};

const buildRequestFromNode = async (
  req: NodeIncomingMessage,
  options: NodeHandlerOptions = {},
  signal?: AbortSignal
): Promise<Request> => {
  // Only honour `x-forwarded-proto` when it advertises a known protocol.
  // This adapter assumes deployment behind a trusted reverse proxy; callers
  // exposing `node:http` directly to the public internet should strip
  // `x-forwarded-*` headers in their proxy layer.
  const forwardedProto =
    typeof getSingleHeader(req.headers, 'x-forwarded-proto') === 'string'
      ? (getSingleHeader(req.headers, 'x-forwarded-proto') as string)
          .split(',')[0]
          .trim()
          .toLowerCase()
      : '';
  const protocol =
    forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : 'http';
  const url = buildNodeUrl(req, protocol);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v);
    } else {
      headers.append(name, value);
    }
  }

  const upperMethod = (req.method ?? 'GET').toUpperCase();
  const init: RequestInit = {
    method: upperMethod,
    headers,
  };
  // Lets handlers (and `ctx.sse()` / streaming renders) notice that the
  // client went away and stop producing work nobody will receive.
  if (signal) init.signal = signal;

  if (shouldReadNodeBody(upperMethod)) {
    const { maxBodyBytes } = options;
    const declaredLength = getContentLength(req);
    if (maxBodyBytes !== undefined && declaredLength !== null && declaredLength > maxBodyBytes) {
      const error = new NodeRequestLimitError(`Request body exceeds ${maxBodyBytes} bytes.`);
      req.destroy?.(error);
      throw error;
    }
    if (declaredLength !== 0) {
      init.body = createNodeBodyStream(req, maxBodyBytes);
      // Required by undici (Node's fetch) for a streamed request body.
      (init as RequestInit & { duplex: 'half' }).duplex = 'half';
    }
  }

  return new Request(url.toString(), init);
};

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

const getSetCookieHeaderValues = (headers: Headers): string[] => {
  const setCookies = (headers as HeadersWithSetCookie).getSetCookie?.();
  if (Array.isArray(setCookies) && setCookies.length > 0) {
    return setCookies;
  }
  const fallback = headers.get('set-cookie');
  return fallback ? [fallback] : [];
};

/**
 * Wait for `drain` — or for the client to disconnect. A closed socket never
 * drains, so waiting for `drain` alone parked the write loop forever and the
 * response stream was never cancelled (an SSE iterator kept running, and its
 * subscriptions leaked, for every client that went away).
 */
const waitForNodeDrain = (res: NodeServerResponse, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const once = typeof res.once === 'function' ? res.once.bind(res) : undefined;
    const on = typeof res.on === 'function' ? res.on.bind(res) : undefined;
    const subscribe = once ?? on;
    if (!subscribe || signal.aborted) {
      resolve();
      return;
    }
    const cleanup = (): void => {
      res.removeListener?.('drain', onDrain);
      res.removeListener?.('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onDrain = (): void => {
      cleanup();
      resolve();
    };
    const onAbort = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error?: unknown): void => {
      cleanup();
      reject(
        error instanceof Error ? error : new Error('Node response stream errored while draining.')
      );
    };
    subscribe('drain', onDrain);
    subscribe('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
  });

/**
 * An `AbortSignal` that fires when the client disconnects before the
 * response finished.
 */
const trackNodeDisconnect = (res: NodeServerResponse): AbortSignal => {
  const controller = new AbortController();
  const subscribe =
    typeof res.once === 'function'
      ? res.once.bind(res)
      : typeof res.on === 'function'
        ? res.on.bind(res)
        : undefined;
  subscribe?.('close', () => {
    if (res.writableFinished !== true) {
      controller.abort(new DOMException('The client disconnected.', 'AbortError'));
    }
  });
  return controller.signal;
};

/**
 * Last-resort handling for an error escaping the handler. The adapter's
 * promise is returned to `node:http`, which never awaits it, so a rejection
 * became an unhandled rejection — and Node terminates the process on those
 * by default, turning one throwing request into an outage.
 */
const failNodeResponse = (res: NodeServerResponse, error: unknown, signal?: AbortSignal): void => {
  if (signal?.aborted) {
    // The client already went away; an abort surfacing from the handler is
    // expected, not a server fault worth logging or answering.
    res.destroy?.();
    return;
  }
  console.error('bQuery ssr: unhandled error in Node request handler', error);
  try {
    if (res.headersSent) {
      // Too late for a status code; cut the connection so the client does not
      // mistake a truncated body for a complete one.
      res.destroy?.(error instanceof Error ? error : undefined);
      return;
    }
    // Headers copied from the failed Response (set-cookie, cache-control,
    // content-length, ...) must not leak onto the 500.
    if (typeof res.getHeaderNames === 'function' && typeof res.removeHeader === 'function') {
      for (const name of res.getHeaderNames()) res.removeHeader(name);
    }
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Internal Server Error');
  } catch {
    res.destroy?.();
  }
};

const writeResponseToNode = async (
  response: Response,
  res: NodeServerResponse,
  signal: AbortSignal = new AbortController().signal
): Promise<void> => {
  res.statusCode = response.status;
  const setCookies = getSetCookieHeaderValues(response.headers);
  if (setCookies.length > 0) {
    res.setHeader('set-cookie', setCookies.length === 1 ? setCookies[0] : setCookies);
  }
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === 'set-cookie') return;
    res.setHeader(name, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  // Cancelling the reader resolves a pending `read()` and propagates to the
  // body's source, which is how a streamed render or SSE iterator learns to
  // stop.
  const cancel = (): void => {
    reader.cancel(signal.reason).catch(() => undefined);
  };
  if (signal.aborted) {
    cancel();
    return;
  }
  signal.addEventListener('abort', cancel, { once: true });
  let completed = false;
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) {
        completed = true;
        break;
      }
      if (value && !res.write(value)) {
        await waitForNodeDrain(res, signal);
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    // A write error (or a disconnect) left the source mid-stream; release it.
    if (!completed) cancel();
  }
  if (completed) res.end();
};

/**
 * Wraps a handler so it can be passed directly to a `node:http` server.
 *
 * @example
 * ```ts
 * import { createServer } from 'node:http';
 * import { createNodeHandler, renderToResponse } from '@bquery/bquery/ssr';
 *
 * const handler = createNodeHandler(async (request) => {
 *   return renderToResponse('<div bq-text="msg"></div>', { msg: 'Hello' });
 * });
 *
 * createServer(handler).listen(3000);
 * ```
 */
export const createNodeHandler = (
  handler: SSRRequestHandler,
  options: NodeHandlerOptions = {}
): ((req: NodeIncomingMessage, res: NodeServerResponse) => Promise<void>) => {
  return async (req, res) => {
    const signal = trackNodeDisconnect(res);
    try {
      let request: Request;
      try {
        request = await buildRequestFromNode(req, options, signal);
      } catch (error) {
        if (error instanceof NodeRequestLimitError) {
          await writeResponseToNode(new Response(error.message, { status: 413 }), res, signal);
          return;
        }
        throw error;
      }
      let response: Response;
      try {
        response = await Promise.resolve(handler(request));
      } catch (error) {
        // A chunked body outgrew `maxBodyBytes` while the handler read it.
        if (isNodeRequestLimitError(error) && !res.headersSent) {
          const limitError = error instanceof NodeRequestLimitError ? error : error.cause;
          response = new Response((limitError as Error).message, { status: 413 });
        } else {
          throw error;
        }
      }
      await writeResponseToNode(response, res, signal);
    } catch (error) {
      // Never let the returned promise reject: `node:http` ignores it, so a
      // rejection is an unhandled rejection that terminates the process.
      failNodeResponse(res, error, signal);
    }
  };
};

/* ---------------------------------------------------------------------------
 * Auto-detection
 * ------------------------------------------------------------------------- */

/**
 * Convenience helper that picks the right adapter based on the current
 * runtime. Returns the same handler unchanged for Web/Bun/Deno (they share a
 * fetch-style signature). On Node it returns the `node:http` adapter.
 */
export const createSSRHandler = (
  handler: SSRRequestHandler
): SSRRequestHandler | ((req: NodeIncomingMessage, res: NodeServerResponse) => Promise<void>) => {
  const runtime = detectRuntime();
  switch (runtime) {
    case 'node':
      return createNodeHandler(handler);
    case 'bun':
      return createBunHandler(handler);
    case 'deno':
      return createDenoHandler(handler);
    default:
      return createWebHandler(handler);
  }
};
