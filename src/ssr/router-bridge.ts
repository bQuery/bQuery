/**
 * Router ↔ SSR bridge.
 *
 * On the server you typically need to:
 * 1. Match the incoming URL against your router's route table.
 * 2. Run any data loaders attached to the matched route.
 * 3. Inject the resolved route + loader data into the SSR binding context.
 *
 * `resolveSSRRoute()` and `runRouteLoaders()` perform steps 1 and 2 without
 * coupling the SSR module to the actual `createRouter()` runtime — only the
 * pure `matchRoute()` helper from `@bquery/bquery/router` is used. Loaders
 * live on `RouteDefinition.meta.loader` (additive, no existing field changes).
 *
 * @module bquery/ssr
 */

import { matchRoute } from '../router/match';
import { parseQuery } from '../router/query';
import type { Route, RouteDefinition } from '../router/types';
import type { SSRContext } from './context';

/**
 * Loader signature for SSR routes. Attach as `meta.loader` on a
 * `RouteDefinition` and `runRouteLoaders()` will invoke it with the matched
 * route + the active SSR context.
 */
export type SSRRouteLoader<T = unknown> = (args: {
  route: Route;
  ctx: SSRContext;
}) => T | Promise<T>;

const getLoader = (route: RouteDefinition | null): SSRRouteLoader | undefined => {
  if (!route || !route.meta) return undefined;
  const loader = (route.meta as { loader?: unknown }).loader;
  return typeof loader === 'function' ? (loader as SSRRouteLoader) : undefined;
};

/** Result of `resolveSSRRoute()`. */
export interface ResolvedSSRRoute {
  /** Route-like snapshot for the requested URL, with `matched` set when found. */
  route: Route;
  /** Whether a route definition was actually matched. */
  matched: boolean;
  /** Whether the matched route has a `redirectTo` target. */
  isRedirect: boolean;
  /** Redirect target, if any. */
  redirectTo?: string;
}

/**
 * Matches a URL against a route table without instantiating a full router.
 *
 * Designed to be called on the server before the SSR render so userland can
 * branch on `matched`/`isRedirect` (e.g. issue a 302 instead of rendering).
 *
 * @example
 * ```ts
 * import { resolveSSRRoute } from '@bquery/bquery/ssr';
 *
 * const { route, matched, isRedirect, redirectTo } = resolveSSRRoute({
 *   url: new URL(request.url),
 *   routes,
 * });
 *
 * if (isRedirect) return Response.redirect(redirectTo!, 302);
 * if (!matched) return new Response('Not Found', { status: 404 });
 * ```
 */
export const resolveSSRRoute = (options: {
  url: string | URL;
  routes: RouteDefinition[];
  /** Strip a base path before matching. Default: `''`. */
  base?: string;
}): ResolvedSSRRoute => {
  const url =
    typeof options.url === 'string' ? new URL(options.url, 'http://localhost/') : options.url;
  const base = options.base ?? '';
  let pathname = url.pathname;
  if (base) {
    if (pathname === base) {
      pathname = '/';
    } else if (pathname.startsWith(`${base}/`)) {
      pathname = pathname.slice(base.length) || '/';
    }
  }

  const result = matchRoute(pathname, options.routes);
  const route: Route = {
    path: pathname,
    params: result?.params ?? {},
    query: parseQuery(url.search),
    matched: result?.matched ?? null,
    hash: url.hash.replace(/^#/, ''),
  };
  const matched = result !== null;
  const matchedDef = result?.matched ?? null;
  const isRedirect =
    !!matchedDef && 'redirectTo' in matchedDef && typeof matchedDef.redirectTo === 'string';
  return {
    route,
    matched,
    isRedirect,
    redirectTo: isRedirect ? (matchedDef as { redirectTo: string }).redirectTo : undefined,
  };
};

/**
 * Runs the loader attached to the matched route (`meta.loader`), if any.
 * Returns the resolved data, or `undefined` if no loader is configured.
 */
export const runRouteLoaders = async <T = unknown>(
  route: Route,
  ctx: SSRContext
): Promise<T | undefined> => {
  const loader = getLoader(route.matched);
  if (!loader) return undefined;
  try {
    return (await loader({ route, ctx })) as T;
  } catch (error) {
    ctx.reportError(error);
    return undefined;
  }
};

/**
 * Convenience wrapper that resolves a route, runs its loader, and returns a
 * binding-context fragment ready to be merged into the data passed to
 * `renderToStringAsync()` / `renderToResponse()`.
 *
 * @example
 * ```ts
 * import {
 *   createSSRContext,
 *   createSSRRouterContext,
 *   renderToResponse,
 * } from '@bquery/bquery/ssr';
 *
 * const ctx = createSSRContext();
 * const router = await createSSRRouterContext({ url: request.url, routes, ctx });
 * if (router.isRedirect) return Response.redirect(router.redirectTo!, 302);
 *
 * return renderToResponse(template, { ...router.bindings }, { context: ctx });
 * ```
 */
export const createSSRRouterContext = async (options: {
  url: string | URL;
  routes: RouteDefinition[];
  base?: string;
  ctx: SSRContext;
}): Promise<{
  route: Route;
  matched: boolean;
  isRedirect: boolean;
  redirectTo?: string;
  data: unknown;
  bindings: Record<string, unknown>;
}> => {
  const resolved = resolveSSRRoute({
    url: options.url,
    routes: options.routes,
    base: options.base,
  });
  const data = resolved.matched ? await runRouteLoaders(resolved.route, options.ctx) : undefined;
  return {
    route: resolved.route,
    matched: resolved.matched,
    isRedirect: resolved.isRedirect,
    redirectTo: resolved.redirectTo,
    data,
    bindings: {
      route: resolved.route,
      params: resolved.route.params,
      query: resolved.route.query,
      data,
    },
  };
};
