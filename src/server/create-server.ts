import { isPrototypePollutionKey } from '../core/utils/object';
import { sanitizeHtml } from '../security/index';
import { callWorkerMethod, runTask } from '../concurrency/index';
import {
  createNodeHandler,
  detectRuntime,
  renderToResponse,
  renderToStream,
  renderToString,
  serializeStoreState,
} from '../ssr/index';
import { ServerHttpError } from './errors';
import type {
  CreateServerOptions,
  ServerApp,
  ServerCookieOptions,
  ServerContext,
  ServerHandler,
  ServerHtmlResponseInit,
  ServerListenHandle,
  ServerListenOptions,
  ServerMiddleware,
  ServerNext,
  ServerQuery,
  ServerRenderResponseOptions,
  ServerResult,
  ServerRequestInit,
  ServerResponseInit,
  ServerRoute,
  ServerSseEvent,
  ServerSseOptions,
  ServerWebSocketConnection,
  ServerWebSocketHandlerSet,
  ServerWebSocketMiddleware,
  ServerWebSocketNext,
  ServerWebSocketPeer,
  ServerWebSocketRouteHandler,
  ServerWebSocketSession,
} from './types';

interface CompiledRoute {
  handler: ServerHandler;
  methods: Set<string> | null;
  middlewares: ServerMiddleware[];
  paramNames: string[];
  path: string;
  pattern: RegExp;
}

type CompiledWebSocketRoute = Omit<CompiledRoute, 'handler' | 'middlewares'> & {
  handler: ServerWebSocketRouteHandler<unknown>;
  middlewares: ServerWebSocketMiddleware[];
};

type PipelineHandler = (context: ServerContext, next: ServerNext) => Response | Promise<Response>;
type WebSocketPipelineHandler = (
  context: ServerContext,
  next: ServerWebSocketNext
) => ServerResult | Promise<ServerResult>;

const DEFAULT_BASE_URL = 'http://localhost';
const JSON_ESCAPE_LOOKUP: Record<string, string> = {
  '<': '\\u003C',
  '>': '\\u003E',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};
const JSON_ESCAPE_PATTERN = /[<>&\u2028\u2029]/g;
const METHOD_ALL = null;
const WEBSOCKET_PASSTHROUGH_HEADER = 'x-bquery-websocket-passthrough';

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Creates a null-prototype dictionary for request-derived data.
 *
 * Request-controlled keys such as query params and route params must never write
 * into the default object prototype, otherwise names like `__proto__` can trigger
 * prototype-pollution bugs. Using `Object.create(null)` keeps these maps isolated
 * even before higher-level validation runs.
 */
const createDictionary = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;

const normalizePath = (path: string): string => {
  if (!path) {
    throw new Error(`route path must be a non-empty string; received ${String(path)}`);
  }

  if (path === '*' || path === '/*') {
    return '/*';
  }

  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
};

const compileRoutePath = (path: string): Pick<CompiledRoute, 'paramNames' | 'path' | 'pattern'> => {
  const normalizedPath = normalizePath(path);

  if (normalizedPath === '/*') {
    return { path: normalizedPath, paramNames: [], pattern: /^\/.*$/ };
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { path: normalizedPath, paramNames: [], pattern: /^\/$/ };
  }

  const paramNames: string[] = [];
  let source = '^';

  for (const [index, segment] of segments.entries()) {
    source += '/';
    if (segment === '*') {
      if (index !== segments.length - 1) {
        throw new Error(`invalid route path: "*" must be the final segment in "${normalizedPath}"`);
      }
      source += '.*';
      break;
    }

    if (segment.startsWith(':')) {
      const paramName = segment.slice(1);
      if (!/^[A-Za-z_$][\w$]*$/.test(paramName)) {
        throw new Error(
          `invalid route param name: ${paramName} - must start with a letter, $, or _ and contain only word characters`
        );
      }
      if (isPrototypePollutionKey(paramName)) {
        throw new Error(`invalid route param name: ${paramName} - reserved for object safety`);
      }
      paramNames.push(paramName);
      source += '([^/]+)';
      continue;
    }

    source += escapeRegex(segment);
  }

  source += '/?$';
  return { path: normalizedPath, paramNames, pattern: new RegExp(source) };
};

