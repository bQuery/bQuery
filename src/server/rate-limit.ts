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

/**
 * The forwarding header `trustProxy: true` reads.
 *
 * `X-Forwarded-For` alone, because it is the only one a proxy necessarily
 * writes: both the appending convention (Cloudflare, nginx's stock
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`) and an
 * overwriting one put the address the proxy itself observed at the **end** of
 * the list, so its rightmost entry is proxy-vouched whatever the client sent.
 *
 * `CF-Connecting-IP`, `True-Client-IP` and `X-Real-IP` are deliberately *not*
 * consulted unless named. A proxy that sets one of them does not necessarily
 * strip the others, so reading whichever happens to be present means a client
 * picks the bucket by sending a header the proxy never touched — the exact
 * bypass `trustProxy` exists to close. Name the one your proxy sets
 * (`trustProxy: 'cf-connecting-ip'`) to key on it instead.
 */
const DEFAULT_FORWARDED_HEADER = 'x-forwarded-for';

/** RFC 9110 field name (a token). Anything else cannot name a header. */
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/**
 * Bucket for requests that reach the origin with no forwarding header at all
 * while `trustProxy` is on. They are indistinguishable from one another, so
 * they share one counter — skipping them instead would let anything bypassing
 * the proxy through unlimited.
 */
const UNKNOWN_FORWARDED_KEY = '@@no-forwarded-header';

/** Cap on the default counter store, so attacker-rotated keys cannot exhaust memory. */
const DEFAULT_MAX_ENTRIES = 10_000;

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
   * **A `null` key fails open.** Pick one that exists for the caller you most
   * want to throttle: `ctx.session?.$id` is `null` until a session is written,
   * so on a login route it skips the limit for every cookie-less request —
   * that is, for the brute-force script. Either key on something an
   * unauthenticated request always carries, or fall back to a shared bucket
   * (`ctx.session?.$id ?? 'anon'`) so the request is still counted.
   *
   * Required unless {@link RateLimitOptions.trustProxy} is set; see the note
   * on that option for why there is no safe default.
   */
  keyBy?: (ctx: ServerContext) => string | null | Promise<string | null>;

  /**
   * Derive the key from a forwarding header when no `keyBy` is given.
   *
   * Off by default, and deliberately not the default behaviour: those headers
   * are set by the client unless a proxy you control overwrites them. Keying
   * on a spoofable value gives a limiter that is trivially bypassed with a
   * random header per request — worse than no limiter, because it looks like
   * protection.
   *
   * `true` reads the **rightmost** `X-Forwarded-For` entry, and only that
   * header. It is the one value a proxy necessarily writes: appending and
   * overwriting configurations alike put the address the proxy observed at
   * the end of the list.
   *
   * Pass a header name to key on that header's whole value instead — for a
   * proxy that reports the client in one of its own:
   *
   * ```ts
   * rateLimit({ window: 60_000, max: 10, trustProxy: 'cf-connecting-ip' });
   * ```
   *
   * Only do that for a header your proxy **sets on every request**, thereby
   * overwriting whatever the client sent. A header the proxy merely passes
   * through is client-controlled, and keying on it reopens the bypass this
   * option exists to close.
   *
   * A request that arrives without the header shares a single bucket rather
   * than escaping the limit.
   */
  trustProxy?: boolean | string;

  /**
   * Where counters are kept. Defaults to a process-local {@link memoryStore}
   * bounded at 10 000 keys, which only limits per process — pass a shared
   * store for more than one.
   *
   * The bound matters: rate-limit keys are attacker-chosen and usually seen
   * once, so an unbounded store turns the limiter into a memory-exhaustion
   * vector. Passing your *session* store here is not advised for the same
   * reason — counter churn would evict live sessions.
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

  /**
   * Do not count requests that ended in a 2xx response. Default: `false`.
   *
   * 2xx only, deliberately. A POST/redirect/GET login form reports a *failed*
   * attempt with a 302, so refunding redirects would leave that form
   * unlimited. The refund is also skipped if the window rolled over while the
   * handler ran, so it cannot steal budget from the next window.
   */
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
 * Read the originating address from a forwarding header.
 *
 * `X-Forwarded-For` — the default — is a list, and its **rightmost** entry is
 * taken. Any other header is a single value and is taken whole.
 *
 * One header, not a preference list over several: a proxy that sets
 * `CF-Connecting-IP` does not necessarily strip `X-Real-IP`, so falling back
 * through the others would let a client choose its own bucket by sending one
 * the proxy never writes. The deployment names the header its proxy controls.
 *
 * Rightmost, not leftmost, because the list grows left-to-right as it is
 * forwarded: the rightmost entry is the hop the closest proxy appended and is
 * therefore the only one that proxy vouches for. Cloudflare and nginx append
 * rather than overwrite, so with leftmost parsing a client that sends its own
 * `X-Forwarded-For` controls the value the limiter keys on and bypasses the
 * limit by rotating it — the exact failure {@link RateLimitOptions.keyBy}
 * being required is meant to prevent. RFC 9110 §7.6.1 and the MDN guidance on
 * security uses of `X-Forwarded-For` both say to use only what a trusted
 * proxy added.
 *
 * With more than one trusted proxy the rightmost entry is the inner proxy
 * rather than the client, so those requests share a bucket. That over-limits
 * rather than under-limits; a deployment that needs per-client buckets behind
 * a chain should pass its own `keyBy`.
 *
 * Never returns `null`: a request with no forwarding header shares
 * {@link UNKNOWN_FORWARDED_KEY} rather than escaping the limit, because
 * anything reaching the origin off-proxy would otherwise be unlimited while
 * the app still reports itself as protected.
 * @internal
 */
