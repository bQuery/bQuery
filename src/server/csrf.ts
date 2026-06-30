/**
 * CSRF protection middleware for the server module.
 *
 * Implements the OWASP double-submit-cookie pattern. A per-client secret is
 * stored in a cookie; the matching token must be echoed back in a request header
 * (or form field) on state-changing requests. When a server `secret` is
 * supplied the token is HMAC-signed (signed double-submit), which additionally
 * defends against cookie injection from a sibling subdomain.
 *
 * Pairs with the `security` module: CSRF guards request *integrity* while
 * `sanitizeHtml()` / Trusted Types guard *output*. Use both for defense in depth.
 *
 * @module bquery/server
 */

import { appendSetCookie, serializeCookie } from './cookies';
import { randomToken, signValue, timingSafeEqual, unsignValue } from './crypto';
import { ServerHttpError } from './errors';
import type { ServerCookieOptions, ServerContext, ServerMiddleware } from './types';

/** Options for the {@link csrf} middleware. */
export interface CsrfOptions {
  /**
   * Optional signing secret(s). When provided, tokens are HMAC-signed (signed
   * double-submit). Pass an array to rotate secrets. When omitted, plain
   * double-submit is used (token equals the cookie secret).
   */
  secret?: string | readonly string[];
  /** Cookie name holding the per-client secret. Default `'bq.csrf'`. */
  cookieName?: string;
  /** Request header carrying the token. Default `'x-csrf-token'`. */
  headerName?: string;
  /** Form/JSON body field carrying the token when no header is present. Default `'_csrf'`. */
  fieldName?: string;
  /**
   * Cookie attributes. Defaults to `{ sameSite: 'lax', path: '/' }`. The cookie
   * is readable by client JS by default (plain double-submit); set
   * `httpOnly: true` only when you deliver the token out-of-band (signed mode).
   */
  cookie?: ServerCookieOptions;
  /** HTTP methods that skip verification. Default `['GET', 'HEAD', 'OPTIONS']`. */
  ignoreMethods?: string[];
  /** Custom token extractor, tried before the header and field lookups. */
  getToken?: (ctx: ServerContext) => string | null | undefined | Promise<string | null | undefined>;
}

const DEFAULT_CSRF_COOKIE = 'bq.csrf';
const DEFAULT_HEADER = 'x-csrf-token';
const DEFAULT_FIELD = '_csrf';
const DEFAULT_IGNORE = ['GET', 'HEAD', 'OPTIONS'];

const CSRF_TOKEN_KEY = Symbol('bq.csrf.token');

const normalizeSecrets = (secret: CsrfOptions['secret']): string[] =>
  (secret === undefined ? [] : Array.isArray(secret) ? secret : [secret]).filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

/**
 * Read the CSRF token issued for the current request, suitable for embedding in
 * a form field, `<meta>` tag, or JSON payload. Returns `null` when the
 * {@link csrf} middleware has not run for this request.
 *
 * @example
 * ```ts
 * app.get('/form', (ctx) =>
 *   ctx.html(`<input type="hidden" name="_csrf" value="${csrfToken(ctx)}">`)
 * );
 * ```
 */
export const csrfToken = (ctx: ServerContext): string | null => {
  const value = (ctx.state as Record<PropertyKey, unknown>)[CSRF_TOKEN_KEY];
  return typeof value === 'string' ? value : null;
};

const extractFieldFromBody = async (
  ctx: ServerContext,
  fieldName: string
): Promise<string | null> => {
  const contentType = ctx.request.headers.get('content-type') ?? '';
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const isForm =
    mediaType === 'application/x-www-form-urlencoded' || mediaType === 'multipart/form-data';
  const isJson = mediaType === 'application/json' || mediaType.endsWith('+json');
  if (!isForm && !isJson) {
    return null;
  }

  let body: unknown;
  try {
    body = await ctx.body();
  } catch {
    return null;
  }

  if (body instanceof Map) {
    const value = body.get(fieldName);
    return typeof value === 'string' ? value : null;
  }
  if (body && typeof body === 'object') {
    const value = (body as Record<string, unknown>)[fieldName];
    return typeof value === 'string' ? value : null;
  }
  return null;
};

const extractToken = async (
  ctx: ServerContext,
  options: Required<Pick<CsrfOptions, 'headerName' | 'fieldName'>> & Pick<CsrfOptions, 'getToken'>
): Promise<string | null> => {
  if (options.getToken) {
    const custom = await options.getToken(ctx);
    if (typeof custom === 'string' && custom.length > 0) {
      return custom;
    }
  }
  const header = ctx.request.headers.get(options.headerName);
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return extractFieldFromBody(ctx, options.fieldName);
};

/**
 * Middleware that enforces CSRF protection via the double-submit-cookie pattern.
 *
 * Safe requests (GET/HEAD/OPTIONS by default) mint a per-client secret cookie
 * and expose the matching token through {@link csrfToken}. State-changing
 * requests must echo that token back in the `x-csrf-token` header or a `_csrf`
 * body field, or they are rejected with `403`.
 *
 * @example
 * ```ts
 * import { createServer, csrf } from '@bquery/bquery/server';
 *
 * const app = createServer();
 * app.use(csrf({ secret: process.env.SECRET! }));
 * ```
 */
export const csrf = (options: CsrfOptions = {}): ServerMiddleware => {
  const secrets = normalizeSecrets(options.secret);
  // Fail loud on a provided-but-empty secret (e.g. an unset `CSRF_SECRET` env
  // resolving to '') instead of silently downgrading to unsigned double-submit,
  // which would leave the app weaker than the author intended. Omitting
  // `secret` entirely is still the supported way to opt into unsigned mode.
  if (options.secret !== undefined && secrets.length === 0) {
    throw new Error(
      'bQuery server: csrf() received a `secret` with no usable non-empty string value. ' +
        'Omit `secret` for unsigned double-submit, or pass a non-empty secret.'
    );
  }
  const signed = secrets.length > 0;
  const cookieName = options.cookieName ?? DEFAULT_CSRF_COOKIE;
  const headerName = options.headerName ?? DEFAULT_HEADER;
  const fieldName = options.fieldName ?? DEFAULT_FIELD;
  const ignoreMethods = new Set(
    (options.ignoreMethods ?? DEFAULT_IGNORE).map((method) => method.toUpperCase())
  );
  const baseCookie: ServerCookieOptions = {
    sameSite: 'lax',
    path: '/',
    ...options.cookie,
  };

  const tokenFor = async (secret: string): Promise<string> =>
    signed ? signValue(secret, secrets[0]) : secret;

  const secretFromToken = async (token: string): Promise<string | null> =>
    signed ? unsignValue(token, secrets) : token;

  return async (ctx: ServerContext, next) => {
    let secret = ctx.cookies[cookieName];
    let issueCookie = false;
    if (typeof secret !== 'string' || secret.length === 0) {
      secret = randomToken();
      issueCookie = true;
    }

    (ctx.state as Record<PropertyKey, unknown>)[CSRF_TOKEN_KEY] = await tokenFor(secret);

    if (!ignoreMethods.has(ctx.method)) {
      const submitted = await extractToken(ctx, {
        headerName,
        fieldName,
        getToken: options.getToken,
      });
      const recovered = submitted ? await secretFromToken(submitted) : null;
      if (recovered === null || !timingSafeEqual(recovered, secret)) {
        throw new ServerHttpError(403, 'Invalid or missing CSRF token.');
      }
    }

    const response = await next();
    if (issueCookie) {
      return appendSetCookie(response, serializeCookie(cookieName, secret, baseCookie));
    }
    return response;
  };
};
