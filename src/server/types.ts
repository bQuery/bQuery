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
}

/**
 * Final request handler.
 */
export interface ServerHandler {
  (context: ServerContext): Response | Promise<Response>;
}

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
   * Handle a normalized request.
   */
  handle(input: Request | string | URL | ServerRequestInit): Promise<Response>;
}