export const forwardedAddress = (
  ctx: ServerContext,
  header: string = DEFAULT_FORWARDED_HEADER
): string => {
  const value = ctx.request.headers.get(header);
  if (!value) return UNKNOWN_FORWARDED_KEY;

  if (header.toLowerCase() !== DEFAULT_FORWARDED_HEADER) {
    return value.trim() || UNKNOWN_FORWARDED_KEY;
  }

  const hops = value.split(',');
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = hops[i]?.trim();
    if (hop) return hop;
  }
  return UNKNOWN_FORWARDED_KEY;
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
  // NOTE: read-modify-write. Callers must serialize per key — see
  // `serializeByKey`, which `rateLimit` wraps every call in. `SessionStore`
  // has no atomic increment, so this is the level the guarantee lives at.
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

/**
 * Serialize async work per key, so a read-modify-write cannot interleave.
 *
 * `consume()` reads the counter, awaits, then writes it back. Concurrent
 * requests for one key all read the same value and the limit does not hold —
 * and parallel connections are the normal shape of the traffic a limiter
 * defends against, so this is a bypass rather than a rounding error. The
 * chain is process-local: it closes the single-process case the default
 * {@link memoryStore} runs in. A limit shared across processes still needs a
 * store with an atomic increment.
 * @internal
 */
export const serializeByKey = (): (<T>(key: string, work: () => Promise<T>) => Promise<T>) => {
  const chains = new Map<string, Promise<unknown>>();

  return <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const previous = chains.get(key) ?? Promise.resolve();
    // Swallow the predecessor's rejection: one failed request must not
    // poison every later request for the same key.
    const run = previous.then(work, work);
    const tail = run.then(
      () => undefined,
      () => undefined
    );
    chains.set(key, tail);
    // Drop the entry once nothing is queued behind it, so the map tracks
    // in-flight work only and cannot grow with the key space.
    void tail.then(() => {
      if (chains.get(key) === tail) chains.delete(key);
    });
    return run;
  };
};

