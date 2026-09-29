/**
 * CSRF protection middleware for the server module.
 *
 * Implements the OWASP double-submit-cookie pattern. A per-client secret is
 * stored in a cookie; the matching token must be echoed back in a request header
 * (or form field) on state-changing requests. When a server `secret` is
 * supplied the token is HMAC-signed (signed double-submit).
 *
 * Signing alone does not stop cookie injection: an attacker who can set a
 * cookie for the victim (a sibling subdomain, or a MITM on a non-`__Host-`
 * cookie) plants the secret from a validly signed pair minted for themselves.
 * So in signed mode, when the `session()` middleware runs first and the request
 * carries a stored session, the secret is kept in that session instead of a
 * cookie (synchronizer token), which binds the token to the session and leaves
 * nothing to inject. Visitors without a session keep the signed cookie.
 *
 * Pairs with the `security` module: CSRF guards request *integrity* while
 * `sanitizeHtml()` / Trusted Types guard *output*. Use both for defense in depth.
 *
 * @module bquery/server
 */

import { appendSetCookie, serializeCookie } from './cookies';
import { randomToken, signValue, timingSafeEqual, unsignValue } from './crypto';
import { ServerHttpError } from './errors';
import type {
  ServerCookieOptions,
  ServerContext,
  ServerMiddleware,
  ServerNext,
  ServerSession,
} from './types';

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
   * Cookie attributes. Defaults to `{ sameSite: 'lax', path: '/', secure: true }`.
   * The cookie is readable by client JS by default (plain double-submit); set
   * `httpOnly: true` only when you deliver the token out-of-band (signed mode).
   * `secure` defaults to `true` (in signed mode the token embeds the raw
   * secret); set `secure: false` for local HTTP dev.
   */
  cookie?: ServerCookieOptions;
  /** HTTP methods that skip verification. Default `['GET', 'HEAD', 'OPTIONS']`. */
  ignoreMethods?: string[];
  /** Custom token extractor, tried before the header and field lookups. */
  getToken?: (ctx: ServerContext) => string | null | undefined | Promise<string | null | undefined>;
  /**
   * In signed mode (`secret` set), keep the CSRF secret in `ctx.session`
   * instead of a cookie whenever the `session()` middleware ran first. This
   * binds tokens to the session, which the cookie cannot do. Requests that
   * arrive without a stored session use the signed cookie instead, so
   * anonymous traffic never creates sessions; a session created while
   * handling such a request adopts the cookie secret.
   * `$regenerate()` (e.g. on login) invalidates the secret; pages rendered
   * afterwards receive a fresh token.
   * Default `true`; set `false` to keep the cookie-based signed double-submit.
   */
  bindToSession?: boolean;
}

const DEFAULT_CSRF_COOKIE = 'bq.csrf';
const DEFAULT_HEADER = 'x-csrf-token';
const DEFAULT_FIELD = '_csrf';
const DEFAULT_IGNORE = ['GET', 'HEAD', 'OPTIONS'];

const CSRF_TOKEN_KEY = Symbol('bq.csrf.token');

