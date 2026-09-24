/**
 * Rate limiting (#223).
 *
 * No throttling primitive existed server-side, so any public endpoint — the
 * login route in the docs' own recipe included — was unprotected against
 * brute force. The tests that matter most are the boundary ones: the request
 * that is exactly at the limit must pass, and the next one must not.
 */

import { describe, expect, it } from 'bun:test';
import { createServer, memoryStore, rateLimit } from '../src/server/index';
import type { SessionStore } from '../src/server/session';
import { consume, forwardedAddress, withRateLimitHeaders } from '../src/server/rate-limit';
import type { RateLimitState } from '../src/server/rate-limit';
import type { ServerContext } from '../src/server/types';

/** An app limited by a fixed key, so every request counts against one bucket. */
const appWith = (options: Partial<Parameters<typeof rateLimit>[0]> = {}) => {
  const app = createServer();
  app.get('/limited', (ctx) => ctx.text('ok'), [
    rateLimit({ window: 60_000, max: 2, keyBy: () => 'fixed', ...options }),
  ]);
  return app;
};

describe('server/rateLimit', () => {
  it('allows requests up to and including the limit, then rejects', async () => {
    const app = appWith();

    expect((await app.handle('/limited')).status).toBe(200);
    expect((await app.handle('/limited')).status).toBe(200);
    expect((await app.handle('/limited')).status).toBe(429);
  });

  it('reports the standard RateLimit headers while under the limit', async () => {
    const app = appWith();

    const first = await app.handle('/limited');
    expect(first.headers.get('ratelimit-limit')).toBe('2');
    expect(first.headers.get('ratelimit-remaining')).toBe('1');
    expect(Number(first.headers.get('ratelimit-reset'))).toBeGreaterThan(0);
    expect(first.headers.get('retry-after')).toBeNull();

    const second = await app.handle('/limited');
    expect(second.headers.get('ratelimit-remaining')).toBe('0');
  });

  it('adds Retry-After to the 429', async () => {
    const app = appWith();
    await app.handle('/limited');
    await app.handle('/limited');

    const rejected = await app.handle('/limited');
    expect(rejected.status).toBe(429);
    expect(await rejected.text()).toBe('Too Many Requests');
    expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(rejected.headers.get('ratelimit-remaining')).toBe('0');
  });

  it('preserves the handler body and status while adding headers', async () => {
    const app = createServer();
    app.get('/json', (ctx) => ctx.json({ ok: true }, { status: 201 }), [
      rateLimit({ window: 60_000, max: 5, keyBy: () => 'fixed' }),
    ]);

    const response = await app.handle('/json');
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('ratelimit-limit')).toBe('5');
  });

  it('counts each key separately', async () => {
    const app = createServer();
    app.get('/by-user', (ctx) => ctx.text('ok'), [
      rateLimit({
        window: 60_000,
        max: 1,
        keyBy: (ctx) => ctx.query.user as string,
      }),
    ]);

    expect((await app.handle('/by-user?user=alice')).status).toBe(200);
    expect((await app.handle('/by-user?user=bob')).status).toBe(200);
    expect((await app.handle('/by-user?user=alice')).status).toBe(429);
    expect((await app.handle('/by-user?user=bob')).status).toBe(429);
  });

  it('skips the limit when keyBy returns null', async () => {
    const app = appWith({ keyBy: () => null });

    for (let i = 0; i < 5; i++) {
      expect((await app.handle('/limited')).status).toBe(200);
    }
  });

  it('skips the limit when skip() says so, without consuming budget', async () => {
    let skipping = true;
    const app = appWith({ skip: () => skipping });

    for (let i = 0; i < 5; i++) {
      expect((await app.handle('/limited')).status).toBe(200);
    }

    skipping = false;
    expect((await app.handle('/limited')).status).toBe(200);
    expect((await app.handle('/limited')).status).toBe(200);
    expect((await app.handle('/limited')).status).toBe(429);
  });

  it('uses a custom onLimit handler, still with the limit headers', async () => {
    const app = appWith({
      max: 1,
      onLimit: (ctx) => ctx.json({ error: 'slow down' }, { status: 503 }),
    });

    await app.handle('/limited');
    const rejected = await app.handle('/limited');

    expect(rejected.status).toBe(503);
    expect(await rejected.json()).toEqual({ error: 'slow down' });
    expect(rejected.headers.get('retry-after')).toBeTruthy();
  });

  it('honours a custom status and message', async () => {
    const app = appWith({ max: 1, status: 420, message: 'Enhance Your Calm' });

    await app.handle('/limited');
    const rejected = await app.handle('/limited');

    expect(rejected.status).toBe(420);
    expect(await rejected.text()).toBe('Enhance Your Calm');
  });

  it('omits the headers when asked', async () => {
    const app = appWith({ headers: false });
    const response = await app.handle('/limited');

    expect(response.headers.get('ratelimit-limit')).toBeNull();
    expect(response.headers.get('ratelimit-remaining')).toBeNull();
  });

  it('rejects everything when max is zero', async () => {
    const app = appWith({ max: 0 });
    expect((await app.handle('/limited')).status).toBe(429);
  });

  it('refunds successful requests when skipSuccessfulRequests is set', async () => {
    const app = createServer();
    app.get(
      '/maybe',
      (ctx) => ctx.text(ctx.query.fail ? 'bad' : 'ok', { status: ctx.query.fail ? 400 : 200 }),
      [
        rateLimit({
          window: 60_000,
          max: 2,
          keyBy: () => 'fixed',
          skipSuccessfulRequests: true,
        }),
      ]
    );

    // Successes are refunded, so they never exhaust the budget.
    for (let i = 0; i < 5; i++) {
      expect((await app.handle('/maybe')).status).toBe(200);
    }

    // Failures are not.
    expect((await app.handle('/maybe?fail=1')).status).toBe(400);
    expect((await app.handle('/maybe?fail=1')).status).toBe(400);
    expect((await app.handle('/maybe?fail=1')).status).toBe(429);
  });

  it('shares counters across middleware instances through one store', async () => {
    const store = memoryStore();
    const app = createServer();
    app.get('/a', (ctx) => ctx.text('a'), [
      rateLimit({ window: 60_000, max: 2, keyBy: () => 'shared', store }),
    ]);
    app.get('/b', (ctx) => ctx.text('b'), [
      rateLimit({ window: 60_000, max: 2, keyBy: () => 'shared', store }),
    ]);

    expect((await app.handle('/a')).status).toBe(200);
    expect((await app.handle('/b')).status).toBe(200);
    expect((await app.handle('/a')).status).toBe(429);
  });

  it('prefixes store keys so counters cannot collide with sessions', async () => {
    const keys: string[] = [];
    const store: SessionStore = {
      get: () => null,
      set: (id) => {
        keys.push(id);
      },
      destroy: () => {},
    };

    const app = appWith({ store, prefix: 'custom:' });
    await app.handle('/limited');

    expect(keys).toEqual(['custom:fixed']);
  });
});