const normalizeMethods = (method?: string | string[]): Set<string> | null => {
  if (typeof method === 'undefined') {
    return METHOD_ALL;
  }

  const values = Array.isArray(method) ? method : [method];
  if (values.length === 0) {
    throw new Error('route method must be specified - received empty array');
  }

  const normalizedMethods = new Set(
    values.map((value) => value.trim().toUpperCase()).filter(Boolean)
  );
  if (normalizedMethods.size === 0) {
    throw new Error(
      `route method must include at least one non-empty method string; received ${JSON.stringify(method)}`
    );
  }

  return normalizedMethods;
};

const parseQuery = (url: URL): ServerQuery => {
  const query = createDictionary<string | string[] | undefined>() as ServerQuery;

  for (const [key, value] of url.searchParams.entries()) {
    if (isPrototypePollutionKey(key)) {
      continue;
    }
    const current = query[key];
    if (typeof current === 'undefined') {
      query[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      query[key] = [current, value];
    }
  }

  return query;
};

const normalizeUrl = (value: string | URL, baseUrl: string): URL => {
  return value instanceof URL ? new URL(value.toString()) : new URL(value, baseUrl);
};

const normalizeRequest = (
  input: Request | string | URL | ServerRequestInit,
  baseUrl: string
): Request => {
  if (input instanceof Request) {
    return input;
  }

  if (typeof input === 'string' || input instanceof URL) {
    return new Request(normalizeUrl(input, baseUrl).toString());
  }

  const { url, method = 'GET', headers, body = null } = input;
  return new Request(normalizeUrl(url, baseUrl).toString(), { method, headers, body });
};

const normalizeWebSocketProtocols = (protocols?: string | string[]): string[] => {
  if (typeof protocols === 'undefined') {
    return [];
  }

  const values = Array.isArray(protocols) ? protocols : [protocols];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

const defaultDeserialize = <TReceive>(event: MessageEvent): TReceive => {
  const raw = event.data;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as TReceive;
    } catch {
      // Match `useWebSocket()` in `src/reactive/websocket.ts`: malformed JSON
      // payloads fall back to the original string instead of throwing.
      return raw as TReceive;
    }
  }

  return raw as TReceive;
};

const escapeJsonString = (value: string): string =>
  value.replace(JSON_ESCAPE_PATTERN, (match) => JSON_ESCAPE_LOOKUP[match]);

const createHeaders = (headers?: HeadersInit): Headers => new Headers(headers);

const withContentType = (headers: Headers, contentType: string): Headers => {
  if (!headers.has('content-type')) {
    headers.set('content-type', contentType);
  }
  return headers;
};

const parseCookies = (header: string | null): Record<string, string> => {
  const cookies = createDictionary<string>();
  if (!header) {
    return cookies;
  }

  for (const pair of header.split(/;\s*/)) {
    const index = pair.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = pair.slice(0, index).trim();
    if (!key || isPrototypePollutionKey(key)) {
      continue;
    }
    const rawValue = pair.slice(index + 1).trim();
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
};

const serializeCookie = (name: string, value: string, options: ServerCookieOptions = {}): string => {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (typeof options.maxAge === 'number' && Number.isFinite(options.maxAge)) {
    parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
  }
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
};

const accepts = (request: Request, types: string[]): string | null => {
  const accept = request.headers.get('accept');
  if (!accept || types.length === 0) {
    return types[0] ?? null;
  }

  const normalized = accept.toLowerCase();
  for (const type of types) {
    const lowered = type.toLowerCase();
    if (normalized.includes(lowered)) {
      return type;
    }
    const [major] = lowered.split('/');
    if (normalized.includes(`${major}/*`) || normalized.includes('*/*')) {
      return type;
    }
  }

  return null;
};

const decodeFormUrlEncoded = (textBody: string): Record<string, string | string[] | undefined> => {
  const out = createDictionary<string | string[] | undefined>();
  for (const [key, value] of new URLSearchParams(textBody).entries()) {
    if (isPrototypePollutionKey(key)) {
      continue;
    }
    const current = out[key];
    if (typeof current === 'undefined') {
      out[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      out[key] = [current, value];
    }
  }
  return out;
};

const formatSseChunk = (event: ServerSseEvent | string, defaultRetry?: number): string => {
  if (typeof event === 'string') {
    return `data: ${event}\n${typeof defaultRetry === 'number' ? `retry: ${defaultRetry}\n` : ''}\n`;
  }

  let chunk = '';
  if (event.id) chunk += `id: ${event.id}\n`;
  if (event.event) chunk += `event: ${event.event}\n`;
  if (typeof event.retry === 'number') chunk += `retry: ${Math.trunc(event.retry)}\n`;
  else if (typeof defaultRetry === 'number') chunk += `retry: ${Math.trunc(defaultRetry)}\n`;
  for (const line of event.data.split('\n')) {
    chunk += `data: ${line}\n`;
  }
  return `${chunk}\n`;
};

const createSseResponse = (
  source: AsyncIterable<ServerSseEvent | string> | Iterable<ServerSseEvent | string>,
  init: ServerSseOptions = {}
): Response => {
  const headers = withContentType(createHeaders(init.headers), 'text/event-stream; charset=utf-8');
  headers.set('cache-control', headers.get('cache-control') ?? 'no-cache');
  headers.set('connection', headers.get('connection') ?? 'keep-alive');
  const encoder = new TextEncoder();
  const asyncSource =
    Symbol.asyncIterator in Object(source)
      ? (source as AsyncIterable<ServerSseEvent | string>)
      : (async function* () {
          yield* (source as Iterable<ServerSseEvent | string>);
        })();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of asyncSource) {
        controller.enqueue(encoder.encode(formatSseChunk(event, init.retry)));
      }
      controller.close();
    },
  });
  return response(stream, { ...init, headers });
};