/** Session payload key holding the CSRF secret in session-bound mode. */
const CSRF_SESSION_FIELD = '__bqCsrf';

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
  // Session-bound mode stores a provider so the secret is only persisted into
  // the session when a token is actually handed out.
  const token = typeof value === 'function' ? (value as () => unknown)() : value;
  return typeof token === 'string' ? token : null;
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
    // In signed mode the token embeds the raw secret, so default `Secure` to
    // keep it off plaintext HTTP. Opt out explicitly for local HTTP dev.
    secure: options.cookie?.secure ?? true,
  };

  const tokenFor = async (secret: string): Promise<string> =>
    signed ? signValue(secret, secrets[0]) : secret;

  const secretFromToken = async (token: string): Promise<string | null> =>
    signed ? unsignValue(token, secrets) : token;

  const bindToSession = options.bindToSession ?? true;

  const readToken = (ctx: ServerContext): Promise<string | null> =>
    extractToken(ctx, { headerName, fieldName, getToken: options.getToken });

  /**
   * Session-bound mode. A request that arrives with a stored session keeps its
   * secret in that session. A request without one uses the signed cookie, as
   * in unbound mode: writing a secret into a session for every anonymous
   * visitor would let cookieless requests fill (and, with a capped store,
   * evict real sessions from) the session store.
   */
  const sessionBound = async (
    ctx: ServerContext,
    session: ServerSession,
    next: ServerNext
  ): Promise<Response> => {
    // The secret is stored together with the session id it was minted for.
    // `$regenerate()` keeps the payload but changes the id, so a secret from
    // before a login no longer matches afterwards: otherwise an attacker who
    // planted a session cookie (fixation) would already know the CSRF secret
    // of the session the victim logs into.
    const readSecret = (): string | null => {
      const value = session[CSRF_SESSION_FIELD] as { secret?: unknown; sid?: unknown } | undefined;
      if (!value || typeof value !== 'object') return null;
      const { secret, sid } = value;
      return typeof secret === 'string' && secret.length > 0 && sid === session.$id ? secret : null;
    };
    const bindSecret = (secret: string): string => {
      // The first write assigns an id to a brand-new session; record the
      // secret against that id with the second.
      session[CSRF_SESSION_FIELD] = { secret, sid: null };
      session[CSRF_SESSION_FIELD] = { secret, sid: session.$id };
      return secret;
    };

    const stored = session.$id !== null;
    let cookieSecret = stored ? undefined : ctx.cookies[cookieName];
    let issueCookie = false;
    if (stored) {
      // Bind before the handler runs so that a token read late (a streamed
      // render that calls `csrfToken()` after the session was persisted) is
      // one the session already holds.
      if (readSecret() === null) bindSecret(randomToken());
    } else if (typeof cookieSecret !== 'string' || cookieSecret.length === 0) {
      cookieSecret = randomToken();
      issueCookie = true;
    }

    const cookieToken = stored ? null : await tokenFor(cookieSecret as string);
    // The session secret never leaves the server except as the token itself,
    // so it is handed out as is; only the cookie secret needs a signature.
    (ctx.state as Record<PropertyKey, unknown>)[CSRF_TOKEN_KEY] = (): string | null => {
      if (session.$id === null) return cookieToken;
      // A session created during this request adopts the cookie secret, so a
      // token handed out before the first session write stays valid.
      return readSecret() ?? bindSecret(stored ? randomToken() : (cookieSecret as string));
    };

    if (!ignoreMethods.has(ctx.method)) {
      const submitted = await readToken(ctx);
      let valid = false;
      if (submitted && stored) {
        const expected = readSecret();
        if (expected !== null) {
          // A session that adopted a cookie secret also accepts the signed
          // cookie token handed out before the session existed.
          const recovered = timingSafeEqual(submitted, expected)
            ? expected
            : await secretFromToken(submitted);
          valid = recovered !== null && timingSafeEqual(recovered, expected);
        }
      } else if (submitted && !issueCookie) {
        const recovered = await secretFromToken(submitted);
        valid = recovered !== null && timingSafeEqual(recovered, cookieSecret as string);
      }
      if (!valid) {
        throw new ServerHttpError(403, 'Invalid or missing CSRF token.');
      }
    }

    const response = await next();
    // A session the handler created: bind the cookie secret while the session
    // is still being persisted, so its forms verify against the session next.
    if (!stored && session.$id !== null && readSecret() === null) {
      bindSecret(cookieSecret as string);
    }
    if (issueCookie) {
      return appendSetCookie(
        response,
        serializeCookie(cookieName, cookieSecret as string, baseCookie)
      );
    }
    return response;
  };

  return async (ctx: ServerContext, next) => {
    const session = signed && bindToSession ? ctx.session : undefined;
    if (session) {
      return sessionBound(ctx, session, next);
    }

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
