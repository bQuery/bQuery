/**
 * Minimal authentication helpers for the server module.
 *
 * These are deliberately small primitives — credential-verification hooks, not a
 * turnkey identity provider. Each parses an `Authorization` header, delegates the
 * actual credential check to a user-supplied `verify` callback, and stores the
 * resolved user on `ctx.state` for downstream handlers and {@link guard}s.
 *
 * @module bquery/server
 */

import { base64UrlDecode } from './crypto';
import type { ServerContext, ServerMiddleware } from './types';

const DEFAULT_STATE_KEY = 'user';

/** Username/password pair parsed from a Basic `Authorization` header. */
export interface BasicAuthCredentials {
  username: string;
  password: string;
}

/** Options for {@link basicAuth}. */
export interface BasicAuthOptions {
  /**
   * Verify the supplied credentials. Return a truthy user object to authenticate
   * (stored on `ctx.state[stateKey]`), or a falsy value to reject with `401`.
   */
  verify: (credentials: BasicAuthCredentials, ctx: ServerContext) => unknown | Promise<unknown>;
  /** Realm advertised in the `WWW-Authenticate` challenge. Default `'Restricted'`. */
  realm?: string;
  /** `ctx.state` key the resolved user is written to. Default `'user'`. */
  stateKey?: string;
}

/** Options for {@link bearerAuth}. */
export interface BearerAuthOptions {
  /**
   * Verify the bearer token. Return a truthy user/principal to authenticate, or
   * a falsy value to reject with `401`.
   */
  verify: (token: string, ctx: ServerContext) => unknown | Promise<unknown>;
  /** `ctx.state` key the resolved principal is written to. Default `'user'`. */
  stateKey?: string;
  /** Authentication scheme name. Default `'Bearer'`. */
  scheme?: string;
}

const sanitizeRealm = (realm: string): string => realm.replace(/["\r\n]/g, '');

/**
 * HTTP Basic authentication middleware.
 *
 * @example
 * ```ts
 * app.use(basicAuth({ verify: ({ username, password }) => username === 'admin' && password === secret }));
 * ```
 */
export const basicAuth = (options: BasicAuthOptions): ServerMiddleware => {
  const realm = sanitizeRealm(options.realm ?? 'Restricted');
  const stateKey = options.stateKey ?? DEFAULT_STATE_KEY;

  return async (ctx, next) => {
    const challenge = (): Response =>
      ctx.text('Unauthorized', {
        status: 401,
        headers: { 'www-authenticate': `Basic realm="${realm}", charset="UTF-8"` },
      });

    const header = ctx.request.headers.get('authorization') ?? '';
    const separator = header.indexOf(' ');
    const scheme = separator === -1 ? header : header.slice(0, separator);
    const encoded = separator === -1 ? '' : header.slice(separator + 1).trim();
    if (scheme.toLowerCase() !== 'basic' || !encoded) {
      return challenge();
    }

    const bytes = base64UrlDecode(encoded);
    if (!bytes) {
      return challenge();
    }
    const decoded = new TextDecoder().decode(bytes);
    const colon = decoded.indexOf(':');
    if (colon === -1) {
      return challenge();
    }

    const credentials: BasicAuthCredentials = {
      username: decoded.slice(0, colon),
      password: decoded.slice(colon + 1),
    };
    const user = await options.verify(credentials, ctx);
    if (!user) {
      return challenge();
    }

    ctx.state[stateKey] = user === true ? { username: credentials.username } : user;
    return next();
  };
};

/**
 * HTTP Bearer-token authentication middleware.
 *
 * @example
 * ```ts
 * app.use(bearerAuth({ verify: (token) => verifyJwt(token) }));
 * ```
 */
export const bearerAuth = (options: BearerAuthOptions): ServerMiddleware => {
  const stateKey = options.stateKey ?? DEFAULT_STATE_KEY;
  const scheme = options.scheme ?? 'Bearer';

  return async (ctx, next) => {
    const challenge = (): Response =>
      ctx.text('Unauthorized', {
        status: 401,
        headers: { 'www-authenticate': scheme },
      });

    const header = ctx.request.headers.get('authorization') ?? '';
    const separator = header.indexOf(' ');
    const headerScheme = separator === -1 ? header : header.slice(0, separator);
    const token = separator === -1 ? '' : header.slice(separator + 1).trim();
    if (headerScheme.toLowerCase() !== scheme.toLowerCase() || !token) {
      return challenge();
    }

    const user = await options.verify(token, ctx);
    if (!user) {
      return challenge();
    }

    ctx.state[stateKey] = user === true ? { token } : user;
    return next();
  };
};