const response = (body?: BodyInit | null, init: ServerResponseInit = {}): Response => {
  const { headers, ...rest } = init;
  return new Response(body, { ...rest, headers: createHeaders(headers) });
};

const text = (body: string, init: ServerResponseInit = {}): Response => {
  const headers = withContentType(createHeaders(init.headers), 'text/plain; charset=utf-8');
  return response(body, { ...init, headers });
};

const html = (body: string, init: ServerHtmlResponseInit = {}): Response => {
  const { trusted = false, ...rest } = init;
  const headers = withContentType(createHeaders(rest.headers), 'text/html; charset=utf-8');
  return response(trusted ? body : sanitizeHtml(body), { ...rest, headers });
};

const json = (data: unknown, init: ServerResponseInit = {}): Response => {
  const headers = withContentType(createHeaders(init.headers), 'application/json; charset=utf-8');
  let serialized: string;
  try {
    serialized = JSON.stringify(data) ?? 'null';
  } catch {
    serialized = 'null';
  }
  return response(escapeJsonString(serialized), { ...init, headers });
};

const redirect = (location: string | URL, status = 302): Response => {
  const headers = createHeaders({ location: location.toString() });
  return response(null, { headers, status });
};

const stream = (body: ReadableStream<Uint8Array>, init: ServerResponseInit = {}): Response => {
  return response(body, init);
};

const render = (
  template: string,
  data: Parameters<typeof renderToString>[1],
  options: ServerRenderResponseOptions = {}
): Response => {
  const { includeStoreState = false, status = 200, headers, ...renderOptions } = options;
  const result = renderToString(template, data, { ...renderOptions, includeStoreState: false });
  const storeState = includeStoreState
    ? serializeStoreState({
        storeIds: Array.isArray(includeStoreState) ? includeStoreState : undefined,
      }).scriptTag
    : '';
  const body = `${result.html}${storeState}`;
  return html(body, { headers, status, trusted: true });
};

const renderStreamResponse = (
  template: string,
  data: Parameters<typeof renderToString>[1],
  options: ServerRenderResponseOptions = {}
): Response => {
  const { headers, status = 200, ...renderOptions } = options;
  return response(renderToStream(template, data, renderOptions), {
    headers: withContentType(createHeaders(headers), 'text/html; charset=utf-8'),
    status,
  });
};

/**
 * Returns `true` when the request is a WebSocket upgrade handshake.
 */
export const isWebSocketRequest = (request: Request): boolean => {
  if (request.method.toUpperCase() !== 'GET') {
    return false;
  }

  const upgrade = request.headers.get('upgrade');
  if (typeof upgrade !== 'string' || upgrade.trim().toLowerCase() !== 'websocket') {
    return false;
  }

  const connection = request.headers.get('connection');
  if (typeof connection !== 'string') {
    return false;
  }

  if (!connection.split(',').some((part) => part.trim().toLowerCase() === 'upgrade')) {
    return false;
  }

  const version = request.headers.get('sec-websocket-version');
  if (version?.trim() !== '13') {
    return false;
  }

  const key = request.headers.get('sec-websocket-key')?.trim();
  return typeof key === 'string' && /^[A-Za-z0-9+/]{22}==$/.test(key);
};

