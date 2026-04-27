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
}

/** Minimal subset of `node:http` ServerResponse we rely on. */
export interface NodeServerResponse {
  statusCode: number;
  setHeader(name: string, value: string | number | readonly string[]): void;
  write(chunk: Uint8Array | string): boolean;
  end(chunk?: Uint8Array | string): void;
}

const shouldReadNodeBody = (method: string): boolean => method !== 'GET' && method !== 'HEAD';

const readNodeBody = (req: NodeIncomingMessage): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk) => {
      chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
    });
    req.on('end', () => {
      let total = 0;
      for (const chunk of chunks) total += chunk.byteLength;
      const buffer = new ArrayBuffer(total);
      const body = new Uint8Array(buffer);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(buffer);
    });
    req.on('error', reject);
  });

const buildRequestFromNode = async (req: NodeIncomingMessage): Promise<Request> => {
  // Only honour `x-forwarded-proto` when it advertises a known protocol.
  // This adapter assumes deployment behind a trusted reverse proxy; callers
  // exposing `node:http` directly to the public internet should strip
  // `x-forwarded-*` headers in their proxy layer.
  const forwardedProto =
    typeof req.headers['x-forwarded-proto'] === 'string'
      ? (req.headers['x-forwarded-proto'] as string).split(',')[0].trim().toLowerCase()
      : '';
  const protocol =
    forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : 'http';
  const host = (typeof req.headers.host === 'string' && req.headers.host) || 'localhost';
  const url = new URL(req.url ?? '/', `${protocol}://${host}`);

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
    init.body = await readNodeBody(req);
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
  handler: SSRRequestHandler
): ((req: NodeIncomingMessage, res: NodeServerResponse) => Promise<void>) => {
  return async (req, res) => {
    const request = await buildRequestFromNode(req);
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
