/**
 * Rate limiting middleware for the server module.
 *
 * No throttling primitive existed server-side, so any public endpoint was
 * unprotected against brute force by default — including the login route in
 * the docs' own `login-form` recipe (#223). (`createRequestQueue` in
 * `reactive` is the client-side mirror image: it limits outgoing parallel
 * requests, not incoming ones.)
 *
 * Counters live in a {@link SessionStore}, the same abstraction sessions use,
 * so a Redis-backed store plugs in here exactly as it does there — which is
 * what makes the limit hold across more than one process.
 *
 * @module bquery/server
 */

import { memoryStore } from './session';
import type { SessionData, SessionStore } from './session';
import type { ServerContext, ServerHandler, ServerMiddleware } from './types';

/** Headers a proxy may use to report the originating client, in priority order. */
const FORWARDED_HEADERS = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip'];

/** Options for {@link rateLimit}. */
export interface RateLimitOptions {
  /** Length of the counting window in milliseconds. */
  window: number;

  /** Requests allowed per key per window. */
  max: number;

  /**
   * Identity the limit is counted against — usually a client address, a
   * session id or a user id. Return `null` to skip the limit for a request.
   *
   * Required unless {@link RateLimitOptions.trustProxy} is set; see the note
   * on that option for why there is no safe default.
   */
  keyBy?: (ctx: ServerContext) => string | null | Promise<string | null>;

  /**
   * Derive the key from a forwarding header (`X-Forwarded-For` and friends)
   * when no `keyBy` is given.
   *
   * Off by default, and deliberately not the default behaviour: those headers
   * are set by the client unless a proxy you control overwrites them. Keying
   * on a spoofable value gives a limiter that is trivially bypassed with a
   * random header per request — worse than no limiter, because it looks like
   * protection. Only enable this behind a proxy that overwrites the header.
   */
  trustProxy?: boolean;

  /**
   * Where counters are kept. Defaults to a process-local {@link memoryStore},
   * which only limits per process — pass a shared store for more than one.
   */
  store?: SessionStore;

  /** Prefix for store keys, so counters cannot collide with sessions. Default: `'rl:'`. */
  prefix?: string;

  /** Emit `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`. Default: `true`. */
  headers?: boolean;

  /** Status for a rejected request. Default: `429`. */
  status?: number;

  /** Body for the default rejection response. Default: `'Too Many Requests'`. */
  message?: string;

  /** Skip the limit entirely for a request, without consuming budget. */
  skip?: (ctx: ServerContext) => boolean | Promise<boolean>;

  /**
   * Handle a rejected request yourself. Overrides `status`/`message`; the
   * `RateLimit-*` and `Retry-After` headers are still applied to whatever it
   * returns.
   */
  onLimit?: ServerHandler;

  /** Do not count requests that ended in a 2xx/3xx response. Default: `false`. */
  skipSuccessfulRequests?: boolean;
}

/** The state of the limit for one key, as reported to a caller. */
export interface RateLimitState {
  /** Requests allowed per window. */
  limit: number;
  /**
   * Requests made in the current window, including this one. Unlike
   * `remaining` this is not clamped, so it still distinguishes "exactly at the
   * limit" from "well past it".
   */
  count: number;
  /** Requests left in the current window, never below zero. */
  remaining: number;
  /** Epoch milliseconds at which the current window ends. */
  resetAt: number;
  /** Seconds until the window ends, rounded up and at least one. */
  resetSeconds: number;
}

interface CounterRecord extends SessionData {
  count: number;
  resetAt: number;
}

const isCounter = (value: SessionData | null): value is CounterRecord =>
  value !== null &&
  typeof value.count === 'number' &&
  typeof value.resetAt === 'number' &&
  Number.isFinite(value.count) &&
  Number.isFinite(value.resetAt);

/**
 * Read the first address from a forwarding header chain.
 *
 * `X-Forwarded-For` accumulates left to right, so the leftmost entry is the
 * originating client as reported by the first proxy in the chain.
 * @internal
 */