describe('server/rateLimit configuration errors', () => {
  it('requires keyBy or trustProxy, and says why', () => {
    expect(() => rateLimit({ window: 1000, max: 1 })).toThrow(TypeError);
    expect(() => rateLimit({ window: 1000, max: 1 })).toThrow(/keyBy|trustProxy/);
  });

  it('accepts trustProxy instead of keyBy', () => {
    expect(() => rateLimit({ window: 1000, max: 1, trustProxy: true })).not.toThrow();
    expect(() => rateLimit({ window: 1000, max: 1, trustProxy: 'cf-connecting-ip' })).not.toThrow();
  });

  it('rejects a trustProxy string that cannot name a header', () => {
    expect(() => rateLimit({ window: 1000, max: 1, trustProxy: 'x real ip' })).toThrow(TypeError);
    expect(() => rateLimit({ window: 1000, max: 1, trustProxy: '   ' })).toThrow(/trustProxy/);
  });

  it('rejects a non-positive window', () => {
    expect(() => rateLimit({ window: 0, max: 1, keyBy: () => 'k' })).toThrow(TypeError);
    expect(() => rateLimit({ window: Number.NaN, max: 1, keyBy: () => 'k' })).toThrow(TypeError);
  });

  it('rejects a negative max', () => {
    expect(() => rateLimit({ window: 1000, max: -1, keyBy: () => 'k' })).toThrow(TypeError);
  });
});

