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

  it('skips a request with no forwarded address rather than lumping them together', async () => {
    const app = proxied();

    expect((await app.handle('/p')).status).toBe(200);
    expect((await app.handle('/p')).status).toBe(200);
  });
});

describe('forwardedAddress', () => {
  const ctxWith = (headers: Record<string, string>): ServerContext =>
    ({ request: new Request('http://localhost/', { headers }) }) as ServerContext;

  it('reads the leftmost X-Forwarded-For entry', () => {
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }))).toBe(
      '1.1.1.1'
    );
  });

  it('trims whitespace', () => {
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '  1.1.1.1  , 2.2.2.2' }))).toBe(
      '1.1.1.1'
    );
  });

  it('falls back through the other headers in order', () => {
    expect(forwardedAddress(ctxWith({ 'x-real-ip': '4.4.4.4' }))).toBe('4.4.4.4');
    expect(forwardedAddress(ctxWith({ 'cf-connecting-ip': '5.5.5.5' }))).toBe('5.5.5.5');
    expect(forwardedAddress(ctxWith({ 'true-client-ip': '6.6.6.6' }))).toBe('6.6.6.6');
  });

  it('prefers X-Forwarded-For over the others', () => {
    expect(
      forwardedAddress(ctxWith({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '4.4.4.4' }))
    ).toBe('1.1.1.1');
  });

  it('returns null when nothing is present or the value is empty', () => {
    expect(forwardedAddress(ctxWith({}))).toBeNull();
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '' }))).toBeNull();
    expect(forwardedAddress(ctxWith({ 'x-forwarded-for': '  ,  ' }))).toBeNull();
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
