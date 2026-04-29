import type { RenderOptions } from '../ssr/index';
import type { BindingContext } from '../view/index';

/**
 * Repeated query parameters are represented as arrays.
 */
export interface ServerQuery {
  [key: string]: string | string[] | undefined;
}

/**
 * Lightweight request input accepted by `handle()`.
 */
export interface ServerRequestInit {
  /**
   * Request URL or path.
   *
   * Relative paths are resolved against `CreateServerOptions.baseUrl`.
   */
  url: string | URL;

  /**
   * HTTP method.
   * @default 'GET'
   */
  method?: string;

  /**
   * Request headers.
   */
  headers?: HeadersInit;

  /**
   * Optional request body.
   */
  body?: BodyInit | null;
}

/**
 * Shared response options used by server helpers.
 */
export interface ServerResponseInit extends ResponseInit {
  headers?: HeadersInit;
}

/**
 * HTML response options.
 */
export interface ServerHtmlResponseInit extends ServerResponseInit {
  /**
   * When `true`, the HTML string is assumed to be already safe and is returned
   * without additional sanitization.
   * @default false
   */
  trusted?: boolean;
}

/**
 * SSR response options.
 */
export interface ServerRenderResponseOptions extends RenderOptions {
  /**
   * HTTP status to use for the response.
   * @default 200
   */
  status?: number;

  /**
   * Additional response headers.
   */
  headers?: HeadersInit;
}

/**
 * Binary/text payloads accepted by server-side WebSocket peers and sessions.
 *
 * Use this for raw frames sent through `socket.send(...)`.
 */
export type ServerWebSocketData = string | Blob | ArrayBufferLike | ArrayBufferView;

/**
 * Minimal runtime WebSocket peer shape consumed by server-side WebSocket sessions.
 */
export interface ServerWebSocketPeer {
  /**
   * Negotiated sub-protocol, when available.
   */
  protocol?: string;

  /**
   * Current readyState, when the runtime exposes it.
   */
  readyState?: number;

  /**
   * Remote URL, when the runtime exposes it.
   */
  url?: string;

  /**
   * Send a raw payload to the connected peer.
   */
  send(data: ServerWebSocketData): void;

  /**
   * Close the connection.
   */
  close(code?: number, reason?: string): void;
}

/**
 * Wrapped WebSocket connection exposed to route handlers.
 */
export interface ServerWebSocketConnection extends ServerWebSocketPeer {
  /**
   * Serialize a value with `JSON.stringify()` and send it to the peer.
   */
  sendJson(data: unknown): void;
}

/**
 * Request/response context passed through the server pipeline.
 */
export interface ServerContext {
  /**
   * Normalized `Request` instance.
   */
  request: Request;

  /**
   * Parsed URL for the current request.
   */
  url: URL;

  /**
   * Uppercase HTTP method.
   */
  method: string;

  /**
   * Pathname without query string.
   */
  path: string;

  /**
   * Route params captured from `:param` path segments.
   */
  params: Record<string, string>;

  /**
   * Parsed query object. Repeated keys become arrays.
   */
  query: ServerQuery;

  /**
   * Per-request mutable state bag for middleware communication.
   */
  state: Record<string, unknown>;

  /**
   * Create a raw `Response`.
   *
   * @example
   * ```ts
   * return ctx.response('Created', { status: 201 });
   * ```
   */
  response(body?: BodyInit | null, init?: ServerResponseInit): Response;

  /**
   * Create a plain-text response.
   *
   * @example
   * ```ts
   * return ctx.text('ok');
   * ```
   */
  text(body: string, init?: ServerResponseInit): Response;

  /**
   * Create a sanitized HTML response by default.
   *
   * @example
   * ```ts
   * return ctx.html('<h1>Hello</h1>');
   * ```
   */
  html(body: string, init?: ServerHtmlResponseInit): Response;

  /**
   * Create a JSON response.
   *
   * @example
   * ```ts
   * return ctx.json({ ok: true });
   * ```
   */
  json(data: unknown, init?: ServerResponseInit): Response;

  /**
   * Create a redirect response.
   *
   * @example
   * ```ts
   * return ctx.redirect('/login', 302);
   * ```
   */
  redirect(location: string | URL, status?: number): Response;

  /**
   * Render a bQuery SSR template into an HTML response.
   *
   * @example
   * ```ts
   * return ctx.render('<h1 bq-text="title"></h1>', { title: 'Dashboard' });
   * ```
   */
  render(
    template: string,
    data: BindingContext,
    options?: ServerRenderResponseOptions
  ): Response;

  /**
   * `true` when the incoming request is a WebSocket upgrade handshake.
   */
  isWebSocketRequest: boolean;
}

/**
 * Final request handler.
 */
export interface ServerHandler {
  (context: ServerContext): Response | Promise<Response>;
}

/**
 * WebSocket route lifecycle callbacks.
 */
export interface ServerWebSocketHandlerSet<TReceive = unknown> {
  /**
   * Requested sub-protocols for the handshake.
   */
  protocols?: string | string[];

  /**
   * Additional handshake headers used by compatible runtimes.
   */
  headers?: HeadersInit;

  /**
   * Deserialize incoming WebSocket messages.
   *
   * Defaults to JSON.parse for string payloads with a raw-string fallback.
   */
  deserialize?: (event: MessageEvent) => TReceive;

  /**
   * Called after the runtime accepts the upgrade.
   */
  onOpen?: (socket: ServerWebSocketConnection, context: ServerContext) => void | Promise<void>;