export const forwardedAddress = (ctx: ServerContext): string | null => {
  for (const header of FORWARDED_HEADERS) {
    const value = ctx.request.headers.get(header);
    if (!value) continue;
    const first = value.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
};

/**
 * Advance the counter for a key and report the resulting state.
 *
 * The window is fixed, not sliding: the first request of a window sets
 * `resetAt`, and the counter resets wholesale when that passes. A sliding
 * window would need per-request timestamps in the store, which is a much
 * larger write amplification for a limiter whose job is to be cheap.
 * @internal
 */
export const consume = async (
  store: SessionStore,
  key: string,
  max: number,
  window: number,
  now: number
): Promise<RateLimitState> => {
  const existing = await store.get(key);
  const record: CounterRecord =
    isCounter(existing) && existing.resetAt > now
      ? { count: existing.count + 1, resetAt: existing.resetAt }
      : { count: 1, resetAt: now + window };

  await store.set(key, record, Math.max(1, record.resetAt - now));

  return {
    limit: max,
    count: record.count,
    remaining: Math.max(0, max - record.count),
    resetAt: record.resetAt,
    resetSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
};

/** Apply the `RateLimit-*` headers to a response, preserving its body. @internal */
export const withRateLimitHeaders = (
  response: Response,
  state: RateLimitState,
  includeRetryAfter: boolean
): Response => {
  const headers = new Headers(response.headers);
  headers.set('ratelimit-limit', String(state.limit));
  headers.set('ratelimit-remaining', String(state.remaining));
  headers.set('ratelimit-reset', String(state.resetSeconds));
  if (includeRetryAfter) headers.set('retry-after', String(state.resetSeconds));

  // A 304 or 204 must stay body-less, and `Response` rejects a body for those.
  return new Response(response.status === 204 || response.status === 304 ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/**
 * Create middleware that rejects a key's requests once it exceeds `max` in
 * each `window`.
 *
 * @example Protect a login route
 * ```ts
 * import { createServer, rateLimit } from '@bquery/bquery/server';
 *
 * const app = createServer();
 * const loginLimit = rateLimit({
 *   window: 15 * 60_000,
 *   max: 5,
 *   keyBy: (ctx) => ctx.session?.$id ?? null,
 * });
 *
 * app.post('/login', handleLogin, [loginLimit]);
 * ```
 *
 * @example Behind a proxy that overwrites `X-Forwarded-For`
 * ```ts
 * app.use(rateLimit({ window: 60_000, max: 100, trustProxy: true }));
 * ```
 */
export const rateLimit = (options: RateLimitOptions): ServerMiddleware => {
  const {
    window,
    max,
    keyBy,
    trustProxy = false,
    store = memoryStore(),
    prefix = 'rl:',
    headers: emitHeaders = true,
    status = 429,
    message = 'Too Many Requests',
    skip,
    onLimit,
    skipSuccessfulRequests = false,
  } = options;

  if (!Number.isFinite(window) || window <= 0) {
    throw new TypeError('rateLimit: `window` must be a positive number of milliseconds.');
  }
  if (!Number.isFinite(max) || max < 0) {
    throw new TypeError('rateLimit: `max` must be zero or a positive number of requests.');
  }
  if (!keyBy && !trustProxy) {
    throw new TypeError(
      'rateLimit: pass `keyBy` to choose what the limit counts against (a session id, a user ' +
        'id, an address your runtime exposes), or set `trustProxy: true` if a proxy you control ' +
        'overwrites X-Forwarded-For. There is no safe default: keying on a client-supplied ' +
        'header without a trusted proxy yields a limiter that is bypassed by sending a ' +
        'different header each request.'
    );
  }

  const resolveKey = keyBy ?? forwardedAddress;

  return async (ctx, next) => {
    if (skip && (await skip(ctx))) return next();

    const identity = await resolveKey(ctx);
    if (identity === null || identity === undefined || identity === '') return next();

    const key = `${prefix}${identity}`;
    const state = await consume(store, key, max, window, Date.now());

    // Compare the raw count, not `remaining`: the latter is clamped at zero,
    // so it cannot tell the `max`-th request from the one after it.
    if (state.count > max) {
      const denied = onLimit ? await onLimit(ctx) : ctx.text(message, { status });
      return emitHeaders ? withRateLimitHeaders(denied, state, true) : denied;
    }

    const response = await next();

    // Refunding a successful request keeps a burst of valid traffic from
    // locking a user out, while failures still count toward the limit.
    if (skipSuccessfulRequests && response.status < 400) {
      const current = await store.get(key);
      if (isCounter(current) && current.count > 0) {
        await store.set(
          key,
          { ...current, count: current.count - 1 },
          Math.max(1, current.resetAt - Date.now())
        );
      }
      state.remaining = Math.min(state.limit, state.remaining + 1);
    }

    return emitHeaders ? withRateLimitHeaders(response, state, false) : response;
  };
};
