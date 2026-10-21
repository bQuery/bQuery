/**
 * SSR dev middleware for the Vite dev server.
 *
 * For HTML navigations it loads the configured server entry through
 * `server.ssrLoadModule()` (so edits apply without a restart), calls its render
 * export with a Web `Request`, pipes HTML results through
 * `server.transformIndexHtml()` (Vite client, CSP nonces, other plugins) and
 * writes the response. Errors are source-mapped with `server.ssrFixStacktrace()`
 * and handed to Vite's error overlay.
 *
 * @module @bquery/unplugin/ssr
 */

import path from 'node:path';
import { acceptsHtml } from './csp.js';
import { readTextIfExists } from './utils.js';

/** Default server entry (relative to the project root). */
export const DEFAULT_SSR_ENTRY = 'src/entry-server.ts';

/** Headers that must not be copied from a buffered `Response`. */
const DROPPED_HEADERS = new Set(['content-length', 'content-encoding', 'transfer-encoding']);

/**
 * Whether the middleware should try to render this request.
 *
 * @param {any} req - Node request.
 * @param {URL} url - Parsed original URL.
 * @returns {boolean} Whether it is an HTML navigation the entry should handle.
 */
const isNavigation = (req, url) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (!acceptsHtml(req)) return false;
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/__')) return false;
  const ext = path.posix.extname(url.pathname);
  return ext === '' || ext === '.html';
};

/**
 * Converts Node request headers into a `Headers` instance.
 *
 * @param {Record<string, string | string[] | undefined>} raw - Node headers.
 * @returns {Headers} Web headers.
 */
const toHeaders = (raw) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw ?? {})) {
    if (value === undefined || name.startsWith(':')) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else headers.set(name, String(value));
  }
  return headers;
};

/** Duck-typed `Response` check (works across module-runner realms). */
const isResponse = (value) =>
  value !== null &&
  typeof value === 'object' &&
  typeof value.status === 'number' &&
  typeof value.headers?.get === 'function' &&
  typeof value.text === 'function';

/**
 * Writes a `Response` body to a Node response, streaming when possible.
 *
 * @param {Response} response - The Web response.
 * @param {any} res - Node response.
 * @param {boolean} head - Whether the request was `HEAD`.
 */
const pipeResponse = async (response, res, head) => {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') res.setHeader(name, value);
  });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
  if (head || !response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
};

/**
 * Creates the `bquery:ssr` plugin (Vite only).
 *
 * @param {object} options - SSR options (see `SsrOptions` in `index.d.ts`).
 * @param {{ root: string, getNonce?: () => string | undefined }} shared - Shared state.
 * @returns {import('unplugin').UnpluginOptions} The plugin.
 */
export const createSsrPlugin = (options, shared) => {
  const exportName = options.export ?? 'render';
  const transformHtml = options.transformHtml !== false;

  const handle = async (server, req, res, next) => {
    const originalUrl = req.originalUrl ?? req.url ?? '/';
    const protocol = server.config?.server?.https ? 'https' : 'http';
    const url = new URL(originalUrl, `${protocol}://${req.headers.host ?? 'localhost'}`);
    if (!isNavigation(req, url) || (options.filter && !options.filter(url, req))) return next();

    try {
      const templateFile =
        options.template === false
          ? null
          : path.resolve(shared.root, options.template ?? 'index.html');
      const template = templateFile ? ((await readTextIfExists(templateFile)) ?? '') : '';
      const entry = path.resolve(shared.root, options.entry ?? DEFAULT_SSR_ENTRY);
      const mod = await server.ssrLoadModule(entry);
      const render = mod[exportName];
      if (typeof render !== 'function') {
        throw new Error(
          `[bquery:ssr] ${options.entry ?? DEFAULT_SSR_ENTRY} must export a "${exportName}" function.`
        );
      }

      const request = new Request(url, { method: req.method, headers: toHeaders(req.headers) });
      const result = await render(request, {
        url,
        template,
        nonce: shared.getNonce?.(),
        dev: true,
        server,
      });
      if (result === null || result === undefined) return next();

      const transform = (html) =>
        transformHtml
          ? server.transformIndexHtml(req.url ?? url.pathname, html, originalUrl)
          : html;

      if (typeof result === 'string') {
        const html = await transform(result);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(req.method === 'HEAD' ? undefined : html);
        return;
      }

      if (!isResponse(result)) {
        throw new TypeError(
          `[bquery:ssr] "${exportName}" must return a string, a Response, or null/undefined.`
        );
      }

      const contentType = result.headers.get('content-type') ?? '';
      if (contentType.includes('text/html') && transformHtml) {
        const html = await transform(await result.text());
        res.statusCode = result.status;
        result.headers.forEach((value, name) => {
          if (!DROPPED_HEADERS.has(name) && name !== 'set-cookie') res.setHeader(name, value);
        });
        const cookies = result.headers.getSetCookie?.() ?? [];
        if (cookies.length > 0) res.setHeader('set-cookie', cookies);
        res.end(req.method === 'HEAD' ? undefined : html);
        return;
      }
      await pipeResponse(result, res, req.method === 'HEAD');
    } catch (error) {
      if (error instanceof Error) server.ssrFixStacktrace?.(error);
      next(error);
    }
  };

  return {
    name: 'bquery:ssr',
    vite: {
      configureServer(server) {
        // Returned function = installed after Vite's internal middlewares
        // (static files, module transforms) but before its HTML fallback.
        return () => {
          server.middlewares.use((req, res, next) => {
            void handle(server, req, res, next);
          });
        };
      },
    },
  };
};