/** Apply the `RateLimit-*` headers to a response, preserving its body. @internal */
export const withRateLimitHeaders = (
  response: Response,
  state: RateLimitState,
  includeRetryAfter: boolean,
  includeRateLimitHeaders = true
): Response => {
  const headers = new Headers(response.headers);
  if (includeRateLimitHeaders) {
    headers.set('ratelimit-limit', String(state.limit));
    headers.set('ratelimit-remaining', String(state.remaining));
    headers.set('ratelimit-reset', String(state.resetSeconds));
  }
  // `Retry-After` is a standard part of a 429, not one of the informational
  // `RateLimit-*` headers, so `headers: false` must not strip it — a client
  // would have nothing to back off on.
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
 *   // Behind a proxy, key on the address it reports. A session id would be
 *   // `null` for the cookie-less request a brute-force script sends, and a
 *   // `null` key skips the limit.
 *   trustProxy: true,
 *   skipSuccessfulRequests: true,
 * });
 *
 * app.post('/login', handleLogin, [loginLimit]);
 * ```
 *
 * @example Without a proxy, counting authenticated and anonymous separately
 * ```ts
 * // `?? 'anon'` matters: it keeps unauthenticated callers in one counted
 * // bucket instead of skipping the limit for all of them.
 * app.use(rateLimit({ window: 60_000, max: 100, keyBy: (ctx) => ctx.session?.$id ?? 'anon' }));
 * ```
 */
export const rateLimit = (options: RateLimitOptions): ServerMiddleware => {
  const {
    window,
    max,
    keyBy,
    trustProxy = false,
    store = memoryStore({ maxEntries: DEFAULT_MAX_ENTRIES }),
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
        'appends to or overwrites X-Forwarded-For. There is no safe default: keying on a ' +
        'client-supplied header without a trusted proxy yields a limiter that is bypassed by ' +
        'sending a different header each request.'
    );
  }

  const forwardedHeader =
    typeof trustProxy === 'string' ? trustProxy.trim().toLowerCase() : DEFAULT_FORWARDED_HEADER;
  if (!HEADER_NAME.test(forwardedHeader)) {
    throw new TypeError(
      `rateLimit: \`trustProxy\` must be true or a header name, not ${JSON.stringify(trustProxy)}.`
    );
  }

  const resolveKey = keyBy ?? ((ctx: ServerContext) => forwardedAddress(ctx, forwardedHeader));
  const withKeyLock = serializeByKey();

  return async (ctx, next) => {
    if (skip && (await skip(ctx))) return next();

    const identity = await resolveKey(ctx);
    if (identity === null || identity === undefined || identity === '') return next();

    const key = `${prefix}${identity}`;
    const state = await withKeyLock(key, () => consume(store, key, max, window, Date.now()));

    // Compare the raw count, not `remaining`: the latter is clamped at zero,
    // so it cannot tell the `max`-th request from the one after it.
    if (state.count > max) {
      const denied = onLimit ? await onLimit(ctx) : ctx.text(message, { status });
      return withRateLimitHeaders(denied, state, true, emitHeaders);
    }

    const response = await next();

    // Refunding a successful request keeps a burst of valid traffic from
    // locking a user out, while failures still count toward the limit.
    //
    // 2xx only. A redirect is how the POST/redirect/GET login form reports a
    // *failed* attempt, so refunding 3xx would disable the limit on exactly
    // the shape this middleware exists to protect.
    if (skipSuccessfulRequests && response.status >= 200 && response.status < 300) {
      await withKeyLock(key, async () => {
        const current = await store.get(key);
        // Only refund within the window the request was counted in: if it
        // rolled over while the handler ran, decrementing would steal a
        // request from the new window and let it allow `max + 1`.
        if (isCounter(current) && current.count > 0 && current.resetAt === state.resetAt) {
          await store.set(
            key,
            { ...current, count: current.count - 1 },
            Math.max(1, current.resetAt - Date.now())
          );
          state.remaining = Math.min(state.limit, state.remaining + 1);
        }
      });
    }

    return emitHeaders ? withRateLimitHeaders(response, state, false) : response;
  };
};