describe('server/rateLimit with trustProxy', () => {
  const proxied = () => {
    const app = createServer();
    app.get('/p', (ctx) => ctx.text('ok'), [
      rateLimit({ window: 60_000, max: 1, trustProxy: true }),
    ]);
    return app;
  };

  it('keys on the forwarded address', async () => {
    const app = proxied();

    expect(
      (await app.handle({ url: '/p', headers: { 'x-forwarded-for': '1.1.1.1' } })).status
    ).toBe(200);
    expect(
      (await app.handle({ url: '/p', headers: { 'x-forwarded-for': '2.2.2.2' } })).status
    ).toBe(200);
    expect(
      (await app.handle({ url: '/p', headers: { 'x-forwarded-for': '1.1.1.1' } })).status
    ).toBe(429);
  });

  it('cannot be escaped by rotating a header the proxy does not set', async () => {
    // A proxy that appends to X-Forwarded-For leaves CF-Connecting-IP and
    // friends untouched. If the limiter read whichever of them turned up, a
    // client would mint a fresh bucket per request by varying one.
    const app = proxied();
    const attempt = (client: string) =>
      app.handle({
        url: '/p',
        headers: { 'x-forwarded-for': '7.7.7.7', 'cf-connecting-ip': client, 'x-real-ip': client },
      });

    expect((await attempt('spoof-1')).status).toBe(200);
    expect((await attempt('spoof-2')).status).toBe(429);
  });

  it('keys on the named header when one is given', async () => {
    const app = createServer();
    app.get('/p', (ctx) => ctx.text('ok'), [
      rateLimit({ window: 60_000, max: 1, trustProxy: 'cf-connecting-ip' }),
    ]);
    const attempt = (client: string) =>
      app.handle({
        url: '/p',
        headers: { 'x-forwarded-for': '7.7.7.7', 'cf-connecting-ip': client },
      });

    expect((await attempt('5.5.5.5')).status).toBe(200);
    expect((await attempt('6.6.6.6')).status).toBe(200);
    expect((await attempt('5.5.5.5')).status).toBe(429);
  });

  it('counts a request with no forwarded address rather than letting it through', async () => {
    // Fail closed: anything reaching the origin off-proxy would otherwise be
    // unlimited while the app still reports itself as protected.
    const app = proxied();

    expect((await app.handle('/p')).status).toBe(200);
    expect((await app.handle('/p')).status).toBe(429);
  });

  it('is not bypassable by rotating the client-supplied part of X-Forwarded-For', async () => {
    // Cloudflare and nginx append to XFF, so whatever the client sent stays
    // in place on the left and the proxy's own observation lands on the
    // right. Only the rightmost entry may decide the bucket.
    const app = proxied();

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(
        (
          await app.handle({
            url: '/p',
            headers: { 'x-forwarded-for': `9.9.9.${i}, 7.7.7.7` },
          })
        ).status
      );
    }

    expect(statuses).toEqual([200, 429, 429, 429, 429]);
  });
});

