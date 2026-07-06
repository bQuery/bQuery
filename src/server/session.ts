/**
 * First-party session primitives for the server module.
 *
 * Signed cookie sessions backed by a pluggable store. The session id is stored
 * in an HMAC-signed cookie (see {@link signValue}); the payload lives in the
 * store, so the cookie never exposes session data and tampered cookies are
 * rejected. The default {@link memoryStore} is process-local; bring your own
 * store (Redis, a database, etc.) by implementing {@link SessionStore} — no
 * client is bundled.
 *
 * @module bquery/server
 */

import { isPrototypePollutionKey } from '../core/utils/object';
import { appendSetCookie, serializeCookie } from './cookies';
import { randomId, signValue, unsignValue } from './crypto';
import type { ServerCookieOptions, ServerContext, ServerMiddleware, ServerSession } from './types';

/** Arbitrary, JSON-serializable session payload. */
export interface SessionData {
  [key: string]: unknown;
}

/**
 * Pluggable session store. Implementations may be synchronous or async; all
 * methods are awaited. Provide your own to back sessions with Redis, a database,
 * or any other system without bundling a client.
 */
export interface SessionStore {
  /** Load a session payload by id, or `null` when missing/expired. */
  get(id: string): Promise<SessionData | null> | SessionData | null;
  /** Persist a session payload, optionally with a time-to-live in milliseconds. */
  set(id: string, data: SessionData, ttlMs?: number): Promise<void> | void;
  /** Remove a session by id. */
  destroy(id: string): Promise<void> | void;
  /** Optionally extend a session's lifetime without rewriting its payload. */
  touch?(id: string, ttlMs?: number): Promise<void> | void;
}

/** Options for {@link memoryStore}. */
export interface MemoryStoreOptions {
  /** Default time-to-live in milliseconds. Omit for non-expiring entries. */
  ttlMs?: number;
  /**
   * Maximum number of stored sessions. When exceeded, the oldest entries are
   * evicted (insertion order). Omit for unbounded growth.
   */
  maxEntries?: number;
}

/** Options for the {@link session} middleware. */
export interface SessionOptions {
  /**
   * Secret(s) used to sign the session-id cookie. Pass an array to rotate
   * secrets: signing always uses the first, verification accepts any.
   */
  secret: string | readonly string[];
  /** Session store. Defaults to a process-local {@link memoryStore}. */
  store?: SessionStore;
  /** Cookie name. Default `'bq.sid'`. */
  cookieName?: string;
  /**
   * Cookie attributes. Defaults to
   * `{ httpOnly: true, sameSite: 'lax', path: '/', secure: true }`.
   * `secure` defaults to `true` (session credential must not travel over
   * plaintext HTTP); set `secure: false` for local HTTP dev. `maxAge` is
   * derived from `ttlMs`.
   */
  cookie?: ServerCookieOptions;
  /** Session lifetime in milliseconds. Default `86_400_000` (1 day). */
  ttlMs?: number;
  /** Re-issue the cookie and extend the lifetime on every response. Default `false`. */
  rolling?: boolean;
  /** Custom session-id generator. Defaults to {@link randomId}. */
  genId?: () => string;
}

const DEFAULT_SESSION_COOKIE = 'bq.sid';
const DEFAULT_SESSION_TTL_MS = 86_400_000;

const normalizeSecrets = (secret: SessionOptions['secret']): string[] => {
  const secrets = (Array.isArray(secret) ? secret : [secret]).filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  if (secrets.length === 0) {
    throw new Error('session(): at least one non-empty secret is required.');
  }
  return secrets;
};

/**
 * In-memory session store. Suitable for development and single-instance
 * deployments; use a shared store for multi-instance production.
 */
export const memoryStore = (options: MemoryStoreOptions = {}): SessionStore => {
  const entries = new Map<string, { data: SessionData; expires: number }>();
  const isLive = (entry: { expires: number }): boolean =>
    entry.expires === 0 || entry.expires > Date.now();
  const expiry = (ttlMs?: number): number => {
    const ttl = ttlMs ?? options.ttlMs;
    return typeof ttl === 'number' && Number.isFinite(ttl) && ttl > 0 ? Date.now() + ttl : 0;
  };

  return {
    get(id) {
      const entry = entries.get(id);
      if (!entry) {
        return null;
      }
      if (!isLive(entry)) {
        entries.delete(id);
        return null;
      }
      return { ...entry.data };
    },
    set(id, data, ttlMs) {
      entries.delete(id);
      entries.set(id, { data: { ...data }, expires: expiry(ttlMs) });
      if (
        typeof options.maxEntries === 'number' &&
        options.maxEntries > 0 &&
        entries.size > options.maxEntries
      ) {
        const oldest = entries.keys().next().value;
        if (typeof oldest === 'string') {
          entries.delete(oldest);
        }
      }
    },
    destroy(id) {
      entries.delete(id);
    },
    touch(id, ttlMs) {
      const entry = entries.get(id);
      if (entry && isLive(entry)) {
        entry.expires = expiry(ttlMs);
      }
    },
  };
};

interface SessionController {
  session: ServerSession;
  finalize(): {
    id: string | null;
    data: SessionData;
    dirty: boolean;
    destroyed: boolean;
    destroyIds: string[];
  };
}