/**
 * Type guard for values returned by `handleWebSocket()`.
 */
export const isServerWebSocketSession = (value: unknown): value is ServerWebSocketSession => {
  if (typeof value !== 'object' || value === null || value instanceof Response) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.open === 'function' &&
    typeof candidate.message === 'function' &&
    typeof candidate.close === 'function' &&
    typeof candidate.error === 'function'
  );
};

const createWebSocketConnectionFactory = () => {
  const cache = new WeakMap<object, ServerWebSocketConnection>();

  return (socket: ServerWebSocketPeer): ServerWebSocketConnection => {
    const existing = cache.get(socket);
    if (existing) {
      return existing;
    }

    const connection: ServerWebSocketConnection = {
      get protocol() {
        return socket.protocol;
      },
      get readyState() {
        return socket.readyState;
      },
      get url() {
        return socket.url;
      },
      send(data) {
        socket.send(data);
      },
      sendJson(data) {
        const payload = JSON.stringify(data);
        if (typeof payload !== 'string') {
          throw new TypeError('socket.sendJson() does not support undefined values');
        }
        socket.send(payload);
      },
      close(code, reason) {
        socket.close(code, reason);
      },
    };

    cache.set(socket, connection);
    return connection;
  };
};

const createWebSocketSession = <TReceive>(
  context: ServerContext,
  handlers: ServerWebSocketHandlerSet<TReceive>
): ServerWebSocketSession => {
  const toConnection = createWebSocketConnectionFactory();
  const deserialize = handlers.deserialize ?? defaultDeserialize<TReceive>;

  return {
    context,
    protocols: normalizeWebSocketProtocols(handlers.protocols),
    headers: handlers.headers,
    async open(socket) {
      if (handlers.onOpen) {
        await handlers.onOpen(toConnection(socket), context);
      }
    },
    async message(socket, event) {
      if (handlers.onMessage) {
        await handlers.onMessage(deserialize(event), toConnection(socket), context, event);
      }
    },
    async close(socket, event) {
      if (handlers.onClose) {
        await handlers.onClose(event, toConnection(socket), context);
      }
    },
    async error(socket, event) {
      if (handlers.onError) {
        await handlers.onError(event, toConnection(socket), context);
      }
    },
  };
};

const createWebSocketPassthroughResponse = (): Response => {
  const headers = createHeaders({
    [WEBSOCKET_PASSTHROUGH_HEADER]: '1',
  });
  return response(null, { headers, status: 204 });
};

const isWebSocketPassthroughResponse = (value: Response): boolean => {
  return value.headers.get(WEBSOCKET_PASSTHROUGH_HEADER) === '1';
};

const matchRoute = (
  route: Pick<CompiledRoute, 'methods' | 'paramNames' | 'pattern'>,
  method: string,
  path: string
): Record<string, string> | null => {
  if (route.methods && !route.methods.has(method)) {
    return null;
  }

  const match = route.pattern.exec(path);
  if (!match) {
    return null;
  }

  const params = createDictionary<string>();
  for (const [index, paramName] of route.paramNames.entries()) {
    try {
      params[paramName] = decodeURIComponent(match[index + 1] ?? '');
    } catch (error) {
      if (error instanceof URIError) {
        return null;
      }
      throw error;
    }
  }

  return params;
};

const resolveMatchingRoute = <TRoute extends CompiledRoute | CompiledWebSocketRoute>(
  routes: TRoute[],
  method: string,
  path: string,
  context: ServerContext
): TRoute | null => {
  for (const candidate of routes) {
    const params = matchRoute(candidate, method, path);
    if (!params) {
      continue;
    }
    context.params = params;
    return candidate;
  }

  return null;
};

const runPipeline = async (
  context: ServerContext,
  handlers: PipelineHandler[],
  terminal: ServerNext
): Promise<Response> => {
  const dispatch = async (index: number): Promise<Response> => {
    const current = handlers[index];
    if (!current) {
      return terminal();
    }

    let advanced = false;
    return await current(context, async () => {
      if (advanced) {
        throw new Error(
          'middleware next() called multiple times - if a middleware calls next(), it may only do so once'
        );
      }
      advanced = true;
      return await dispatch(index + 1);
    });
  };

  return await dispatch(0);
};

