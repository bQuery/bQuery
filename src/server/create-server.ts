import { sanitizeHtml } from '../security/index';
import { renderToString, serializeStoreState } from '../ssr/index';
import type {
  CreateServerOptions,
  ServerApp,
  ServerContext,
  ServerHandler,
  ServerHtmlResponseInit,
  ServerMiddleware,
  ServerNext,
  ServerQuery,
  ServerRenderResponseOptions,
  ServerRequestInit,
  ServerResponseInit,
  ServerRoute,
} from './types';

interface CompiledRoute {
  handler: ServerHandler;
  methods: Set<string> | null;
  middlewares: ServerMiddleware[];
  paramNames: string[];
  path: string;
  pattern: RegExp;
}

type PipelineHandler = (context: ServerContext, next: ServerNext) => Response | Promise<Response>;

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

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const query: ServerQuery = {};

  for (const [key, value] of url.searchParams.entries()) {
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

const escapeJsonString = (value: string): string =>
  value.replace(JSON_ESCAPE_PATTERN, (match) => JSON_ESCAPE_LOOKUP[match]);

const createHeaders = (headers?: HeadersInit): Headers => new Headers(headers);

const withContentType = (headers: Headers, contentType: string): Headers => {
  if (!headers.has('content-type')) {
    headers.set('content-type', contentType);
  }
  return headers;
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
  return response(escapeJsonString(JSON.stringify(data ?? null)), { ...init, headers });
};

const redirect = (location: string | URL, status = 302): Response => {
  const headers = createHeaders({ location: location.toString() });
  return response(null, { headers, status });
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

const matchRoute = (route: CompiledRoute, method: string, path: string): Record<string, string> | null => {
  if (route.methods && !route.methods.has(method)) {
    return null;
  }

  const match = route.pattern.exec(path);
  if (!match) {
    return null;
  }

  const params: Record<string, string> = {};
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
  const middlewares = [...(options.middlewares ?? [])];
  const routes: CompiledRoute[] = [];

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

    async handle(input) {
      const request = normalizeRequest(input, baseUrl);
      const url = new URL(request.url);
      const method = request.method.toUpperCase();
      const path = normalizePath(url.pathname || '/');
      const query = parseQuery(url);

      const context: ServerContext = {
        request,
        url,
        method,
        path,
        params: {},
        query,
        state: {},
        response,
        text,
        html,
        json,
        redirect,
        render,
      };

      try {
        const route = routes.find((candidate) => {
          const params = matchRoute(candidate, method, path);
          if (!params) {
            return false;
          }
          context.params = params;
          return true;
        });

        if (!route) {
          return await notFound(context);
        }

        const stack: PipelineHandler[] = [
          ...middlewares,
          ...route.middlewares,
          async (ctx) => await route.handler(ctx),
        ];

        return await runPipeline(context, stack, async () => {
          return await notFound(context);
        });
      } catch (error) {
        return await onError(error, context);
      }
    },
  };

  return app;
};