describe('forwardedAddress', () => {
  const ctxWith = (headers: Record<string, string>): ServerContext =>
    ({ request: new Request('http://localhost/', { headers }) }) as ServerContext;

  it('reads the rightmost X-Forwarded-For entry', () => {
    // The list grows left-to-right as it is forwarded, so only the rightmost
    // entry was added by the proxy closest to us. Everything further left may
    // have been sent by the client.
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }))).toBe(
      '3.3.3.3'
    );
  });

  it('ignores a client-supplied X-Forwarded-For prefix', () => {
    // An appending proxy (Cloudflare, nginx) leaves whatever the client sent
    // in place and adds the observed address on the right. Keying on the
    // leftmost entry would let a client rotate it and escape the limit.
    const spoofed = forwardedAddress(ctxWith({ 'x-forwarded-for': 'evil-1, 9.9.9.9' }));
    const rotated = forwardedAddress(ctxWith({ 'x-forwarded-for': 'evil-2, 9.9.9.9' }));
    expect(spoofed).toBe('9.9.9.9');
    expect(rotated).toBe(spoofed);
  });

  it('trims whitespace and skips empty hops', () => {
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '  1.1.1.1  , 2.2.2.2  ' }))).toBe(
      '2.2.2.2'
    );
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, ,' }))).toBe('2.2.2.2');
  });

  it('takes a named single-value header whole', () => {
    expect(forwardedAddress(ctxWith({ 'x-real-ip': '4.4.4.4' }), 'x-real-ip')).toBe('4.4.4.4');
    expect(forwardedAddress(ctxWith({ 'cf-connecting-ip': '5.5.5.5' }), 'cf-connecting-ip')).toBe(
      '5.5.5.5'
    );
    expect(forwardedAddress(ctxWith({ 'true-client-ip': ' 6.6.6.6 ' }), 'true-client-ip')).toBe(
      '6.6.6.6'
    );
  });

  it('reads only the header it was given', () => {
    // No preference list: a proxy that sets CF-Connecting-IP need not strip
    // X-Real-IP, so falling back through the others would hand the client its
    // own bucket by sending a header the proxy never writes.
    const headers = {
      'x-forwarded-for': '1.1.1.1',
      'cf-connecting-ip': '5.5.5.5',
      'true-client-ip': '6.6.6.6',
      'x-real-ip': '4.4.4.4',
    };
    expect(forwardedAddress(ctxWith(headers))).toBe('1.1.1.1');
    expect(forwardedAddress(ctxWith(headers), 'cf-connecting-ip')).toBe('5.5.5.5');
    expect(forwardedAddress(ctxWith({ 'cf-connecting-ip': '5.5.5.5' }))).toBe(
      forwardedAddress(ctxWith({}))
    );
  });

  it('returns a shared bucket, never null, when no header is usable', () => {
    // A null here would mean "skip the limit", so an off-proxy request would
    // be unlimited. They are indistinguishable, so they share one counter.
    const shared = forwardedAddress(ctxWith({}));
    expect(shared).not.toBeNull();
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '' }))).toBe(shared);
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '  ,  ' }))).toBe(shared);
    expect(forwardedAddress(ctxWith({ 'x-real-ip': '   ' }), 'x-real-ip')).toBe(shared);
  });
});

describe('consume', () => {
  const now = 1_000_000;

  it('starts a window on the first request', async () => {
    const store = memoryStore();
    const state = await consume(store, 'k', 3, 60_000, now);

    expect(state).toEqual({
      limit: 3,
      count: 1,
      remaining: 2,
      resetAt: now + 60_000,
      resetSeconds: 60,
    });
  });

  it('increments within the window without moving resetAt', async () => {
    const store = memoryStore();
    const first = await consume(store, 'k', 3, 60_000, now);
    const second = await consume(store, 'k', 3, 60_000, now + 1000);

    expect(second.count).toBe(2);
    expect(second.resetAt).toBe(first.resetAt);
  });

  it('keeps counting past the limit, with remaining clamped at zero', async () => {
    const store = memoryStore();
    for (let i = 0; i < 4; i++) await consume(store, 'k', 2, 60_000, now);
    const state = await consume(store, 'k', 2, 60_000, now);

    expect(state.count).toBe(5);
    expect(state.remaining).toBe(0);
  });

  it('starts a fresh window once the old one passes', async () => {
    const store = memoryStore();
    await consume(store, 'k', 2, 60_000, now);
    await consume(store, 'k', 2, 60_000, now);
    const state = await consume(store, 'k', 2, 60_000, now + 60_001);

    expect(state.count).toBe(1);
    expect(state.resetAt).toBe(now + 60_001 + 60_000);
  });

  it('rounds resetSeconds up and never reports zero', async () => {
    const store = memoryStore();
    const state = await consume(store, 'k', 1, 100, now);
    expect(state.resetSeconds).toBe(1);
  });

  it('ignores a stored value that is not a counter', async () => {
    const store = memoryStore();
    await store.set('k', { nonsense: true });
    const state = await consume(store, 'k', 2, 60_000, now);

    expect(state.count).toBe(1);
  });
});

