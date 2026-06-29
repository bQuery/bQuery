/**
 * Server bridge for the file-route convention.
 *
 * Turns the `action` (and optionally `load`) functions attached to file routes
 * into `server` routes, so a `<form>` posting to a route (or a `formAction()`
 * fetch) reaches the matching `action`. Loaders keep running before render via
 * the SSR router bridge; this module is specifically about the mutation/POST
 * side and an optional JSON loader endpoint for client-side data fetching.
 *
 * It depends only on the file-route *types* from `@bquery/bquery/router`, so it
 * adds no runtime coupling — pass it the `entries` from `createFileRoutes()`.
 *
 * @module bquery/server
 */

import type { FileRoute } from '../router/file-routes/types';
import type { ServerApp, ServerContext, ServerHandler, ServerMiddleware, ServerRoute } from './types';

/** Options for {@link createFileRouteServerRoutes} / {@link mountFileRoutes}. */
export interface FileRouteServerOptions {
  /**
   * HTTP method(s) the generated action endpoint responds to.
   * @default 'POST'
   */
  actionMethod?: string | string[];
  /**
   * When set, also generate a loader endpoint serving each route's `load`
   * result as JSON. The pattern is `${dataPath}<route>` (e.g. `/__data/users/:id`)
   * so it never collides with the HTML route. Disabled by default.
   */
  dataPath?: string;
  /** Prefix prepended to every generated route path. */
  basePath?: string;
  /** Middleware applied to generated action routes (e.g. `csrf()`). */
  middlewares?: ServerMiddleware[];
  /** Middleware applied to generated loader routes. */
  dataMiddlewares?: ServerMiddleware[];
}

/**
 * Strip trailing `/` with a single linear scan. A `\/+$` regex backtracks
 * super-linearly on strings of repeated slashes (ReDoS), so we trim by index.
 */
const stripTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* '/' */) end -= 1;
  return value.slice(0, end);
};

const joinPath = (base: string | undefined, pattern: string): string => {
  const prefix = stripTrailingSlashes(base ?? '');
  if (!prefix) return pattern;
  return pattern === '/' ? prefix || '/' : `${prefix}${pattern}`;
};

const toResponse = (ctx: ServerContext, value: unknown): Response =>
  value instanceof Response ? value : ctx.json(value ?? null);

const actionHandler = (route: FileRoute): ServerHandler => async (ctx) => {
  // Resolve the module directly so lazily-imported routes that turn out to have
  // no `action` reply 405 rather than running a throwing convenience wrapper.
  const { action } = await route.resolve();
  if (typeof action !== 'function') {
    return ctx.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  const result = await action({
    request: ctx.request,
    params: ctx.params,
    url: ctx.url,
    ctx,
  });
  return toResponse(ctx, result);
};

const loaderHandler = (route: FileRoute): ServerHandler => async (ctx) => {
  const { load } = await route.resolve();
  if (typeof load !== 'function') {
    return ctx.json({ error: 'Not Found' }, { status: 404 });
  }
  const result = await load({
    params: ctx.params,
    url: ctx.url,
    request: ctx.request,
    ctx,
    signal: ctx.request.signal,
  });
  return toResponse(ctx, result);
};

/**
 * Build `server` route definitions from file-route entries. Routes whose module
 * is statically known to export no `action` (eagerly-imported modules) are
 * skipped; lazily-imported routes always get an endpoint that resolves the
 * module and replies `405` when no `action` is present.
 *
 * @example
 * ```ts
 * import { createServer, csrf } from '@bquery/bquery/server';
 * import { createFileRoutes } from '@bquery/bquery/router';
 *
 * const { entries } = createFileRoutes(import.meta.glob('./routes/**\/+page.ts'));
 * const app = createServer();
 * for (const route of createFileRouteServerRoutes(entries, { middlewares: [csrf()] })) {
 *   app.add(route);
 * }
 * ```
 */
export const createFileRouteServerRoutes = (
  entries: FileRoute[],
  options: FileRouteServerOptions = {}
): ServerRoute[] => {
  const routes: ServerRoute[] = [];
  const actionMethod = options.actionMethod ?? 'POST';

  for (const route of entries) {
    if (route.hasAction !== false) {
      routes.push({
        path: joinPath(options.basePath, route.pattern),
        method: actionMethod,
        middlewares: options.middlewares,
        handler: actionHandler(route),
      });
    }

    if (options.dataPath && route.hasLoad !== false) {
      routes.push({
        path: joinPath(options.dataPath, joinPath(options.basePath, route.pattern)),
        method: 'GET',
        middlewares: options.dataMiddlewares,
        handler: loaderHandler(route),
      });
    }
  }

  return routes;
};

/**
 * Register the generated file-route endpoints on a server app and return the
 * app for chaining.
 *
 * @example
 * ```ts
 * const app = mountFileRoutes(createServer(), entries, { middlewares: [csrf()] });
 * ```
 */
export const mountFileRoutes = (
  app: ServerApp,
  entries: FileRoute[],
  options: FileRouteServerOptions = {}
): ServerApp => {
  for (const route of createFileRouteServerRoutes(entries, options)) {
    app.add(route);
  }
  return app;
};