  /**
   * Called for each incoming message after deserialization.
   */
  onMessage?: (
    data: TReceive,
    socket: ServerWebSocketConnection,
    context: ServerContext,
    event: MessageEvent
  ) => void | Promise<void>;

  /**
   * Called when the connection closes.
   */
  onClose?: (
    event: CloseEvent,
    socket: ServerWebSocketConnection,
    context: ServerContext
  ) => void | Promise<void>;

  /**
   * Called when the runtime reports a socket error.
   */
  onError?: (
    event: Event,
    socket: ServerWebSocketConnection,
    context: ServerContext
  ) => void | Promise<void>;
}

/**
 * WebSocket route definition or per-request factory.
 */
export type ServerWebSocketRouteHandler<TReceive = unknown> =
  | ServerWebSocketHandlerSet<TReceive>
  | ((
      context: ServerContext
    ) => ServerWebSocketHandlerSet<TReceive> | Promise<ServerWebSocketHandlerSet<TReceive>>);

/**
 * Runtime-agnostic WebSocket session returned by `handleWebSocket()`.
 */
export interface ServerWebSocketSession {
  /**
   * Request context captured during route matching and middleware execution.
   */
  context: ServerContext;

  /**
   * Normalized requested sub-protocols.
   */
  protocols: string[];

  /**
   * Additional handshake headers requested by the route.
   */
  headers?: HeadersInit;

  /**
   * Notify the session that the runtime accepted the connection.
   */
  open(socket: ServerWebSocketPeer): Promise<void>;

  /**
   * Deliver an incoming message event to the session.
   */
  message(socket: ServerWebSocketPeer, event: MessageEvent): Promise<void>;

  /**
   * Notify the session about a close event.
   */
  close(socket: ServerWebSocketPeer, event: CloseEvent): Promise<void>;

  /**
   * Notify the session about a socket error.
   */
  error(socket: ServerWebSocketPeer, event: Event): Promise<void>;
}

/**
 * Result type used by middleware and WebSocket handling.
 */
export type ServerResult = Response | ServerWebSocketSession | null;

/**
 * Middleware continuation callback.
 */
export interface ServerNext {
  (): Promise<Response>;
}

/**
 * Express-inspired middleware for request pipelines.
 */
export interface ServerMiddleware {
  (context: ServerContext, next: ServerNext): Response | Promise<Response>;
}

/**
 * WebSocket middleware continuation callback.
 */
export interface ServerWebSocketNext {
  (): Promise<ServerResult>;
}

/**
 * Middleware used by WebSocket routes.
 */
export interface ServerWebSocketMiddleware {
  (context: ServerContext, next: ServerWebSocketNext): ServerResult | Promise<ServerResult>;
}

/**
 * Route definition used by `add()`.
 */
export interface ServerRoute {
  /**
   * Route path. Supports static segments, `:params`, and terminal `*`.
   */
  path: string;

  /**
   * One or many HTTP methods. Omit for "all methods".
   */
  method?: string | string[];

  /**
   * Optional route-scoped middleware.
   */
  middlewares?: ServerMiddleware[];

  /**
   * Final route handler.
   */
  handler: ServerHandler;
}

/**
 * Configures a server instance.
 */
export interface CreateServerOptions {
  /**
   * Base URL used to resolve relative request paths.
   * @default 'http://localhost'
   */
  baseUrl?: string;

  /**
   * Global middleware applied to every request.
   */
  middlewares?: ServerMiddleware[];

  /**
   * Custom 404 handler.
   */
  notFound?: ServerHandler;

  /**
   * Custom error handler.
   */
  onError?: (error: unknown, context: ServerContext) => Response | Promise<Response>;
}

/**
 * Express-inspired app-like server handle.
 */
export interface ServerApp {
  /**
   * Register global middleware.
   */
  use(middleware: ServerMiddleware): ServerApp;

  /**
   * Add a fully specified route.
   */
  add(route: ServerRoute): ServerApp;

  /**
   * Register a GET route.
   */
  get(path: string, handler: ServerHandler, middlewares?: ServerMiddleware[]): ServerApp;

  /**
   * Register a POST route.
   */
  post(path: string, handler: ServerHandler, middlewares?: ServerMiddleware[]): ServerApp;

  /**
   * Register a PUT route.
   */
  put(path: string, handler: ServerHandler, middlewares?: ServerMiddleware[]): ServerApp;

  /**
   * Register a PATCH route.
   */
  patch(path: string, handler: ServerHandler, middlewares?: ServerMiddleware[]): ServerApp;

  /**
   * Register a DELETE route.
   */
  delete(path: string, handler: ServerHandler, middlewares?: ServerMiddleware[]): ServerApp;

  /**
   * Register a route that matches any method.
   */
  all(path: string, handler: ServerHandler, middlewares?: ServerMiddleware[]): ServerApp;

  /**
   * Register a WebSocket route.
   */
  ws<TReceive = unknown>(
    path: string,
    handler: ServerWebSocketRouteHandler<TReceive>,
    middlewares?: ServerWebSocketMiddleware[]
  ): ServerApp;

  /**
   * Handle a normalized request.
   */
  handle(input: Request | string | URL | ServerRequestInit): Promise<Response>;

  /**
   * Resolve a WebSocket upgrade request into a runtime-agnostic session.
   *
   * Returns `null` when the request is not a WebSocket handshake or no matching
   * WebSocket route exists. Middleware may also short-circuit with a `Response`.
   */
  handleWebSocket(input: Request | string | URL | ServerRequestInit): Promise<ServerResult>;
}