const runWebSocketPipeline = async (
  context: ServerContext,
  handlers: WebSocketPipelineHandler[],
  terminal: ServerWebSocketNext
): Promise<ServerResult> => {
  const dispatch = async (index: number): Promise<ServerResult> => {
    const current = handlers[index];
    if (!current) {
      return terminal();
    }

    let advanced = false;
    return await current(context, async () => {
      if (advanced) {
        throw new Error(
          'middleware next() called multiple times - if a middleware calls next(), it may only do so once'
        );
      }
      advanced = true;
      return await dispatch(index + 1);
    });
  };

  return await dispatch(0);
};

const adaptHttpMiddlewareToWebSocket = (middleware: ServerMiddleware): WebSocketPipelineHandler => {
  return async (context, next) => {
    let downstream: ServerResult = null;
    let downstreamResponse: Response | null = null;
    const middlewareResponse = await middleware(context, async () => {
      downstream = await next();
      if (downstream instanceof Response) {
        downstreamResponse = downstream;
        return downstream;
      }
      return createWebSocketPassthroughResponse();
    });

    if (downstreamResponse) {
      return middlewareResponse;
    }

    if (
      middlewareResponse instanceof Response &&
      isWebSocketPassthroughResponse(middlewareResponse)
    ) {
      return downstream;
    }

    return middlewareResponse;
  };
};

const compileRoute = (route: ServerRoute): CompiledRoute => {
  const compiledPath = compileRoutePath(route.path);
  return {
    handler: route.handler,
    methods: normalizeMethods(route.method),
    middlewares: route.middlewares ?? [],
    paramNames: compiledPath.paramNames,
    path: compiledPath.path,
    pattern: compiledPath.pattern,
  };
};

const createBodyReader = (
  request: Request,
  limits: CreateServerOptions['limits']
): (() => Promise<unknown>) => {
  let cached: Promise<unknown> | null = null;

  return async (): Promise<unknown> => {
    cached ??= (async () => {
      const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

      if (!contentType) {
        return null;
      }

      if (contentType.includes('application/json')) {
        const textBody = await request.clone().text();
        if (limits?.json !== undefined && textBody.length > limits.json) {
          throw new ServerHttpError(413, 'Request JSON body exceeds the configured limit.');
        }
        try {
          return textBody ? JSON.parse(textBody) : null;
        } catch {
          throw new ServerHttpError(400, 'Request body contains invalid JSON.');
        }
      }

      if (contentType.includes('application/x-www-form-urlencoded')) {
        const textBody = await request.clone().text();
        if (limits?.form !== undefined && textBody.length > limits.form) {
          throw new ServerHttpError(413, 'Form body exceeds the configured limit.');
        }
        return decodeFormUrlEncoded(textBody);
      }

      if (contentType.includes('multipart/form-data')) {
        if (typeof request.formData !== 'function') {
          throw new ServerHttpError(415, 'multipart/form-data is not supported in this runtime.');
        }
        const formData = await request.clone().formData();
        const out = new Map<string, FormDataEntryValue | FormDataEntryValue[]>();
        for (const [key, value] of formData.entries()) {
          if (isPrototypePollutionKey(key)) {
            continue;
          }
          const current = out.get(key);
          if (typeof current === 'undefined') {
            out.set(key, value);
          } else if (Array.isArray(current)) {
            current.push(value);
          } else {
            out.set(key, [current, value]);
          }
        }
        return out;
      }

      if (contentType.startsWith('text/')) {
        const textBody = await request.clone().text();
        if (limits?.text !== undefined && textBody.length > limits.text) {
          throw new ServerHttpError(413, 'Text body exceeds the configured limit.');
        }
        return textBody;
      }

      return request.clone().arrayBuffer();
    })();

    return cached;
  };
};