describe('withRateLimitHeaders', () => {
  const state: RateLimitState = {
    limit: 10,
    count: 3,
    remaining: 7,
    resetAt: 0,
    resetSeconds: 42,
  };

  it('adds the limit headers and keeps the body', async () => {
    const response = withRateLimitHeaders(new Response('body', { status: 200 }), state, false);

    expect(response.headers.get('ratelimit-limit')).toBe('10');
    expect(response.headers.get('ratelimit-remaining')).toBe('7');
    expect(response.headers.get('ratelimit-reset')).toBe('42');
    expect(response.headers.get('retry-after')).toBeNull();
    expect(await response.text()).toBe('body');
  });

  it('adds Retry-After when asked', () => {
    const response = withRateLimitHeaders(new Response(null, { status: 429 }), state, true);
    expect(response.headers.get('retry-after')).toBe('42');
  });

  it('preserves existing headers', () => {
    const original = new Response('x', { headers: { 'content-type': 'text/plain' } });
    const response = withRateLimitHeaders(original, state, false);
    expect(response.headers.get('content-type')).toBe('text/plain');
  });

  it('keeps body-less statuses body-less', () => {
    for (const status of [204, 304]) {
      const response = withRateLimitHeaders(new Response(null, { status }), state, false);
      expect(response.status).toBe(status);
      expect(response.body).toBeNull();
    }
  });
});

describe('concurrency', () => {
  const counting = (max: number) => {
    const app = createServer();
    app.get('/c', (ctx) => ctx.text('ok'), [
      rateLimit({ window: 60_000, max, keyBy: () => 'shared' }),
    ]);
    return app;
  };

  it('holds the limit when requests for one key arrive in parallel', async () => {
    // `consume()` reads, awaits, then writes. Without per-key serialization
    // every concurrent request reads the same counter and the limit does not
    // hold — and parallel connections are the normal shape of a brute force.
    const app = counting(2);

    const statuses = (await Promise.all(Array.from({ length: 10 }, () => app.handle('/c')))).map(
      (response) => response.status
    );

    expect(statuses.filter((status) => status === 200)).toHaveLength(2);
    expect(statuses.filter((status) => status === 429)).toHaveLength(8);
  });

  it('keeps counting after a handler throws', async () => {
    // The per-key chain must not be poisoned by one failed request.
    const app = createServer();
    let fail = true;
    app.get(
      '/c',
      () => {
        if (fail) throw new Error('boom');
        return new Response('ok');
      },
      [rateLimit({ window: 60_000, max: 2, keyBy: () => 'shared' })]
    );

    expect((await app.handle('/c')).status).toBe(500);
    fail = false;
    expect((await app.handle('/c')).status).toBe(200);
    expect((await app.handle('/c')).status).toBe(429);
  });
});

describe('skipSuccessfulRequests', () => {
  const redirecting = () => {
    const app = createServer();
    app.post('/login', (ctx) => ctx.redirect('/login?error=1', 302), [
      rateLimit({
        window: 60_000,
        max: 2,
        keyBy: () => 'k',
        skipSuccessfulRequests: true,
      }),
    ]);
    return app;
  };

  it('still counts a redirect, so a redirect-on-failure form stays limited', async () => {
    // POST/redirect/GET answers a *failed* login with a 302. Refunding 3xx
    // would disable the limit on the shape the recipe is about.
    const app = redirecting();

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await app.handle({ url: '/login', method: 'POST' })).status);
    }

    expect(statuses).toEqual([302, 302, 429, 429]);
  });

  it('refunds a 2xx', async () => {
    const app = createServer();
    app.post('/ok', (ctx) => ctx.text('ok'), [
      rateLimit({ window: 60_000, max: 2, keyBy: () => 'k', skipSuccessfulRequests: true }),
    ]);

    for (let i = 0; i < 5; i++) {
      expect((await app.handle({ url: '/ok', method: 'POST' })).status).toBe(200);
    }
  });
});

describe('Retry-After', () => {
  it('is sent on a rejection even when headers are disabled', async () => {
    // `Retry-After` is part of a 429, not one of the informational
    // `RateLimit-*` headers, so `headers: false` must not strip it.
    const app = createServer();
    app.get('/r', (ctx) => ctx.text('ok'), [
      rateLimit({ window: 60_000, max: 1, keyBy: () => 'k', headers: false }),
    ]);

    await app.handle('/r');
    const denied = await app.handle('/r');

    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).not.toBeNull();
    expect(denied.headers.get('ratelimit-limit')).toBeNull();
  });
});
