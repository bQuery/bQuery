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

/* ---------------------------------------------------------------------------
 * Web (generic fetch) adapter
 * ------------------------------------------------------------------------- */

/**
 * Identity adapter for Web-`fetch` style hosts (Hono, Elysia, Workerd, edge
 * runtimes). Exists for symmetry and future logging hooks.
 */
export const createWebHandler = (handler: SSRRequestHandler): SSRRequestHandler => handler;

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
}

/** Minimal subset of `node:http` ServerResponse we rely on. */
export interface NodeServerResponse {
  statusCode: number;
  setHeader(name: string, value: string | number | readonly string[]): void;
  write(chunk: Uint8Array | string): boolean;
  end(chunk?: Uint8Array | string): void;
}

/** Optional hardening settings for the `node:http` adapter. */
export interface NodeHandlerOptions {
  /** Reject request bodies that exceed this many bytes. Default: unlimited. */
  maxBodyBytes?: number;
}

const shouldReadNodeBody = (method: string): boolean => method !== 'GET' && method !== 'HEAD';

class NodeRequestLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeRequestLimitError';
  }
}

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

const readNodeBody = (req: NodeIncomingMessage, maxBodyBytes?: number): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let done = false;
    const fail = (error: unknown): void => {
      if (done) return;
      done = true;
      chunks.length = 0;
      total = 0;
      req.destroy?.(error instanceof Error ? error : undefined);
      reject(error);
    };

    const declaredLength = getContentLength(req);
    if (maxBodyBytes !== undefined && declaredLength !== null && declaredLength > maxBodyBytes) {
      fail(new NodeRequestLimitError(`Request body exceeds ${maxBodyBytes} bytes.`));
      return;
    }

    req.on('data', (chunk) => {
      if (done) return;
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      total += bytes.byteLength;
      if (maxBodyBytes !== undefined && total > maxBodyBytes) {
        fail(new NodeRequestLimitError(`Request body exceeds ${maxBodyBytes} bytes.`));
        return;
      }
      chunks.push(bytes);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      const buffer = new ArrayBuffer(total);
      const body = new Uint8Array(buffer);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(buffer);
    });
    req.on('error', fail);
  });

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
  options: NodeHandlerOptions = {}
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

  if (shouldReadNodeBody(upperMethod)) {
    init.body = await readNodeBody(req, options.maxBodyBytes);
  }

  return new Request(url.toString(), init);
};

const writeResponseToNode = async (response: Response, res: NodeServerResponse): Promise<void> => {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) res.write(value);
  }
  res.end();
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
    let request: Request;
    try {
      request = await buildRequestFromNode(req, options);
    } catch (error) {
      if (error instanceof NodeRequestLimitError) {
        await writeResponseToNode(new Response(error.message, { status: 413 }), res);
        return;
      }
      throw error;
    }
    const response = await Promise.resolve(handler(request));
    await writeResponseToNode(response, res);
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