const createServerContext = (
  request: Request,
  baseUrl: string,
  limits: CreateServerOptions['limits']
): ServerContext => {
  const url = new URL(request.url, baseUrl);
  const method = request.method.toUpperCase();
  const path = normalizePath(url.pathname || '/');
  const query = parseQuery(url);
  const cookies = parseCookies(request.headers.get('cookie'));
  const readBody = createBodyReader(request, limits);
  const responseHeaders = createHeaders();

  return {
    request,
    url,
    method,
    path,
    params: createDictionary<string>(),
    query,
    cookies,
    state: {},
    body: readBody,
    response: (body, init = {}) => {
      const headers = createHeaders(init.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return response(body, { ...init, headers });
    },
    text: (body, init = {}) => {
      const headers = createHeaders(init.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return text(body, { ...init, headers });
    },
    html: (body, init = {}) => {
      const headers = createHeaders(init.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return html(body, { ...init, headers });
    },
    json: (data, init = {}) => {
      const headers = createHeaders(init.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return json(data, { ...init, headers });
    },
    stream: (body, init = {}) => {
      const headers = createHeaders(init.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return stream(body, { ...init, headers });
    },
    sse: (source, init = {}) => {
      const headers = createHeaders(init.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return createSseResponse(source, { ...init, headers });
    },
    accepts: (types) => accepts(request, types),
    setCookie(name, value, options = {}) {
      responseHeaders.append('set-cookie', serializeCookie(name, value, options));
    },
    redirect,
    render: (template, data, options = {}) => {
      const headers = createHeaders(options.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return render(template, data, { ...options, headers });
    },
    renderStream: (template, data, options = {}) => {
      const headers = createHeaders(options.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return renderStreamResponse(template, data, { ...options, headers });
    },
    async renderResponse(template, data, options = {}) {
      const headers = createHeaders(options.headers);
      responseHeaders.forEach((value, name) => headers.append(name, value));
      return await renderToResponse(template, data, { ...options, headers });
    },
    runTask,
    callWorker: callWorkerMethod,
    isWebSocketRequest: isWebSocketRequest(request),
  };
};

/**
 * Create a lightweight, Express-inspired request pipeline for SSR-aware
 * backends without introducing runtime dependencies.
 *
 * @example
 * ```ts
 * import { createServer } from '@bquery/bquery/server';
 *
 * const app = createServer();
 * app.get('/health', (ctx) => ctx.json({ ok: true }));
 *
 * const response = await app.handle('/health');
 * ```
 */
export const createServer = (options: CreateServerOptions = {}): ServerApp => {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const limits = options.limits;
  const middlewares = [...(options.middlewares ?? [])];
  const routes: CompiledRoute[] = [];
  const webSocketRoutes: CompiledWebSocketRoute[] = [];

  const notFound =
    options.notFound ??
    ((context: ServerContext) => {
      return context.text('Not Found', { status: 404 });
    });

  const onError =
    options.onError ??
    ((error: unknown, context: ServerContext) => {
      if (error instanceof Response) {
        return error;
      }
      if (error instanceof ServerHttpError) {
        return context.text(error.expose ? error.message : 'Internal Server Error', {
          status: error.status,
        });
      }
      return context.text('Internal Server Error', { status: 500 });
    });

  const addRoute = (
    method: string | string[] | undefined,
    path: string,
    handler: ServerHandler,
    routeMiddlewares?: ServerMiddleware[]
  ): ServerApp => {
    routes.push(
      compileRoute({
        handler,
        method,
        middlewares: routeMiddlewares,
        path,
      })
    );
    return app;
  };

  const addWebSocketRoute = (
    path: string,
    handler: ServerWebSocketRouteHandler<unknown>,
    routeMiddlewares?: ServerWebSocketMiddleware[]
  ): ServerApp => {
    const compiledPath = compileRoutePath(path);
    webSocketRoutes.push({
      handler,
      methods: new Set(['GET']),
      middlewares: routeMiddlewares ?? [],
      paramNames: compiledPath.paramNames,
      path: compiledPath.path,
      pattern: compiledPath.pattern,
    });
    return app;
  };

  const app: ServerApp = {
    use(middleware) {
      middlewares.push(middleware);
      return app;
    },

    add(route) {
      routes.push(compileRoute(route));
      return app;
    },

    get(path, handler, routeMiddlewares) {
      return addRoute('GET', path, handler, routeMiddlewares);
    },

    post(path, handler, routeMiddlewares) {
      return addRoute('POST', path, handler, routeMiddlewares);
    },

    put(path, handler, routeMiddlewares) {
      return addRoute('PUT', path, handler, routeMiddlewares);
    },

    patch(path, handler, routeMiddlewares) {
      return addRoute('PATCH', path, handler, routeMiddlewares);
    },

    delete(path, handler, routeMiddlewares) {
      return addRoute('DELETE', path, handler, routeMiddlewares);
    },

    all(path, handler, routeMiddlewares) {
      return addRoute(undefined, path, handler, routeMiddlewares);
    },

    ws(path, handler, routeMiddlewares) {
      return addWebSocketRoute(
        path,
        handler as ServerWebSocketRouteHandler<unknown>,
        routeMiddlewares
      );
    },

    async handle(input) {
      const request = normalizeRequest(input, baseUrl);
      const context = createServerContext(request, baseUrl, limits);

      try {
       const route = resolveMatchingRoute(routes, context.method, context.path, context);

        if (!route) {
          return await notFound(context);
        }

        const stack: PipelineHandler[] = [
          ...middlewares,
          ...route.middlewares,
          async (ctx) => await route.handler(ctx),
        ];

        const result = await runPipeline(context, stack, async () => {
          return await notFound(context);
        });
        return result;
      } catch (error) {
        return await onError(error, context);
      }
    },

    async handleWebSocket(input) {
      const request = normalizeRequest(input, baseUrl);
      const context = createServerContext(request, baseUrl, limits);

      if (!context.isWebSocketRequest) {
        return null;
      }

      try {
        const route = resolveMatchingRoute(webSocketRoutes, context.method, context.path, context);
        if (!route) {
          return null;
        }

        const stack: WebSocketPipelineHandler[] = [
          ...middlewares.map(adaptHttpMiddlewareToWebSocket),
          ...route.middlewares,
        ];
        return await runWebSocketPipeline(context, stack, async () => {
          const handlers =
            typeof route.handler === 'function' ? await route.handler(context) : route.handler;
          return createWebSocketSession(context, handlers as ServerWebSocketHandlerSet<unknown>);
        });
      } catch (error) {
        return await onError(error, context);
      }
    },

    async listen(listenOptions: ServerListenOptions = {}): Promise<ServerListenHandle> {
      const runtime = listenOptions.runtime ?? 'auto';
      const resolvedRuntime = runtime === 'auto' ? detectRuntime() : runtime;
      const port = listenOptions.port ?? 3000;
      const hostname = listenOptions.hostname ?? '127.0.0.1';

      if (resolvedRuntime === 'bun') {
        const bunGlobal = globalThis as typeof globalThis & {
          Bun?: {
            serve(options: {
              fetch: (request: Request) => Promise<Response>;
              hostname?: string;
              port?: number;
            }): { hostname?: string; port?: number; stop(): void };
          };
        };
        if (!bunGlobal.Bun?.serve) {
          throw new Error('Bun runtime APIs are unavailable.');
        }
        const server = bunGlobal.Bun.serve({
          fetch: (request) => app.handle(request),
          hostname,
          port,
        });
        listenOptions.signal?.addEventListener('abort', () => server.stop(), { once: true });
        return {
          addresses: [`http://${server.hostname ?? hostname}:${server.port ?? port}`],
          async close() {
            server.stop();
          },
          async stop() {
            server.stop();
          },
          url: `http://${server.hostname ?? hostname}:${server.port ?? port}`,
        };
      }

      if (resolvedRuntime === 'node') {
        const nodeHttp = (await import('node:http')) as typeof import('node:http');
        const handler = createNodeHandler((request) => app.handle(request));
        const server = nodeHttp.createServer(handler);
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(port, hostname, () => resolve());
        });
        listenOptions.signal?.addEventListener('abort', () => server.close(), { once: true });
        return {
          addresses: [`http://${hostname}:${port}`],
          async close() {
            await new Promise<void>((resolve, reject) => {
              server.close((error) => (error ? reject(error) : resolve()));
            });
          },
          async stop() {
            await new Promise<void>((resolve, reject) => {
              server.close((error) => (error ? reject(error) : resolve()));
            });
          },
          url: `http://${hostname}:${port}`,
        };
      }

      if (resolvedRuntime === 'deno') {
        throw new Error('createServer().listen() is not yet implemented for Deno in this runtime.');
      }

      throw new Error(`createServer().listen() is not supported in runtime "${resolvedRuntime}".`);
    },
  };

  return app;
};