const createSessionController = (
  initialId: string | null,
  initialData: SessionData,
  genId: () => string
): SessionController => {
  const data: SessionData = Object.create(null) as SessionData;
  for (const [key, value] of Object.entries(initialData)) {
    if (!isPrototypePollutionKey(key)) {
      data[key] = value;
    }
  }

  let id = initialId;
  const isNew = initialId === null;
  let dirty = false;
  let destroyed = false;
  const destroyIds = new Set<string>();

  const ensureId = (): string => {
    if (id === null) {
      id = genId();
    }
    return id;
  };
  const markDirty = (): void => {
    if (destroyed) {
      // A write after $destroy() starts a fresh session: the destroyed id is
      // already scheduled for removal, so mint a new one rather than reviving it.
      destroyed = false;
      id = null;
    }
    dirty = true;
    ensureId();
  };

  const session = new Proxy(data, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string') {
        return Reflect.get(target, prop, receiver);
      }
      switch (prop) {
        case '$id':
          return id;
        case '$isNew':
          return isNew;
        case '$data':
          return { ...data };
        case '$regenerate':
          return (): void => {
            if (id !== null) {
              destroyIds.add(id);
            }
            id = genId();
            dirty = true;
          };
        case '$destroy':
          return (): void => {
            for (const key of Object.keys(data)) {
              delete data[key];
            }
            if (id !== null) {
              destroyIds.add(id);
            }
            destroyed = true;
            dirty = false;
          };
        case '$clear':
          return (): void => {
            for (const key of Object.keys(data)) {
              delete data[key];
            }
            markDirty();
          };
        default:
          return data[prop];
      }
    },
    set(_target, prop, value) {
      if (typeof prop !== 'string') {
        return false;
      }
      if (prop.startsWith('$')) {
        throw new TypeError(`session: "${prop}" is a reserved member and cannot be assigned.`);
      }
      if (isPrototypePollutionKey(prop)) {
        return true;
      }
      data[prop] = value;
      markDirty();
      return true;
    },
    deleteProperty(_target, prop) {
      if (typeof prop === 'string' && prop in data) {
        delete data[prop];
        markDirty();
      }
      return true;
    },
    has(_target, prop) {
      return typeof prop === 'string' && prop in data;
    },
    ownKeys() {
      return Reflect.ownKeys(data);
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'string' && prop in data) {
        return { configurable: true, enumerable: true, value: data[prop], writable: true };
      }
      return undefined;
    },
  }) as ServerSession;

  return {
    session,
    finalize: () => ({
      id,
      data,
      dirty,
      destroyed,
      destroyIds: [...destroyIds],
    }),
  };
};

/**
 * Middleware that loads, exposes, and persists a request-scoped session.
 *
 * The session is exposed as {@link ServerContext.session} (`ctx.session`). Reads
 * and writes happen through plain properties; lifecycle calls use `$`-prefixed
 * members. The session id cookie is HMAC-signed and the payload is stored
 * server-side, so the cookie carries no session data and tampering is rejected.
 *
 * @example
 * ```ts
 * import { createServer, session, memoryStore } from '@bquery/bquery/server';
 *
 * const app = createServer();
 * app.use(session({ secret: process.env.SECRET!, store: memoryStore() }));
 * app.post('/login', (ctx) => {
 *   ctx.session.userId = 'u_123';
 *   return ctx.json({ ok: true });
 * });
 * ```
 */
export const session = (options: SessionOptions): ServerMiddleware => {
  const secrets = normalizeSecrets(options.secret);
  const store = options.store ?? memoryStore({ ttlMs: options.ttlMs ?? DEFAULT_SESSION_TTL_MS });
  const cookieName = options.cookieName ?? DEFAULT_SESSION_COOKIE;
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const rolling = options.rolling ?? false;
  const genId = options.genId ?? randomId;
  const baseCookie: ServerCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    ...options.cookie,
    // The session cookie is the sole bearer credential, so default `Secure`
    // to keep it off plaintext HTTP. Opt out explicitly (`secure: false`) for
    // local HTTP dev.
    secure: options.cookie?.secure ?? true,
  };
  const maxAge = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.floor(ttlMs / 1000) : undefined;

  return async (ctx: ServerContext, next) => {
    const rawCookie = ctx.cookies[cookieName];
    const hadCookie = typeof rawCookie === 'string' && rawCookie.length > 0;
    let loadedId: string | null = null;
    let loadedData: SessionData = {};

    if (hadCookie) {
      const verified = await unsignValue(rawCookie, secrets);
      if (verified) {
        const stored = await store.get(verified);
        if (stored) {
          loadedId = verified;
          loadedData = stored;
        }
      }
    }

    const controller = createSessionController(loadedId, loadedData, genId);
    ctx.session = controller.session;

    const response = await next();

    const result = controller.finalize();
    for (const oldId of result.destroyIds) {
      await store.destroy(oldId);
    }

    if (result.destroyed) {
      if (hadCookie) {
        return appendSetCookie(
          response,
          serializeCookie(cookieName, '', { ...baseCookie, maxAge: 0 })
        );
      }
      return response;
    }

    if (result.dirty && result.id !== null) {
      await store.set(result.id, result.data, ttlMs);
      const signed = await signValue(result.id, secrets[0]);
      return appendSetCookie(
        response,
        serializeCookie(cookieName, signed, { ...baseCookie, maxAge })
      );
    }

    if (rolling && result.id !== null) {
      if (typeof store.touch === 'function') {
        await store.touch(result.id, ttlMs);
      } else {
        await store.set(result.id, result.data, ttlMs);
      }
      const signed = await signValue(result.id, secrets[0]);
      return appendSetCookie(
        response,
        serializeCookie(cookieName, signed, { ...baseCookie, maxAge })
      );
    }

    return response;
  };
};
