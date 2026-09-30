import { afterEach, describe, expect, it, setSystemTime, spyOn } from 'bun:test';
import {
  basicAuth,
  bearerAuth,
  createServer,
  csrf,
  csrfToken,
  guard,
  memoryStore,
  randomId,
  randomToken,
  session,
  signValue,
  timingSafeEqual,
  unsignValue,
} from '../src/server/index';
import type { SessionStore } from '../src/server/index';

const SECRET = 'test-secret-value-please-rotate';

const getSetCookies = (response: Response): string[] => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
};

const cookiePair = (response: Response, name: string): string => {
  for (const cookie of getSetCookies(response)) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.split(';')[0];
    }
  }
  throw new Error(`no Set-Cookie found for "${name}"`);
};

const setCookieAttributes = (response: Response, name: string): string => {
  for (const cookie of getSetCookies(response)) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie;
    }
  }
  throw new Error(`no Set-Cookie found for "${name}"`);
};

describe('server/crypto', () => {
  it('round-trips signed values', async () => {
    const signed = await signValue('hello', SECRET);
    expect(signed.startsWith('hello.')).toBe(true);
    expect(await unsignValue(signed, [SECRET])).toBe('hello');
  });

  it('rejects tampered signatures', async () => {
    const signed = await signValue('hello', SECRET);
    const tampered = `${signed.slice(0, -1)}${signed.endsWith('A') ? 'B' : 'A'}`;
    expect(await unsignValue(tampered, [SECRET])).toBeNull();
  });

  it('rejects tampered payloads', async () => {
    const signed = await signValue('hello', SECRET);
    const tampered = signed.replace('hello', 'hacked');
    expect(await unsignValue(tampered, [SECRET])).toBeNull();
  });

  it('supports secret rotation', async () => {
    const signed = await signValue('payload', 'old-secret');
    expect(await unsignValue(signed, ['new-secret', 'old-secret'])).toBe('payload');
    expect(await unsignValue(signed, ['new-secret'])).toBeNull();
  });

  it('returns null for malformed tokens', async () => {
    expect(await unsignValue('no-dot', [SECRET])).toBeNull();
    expect(await unsignValue('.sig', [SECRET])).toBeNull();
    expect(await unsignValue('value.', [SECRET])).toBeNull();
  });

  it('compares strings in constant time semantics', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('generates unique random tokens and ids', () => {
    expect(randomToken()).not.toBe(randomToken());
    expect(randomId()).not.toBe(randomId());
    expect(randomToken(8).length).toBeGreaterThan(0);
  });
});

describe('server/memoryStore', () => {
  it('stores, reads, and destroys sessions', async () => {
    const store = memoryStore();
    await store.set('id', { a: 1 });
    expect(await store.get('id')).toEqual({ a: 1 });
    await store.destroy('id');
    expect(await store.get('id')).toBeNull();
  });

  it('expires entries past their ttl', async () => {
    const store = memoryStore();
    await store.set('id', { a: 1 }, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await store.get('id')).toBeNull();
  });

  it('treats a non-positive ttl as no expiry', async () => {
    const store = memoryStore();
    await store.set('id', { a: 1 }, 0);
    expect(await store.get('id')).toEqual({ a: 1 });
  });

  it('evicts the oldest entry beyond maxEntries', async () => {
    const store = memoryStore({ maxEntries: 2 });
    await store.set('a', { n: 1 });
    await store.set('b', { n: 2 });
    await store.set('c', { n: 3 });
    expect(await store.get('a')).toBeNull();
    expect(await store.get('b')).toEqual({ n: 2 });
    expect(await store.get('c')).toEqual({ n: 3 });
  });

  describe('expired-entry sweeping (#256)', () => {
    afterEach(() => {
      setSystemTime();
    });

    it('sweeps expired sessions on later writes, even if they are never read again', async () => {
      const start = Date.now();
      setSystemTime(start);
      const store = memoryStore();
      await store.set('abandoned', { n: 1 }, 1_000);

      setSystemTime(start + 60_000);
      const deleteSpy = spyOn(Map.prototype, 'delete');
      try {
        await store.set('fresh', { n: 2 }, 1_000);
        expect(deleteSpy.mock.calls.some(([key]) => key === 'abandoned')).toBe(true);
      } finally {
        deleteSpy.mockRestore();
      }
      expect(await store.get('fresh')).toEqual({ n: 2 });
    });

    it('drops expired entries before evicting a live one to honour maxEntries', async () => {
      const start = Date.now();
      setSystemTime(start);
      const store = memoryStore({ maxEntries: 2 });
      await store.set('live', { n: 1 }, 3_600_000);
      await store.set('expiring', { n: 2 }, 1_000);

      setSystemTime(start + 5_000);
      await store.set('new', { n: 3 }, 3_600_000);

      expect(await store.get('live')).toEqual({ n: 1 });
      expect(await store.get('new')).toEqual({ n: 3 });
    });
  });

  it('evicts the least recently touched entry beyond maxEntries (#256)', async () => {
    const store = memoryStore({ maxEntries: 2 });
    await store.set('a', { n: 1 });
    await store.set('b', { n: 2 });
    await store.touch?.('a');
    await store.set('c', { n: 3 });
    expect(await store.get('a')).toEqual({ n: 1 });
    expect(await store.get('b')).toBeNull();
    expect(await store.get('c')).toEqual({ n: 3 });
  });

  it('treats a read as use when evicting beyond maxEntries (#256)', async () => {
    const store = memoryStore({ maxEntries: 2 });
    await store.set('a', { n: 1 });
    await store.set('b', { n: 2 });
    await store.get('a');
    await store.set('c', { n: 3 });
    expect(await store.get('a')).toEqual({ n: 1 });
    expect(await store.get('b')).toBeNull();
  });

  it('returns a copy, not a live reference', async () => {
    const store = memoryStore();
    const data = { a: 1 };
    await store.set('id', data);
    data.a = 2;
    expect(await store.get('id')).toEqual({ a: 1 });
  });
});

describe('server/session', () => {
  const buildApp = (store: SessionStore) => {
    const app = createServer();
    app.use(session({ secret: SECRET, store }));
    app.post('/login', (ctx) => {
      ctx.session!.userId = 'u_1';
      return ctx.json({ ok: true, isNew: ctx.session!.$isNew });
    });
    app.get('/me', (ctx) => ctx.json({ userId: ctx.session?.userId ?? null }));
    app.post('/logout', (ctx) => {
      ctx.session!.$destroy();
      return ctx.json({ ok: true });
    });
    app.post('/rotate', (ctx) => {
      const before = ctx.session!.$id;
      ctx.session!.$regenerate();
      return ctx.json({ before, after: ctx.session!.$id });
    });
    return app;
  };

  it('requires a secret', () => {
    expect(() => session({ secret: '' })).toThrow();
    expect(() => session({ secret: [] })).toThrow();
  });

  it('persists session data across requests', async () => {
    const store = memoryStore();
    const app = buildApp(store);

    const login = await app.handle({ url: '/login', method: 'POST' });
    expect((await login.json()).isNew).toBe(true);
    const cookie = cookiePair(login, '__Host-bq.sid');

    const me = await app.handle({ url: '/me', headers: { cookie } });
    expect(await me.json()).toEqual({ userId: 'u_1' });
  });

  it('signs the session cookie with secure-by-default attributes', async () => {
    const app = buildApp(memoryStore());
    const login = await app.handle({ url: '/login', method: 'POST' });
    const attributes = setCookieAttributes(login, '__Host-bq.sid');
    expect(attributes).toContain('HttpOnly');
    expect(attributes).toContain('SameSite=Lax');
    expect(attributes).toContain('Path=/');
    expect(attributes).toContain('Secure');
  });

  it('allows opting out of Secure for local HTTP dev (#169)', async () => {
    const store = memoryStore();
    const app = createServer();
    app.use(session({ secret: SECRET, store, cookie: { secure: false } }));
    app.post('/login', (ctx) => {
      ctx.session!.userId = 'u_1';
      return ctx.json({ ok: true });
    });
    const login = await app.handle({ url: '/login', method: 'POST' });
    expect(setCookieAttributes(login, 'bq.sid')).not.toContain('Secure');
  });

  it('uses a __Host- session cookie by default so a subdomain cannot plant one', async () => {
    const store = memoryStore();
    const app = createServer();
    app.use(session({ secret: SECRET, store }));
    app.post('/login', (ctx) => {
      ctx.session!.userId = 'attacker';
      return ctx.json({ ok: true });
    });
    app.get('/me', (ctx) => ctx.json({ userId: ctx.session!.userId ?? null }));

    const login = await app.handle({ url: '/login', method: 'POST' });
    const attributes = setCookieAttributes(login, '__Host-bq.sid');
    expect(attributes).toContain('Secure');
    expect(attributes).toContain('Path=/');
    expect(attributes.toLowerCase()).not.toContain('domain=');

    // A subdomain can only plant an unprefixed cookie, even one holding a
    // validly signed id; the middleware ignores it (no session swapping).
    const signedId = cookiePair(login, '__Host-bq.sid').slice('__Host-bq.sid='.length);
    const me = await app.handle({ url: '/me', headers: { cookie: `bq.sid=${signedId}` } });
    expect(await me.json()).toEqual({ userId: null });
  });

  it('falls back to bq.sid when the cookie attributes rule out __Host-', async () => {
    for (const cookie of [{ secure: false }, { path: '/app' }, { domain: 'example.com' }]) {
      const app = createServer();
      app.use(session({ secret: SECRET, store: memoryStore(), cookie }));
      app.post('/login', (ctx) => {
        ctx.session!.userId = 'u_1';
        return ctx.json({ ok: true });
      });
      const login = await app.handle({ url: '/login', method: 'POST' });
      expect(() => cookiePair(login, 'bq.sid')).not.toThrow();
    }
  });

  it('rejects a prefixed cookie name the browser would drop', () => {
    const bad = [
      ['__Host-sid', { secure: false }],
      ['__host-sid', { path: '/app' }],
      ['__HOST-sid', { domain: 'example.com' }],
      ['__Secure-sid', { secure: false }],
      ['__secure-sid', { secure: false }],
    ] as const;
    for (const [cookieName, cookie] of bad) {
      expect(() => session({ secret: SECRET, cookieName, cookie })).toThrow(/prefix/);
    }
    expect(() => session({ secret: SECRET, cookieName: '__Secure-sid' })).not.toThrow();
    expect(() => session({ secret: SECRET, cookieName: '__host-sid' })).not.toThrow();
  });

  it('ignores a tampered session cookie', async () => {
    const store = memoryStore();
    const app = buildApp(store);
    const login = await app.handle({ url: '/login', method: 'POST' });
    const cookie = cookiePair(login, '__Host-bq.sid');
    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith('A') ? 'B' : 'A'}`;

    const me = await app.handle({ url: '/me', headers: { cookie: tampered } });
    expect(await me.json()).toEqual({ userId: null });
  });

  it('does not set a cookie when nothing is written', async () => {
    const app = buildApp(memoryStore());
    const me = await app.handle('/me');
    expect(getSetCookies(me)).toHaveLength(0);
  });

  it('destroys the session and expires the cookie', async () => {
    const store = memoryStore();
    const app = buildApp(store);
    const login = await app.handle({ url: '/login', method: 'POST' });
    const cookie = cookiePair(login, '__Host-bq.sid');

    const logout = await app.handle({ url: '/logout', method: 'POST', headers: { cookie } });
    expect(setCookieAttributes(logout, '__Host-bq.sid')).toContain('Max-Age=0');

    const me = await app.handle({ url: '/me', headers: { cookie } });
    expect(await me.json()).toEqual({ userId: null });
  });

  it('regenerates the id and invalidates the old session (fixation defense)', async () => {
    const store = memoryStore();
    const app = buildApp(store);
    const login = await app.handle({ url: '/login', method: 'POST' });
    const oldCookie = cookiePair(login, '__Host-bq.sid');

    const rotate = await app.handle({
      url: '/rotate',
      method: 'POST',
      headers: { cookie: oldCookie },
    });
    const body = await rotate.json();
    expect(body.after).not.toBe(body.before);
    const newCookie = cookiePair(rotate, '__Host-bq.sid');
    expect(newCookie).not.toBe(oldCookie);

    // Old cookie no longer resolves; new cookie keeps the data.
    expect(await (await app.handle({ url: '/me', headers: { cookie: oldCookie } })).json()).toEqual(
      {
        userId: null,
      }
    );
    expect(await (await app.handle({ url: '/me', headers: { cookie: newCookie } })).json()).toEqual(
      {
        userId: 'u_1',
      }
    );
  });

  it('ignores prototype-pollution keys written to the session', async () => {
    const app = createServer();
    app.use(session({ secret: SECRET, store: memoryStore() }));
    app.post('/x', (ctx) => {
      (ctx.session as Record<string, unknown>)['__proto__'] = { polluted: true };
      return ctx.json({ polluted: ({} as Record<string, unknown>).polluted ?? false });
    });
    const res = await app.handle({ url: '/x', method: 'POST' });
    expect(await res.json()).toEqual({ polluted: false });
  });

  it('rolls the cookie on every response when rolling is enabled', async () => {
    const store = memoryStore();
    const app = createServer();
    app.use(session({ secret: SECRET, store, rolling: true }));
    app.post('/login', (ctx) => {
      ctx.session!.userId = 'u_1';
      return ctx.json({ ok: true });
    });
    app.get('/me', (ctx) => ctx.json({ userId: ctx.session?.userId ?? null }));

    const login = await app.handle({ url: '/login', method: 'POST' });
    const cookie = cookiePair(login, '__Host-bq.sid');
    const me = await app.handle({ url: '/me', headers: { cookie } });
    // A read-only request re-issues the same session cookie with a fresh Max-Age.
    const rolled = setCookieAttributes(me, '__Host-bq.sid');
    expect(rolled).toContain('Max-Age=');
    expect(cookiePair(me, '__Host-bq.sid')).toBe(cookie);
  });

  it('honors session secret rotation', async () => {
    const store = memoryStore();
    const oldApp = createServer();
    oldApp.use(session({ secret: 'old-secret', store }));
    oldApp.post('/login', (ctx) => {
      ctx.session!.userId = 'u_1';
      return ctx.json({ ok: true });
    });
    const login = await oldApp.handle({ url: '/login', method: 'POST' });
    const cookie = cookiePair(login, '__Host-bq.sid');

    // New deploy signs with a new secret but still verifies cookies from the old one.
    const rotatedApp = createServer();
    rotatedApp.use(session({ secret: ['new-secret', 'old-secret'], store }));
    rotatedApp.get('/me', (ctx) => ctx.json({ userId: ctx.session?.userId ?? null }));
    expect(await (await rotatedApp.handle({ url: '/me', headers: { cookie } })).json()).toEqual({
      userId: 'u_1',
    });

    // Once the old secret is dropped, the old cookie no longer verifies.
    const newOnlyApp = createServer();
    newOnlyApp.use(session({ secret: 'new-secret', store }));
    newOnlyApp.get('/me', (ctx) => ctx.json({ userId: ctx.session?.userId ?? null }));
    expect(await (await newOnlyApp.handle({ url: '/me', headers: { cookie } })).json()).toEqual({
      userId: null,
    });
  });

  it('starts a fresh session when written to after $destroy', async () => {
    const store = memoryStore();
    const app = createServer();
    app.use(session({ secret: SECRET, store }));
    app.post('/reset', (ctx) => {
      ctx.session!.userId = 'old';
      ctx.session!.$destroy();
      ctx.session!.userId = 'new';
      return ctx.json({ id: ctx.session!.$id });
    });
    app.get('/me', (ctx) => ctx.json({ userId: ctx.session?.userId ?? null }));

    const reset = await app.handle({ url: '/reset', method: 'POST' });
    expect((await reset.json()).id).not.toBeNull();
    const cookie = cookiePair(reset, '__Host-bq.sid');
    expect(await (await app.handle({ url: '/me', headers: { cookie } })).json()).toEqual({
      userId: 'new',
    });
  });

  it('persists session changes on responses returned via Response.redirect', async () => {
    const store = memoryStore();
    const app = createServer();
    app.use(session({ secret: SECRET, store }));
    app.post('/login', (ctx) => {
      ctx.session!.userId = 'u_1';
      return Response.redirect('https://example.test/home', 302);
    });
    app.get('/me', (ctx) => ctx.json({ userId: ctx.session?.userId ?? null }));

    const login = await app.handle({ url: '/login', method: 'POST' });
    expect(login.status).toBe(302);
    const cookie = cookiePair(login, '__Host-bq.sid');
    expect(await (await app.handle({ url: '/me', headers: { cookie } })).json()).toEqual({
      userId: 'u_1',
    });
  });
});

describe('server/csrf', () => {
  it('issues a cookie and token on safe requests', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));

    const res = await app.handle('/token');
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(() => cookiePair(res, '__Host-bq.csrf')).not.toThrow();
  });

  it('marks the CSRF secret cookie Secure by default (#169)', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));

    const res = await app.handle('/token');
    expect(setCookieAttributes(res, '__Host-bq.csrf')).toContain('Secure');
  });

  it('allows opting out of Secure on the CSRF cookie (#169)', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET, cookie: { secure: false } }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));

    const res = await app.handle('/token');
    expect(setCookieAttributes(res, 'bq.csrf')).not.toContain('Secure');
  });

  it('uses a __Host- cookie by default so a subdomain cannot plant it', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));
    app.post('/x', (ctx) => ctx.json({ ok: true }));

    const res = await app.handle('/token');
    const attributes = setCookieAttributes(res, '__Host-bq.csrf');
    expect(attributes).toContain('Secure');
    expect(attributes).toContain('Path=/');
    expect(attributes.toLowerCase()).not.toContain('domain=');

    // A subdomain can only plant an unprefixed cookie; the middleware ignores it.
    const { token } = (await res.json()) as { token: string };
    const secret = cookiePair(res, '__Host-bq.csrf').slice('__Host-bq.csrf='.length);
    const planted = await app.handle({
      url: '/x',
      method: 'POST',
      headers: { cookie: `bq.csrf=${secret}`, 'x-csrf-token': token },
    });
    expect(planted.status).toBe(403);
  });

  it('falls back to bq.csrf when the cookie attributes rule out __Host-', async () => {
    for (const cookie of [{ secure: false }, { path: '/app' }, { domain: 'example.com' }]) {
      const app = createServer();
      app.use(csrf({ secret: SECRET, cookie }));
      app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));
      const res = await app.handle('/token');
      expect(() => cookiePair(res, 'bq.csrf')).not.toThrow();
    }
  });

  it('rejects a __Host- cookie name with incompatible attributes', () => {
    expect(() => csrf({ cookieName: '__Host-x', cookie: { secure: false } })).toThrow(
      /__Host- prefix/
    );
    expect(() => csrf({ cookieName: '__Host-x', cookie: { path: '/app' } })).toThrow();
    expect(() => csrf({ cookieName: '__Host-x', cookie: { domain: 'example.com' } })).toThrow();
    expect(() => csrf({ cookieName: '__Host-x' })).not.toThrow();
    // Browsers match prefixes case-insensitively, and `__Secure-` needs Secure.
    expect(() => csrf({ cookieName: '__host-x', cookie: { secure: false } })).toThrow(
      /__Host- prefix/
    );
    expect(() => csrf({ cookieName: '__HOST-x', cookie: { path: '/app' } })).toThrow();
    expect(() => csrf({ cookieName: '__Secure-x', cookie: { secure: false } })).toThrow(
      /__Secure- prefix/
    );
    expect(() => csrf({ cookieName: '__secure-x', cookie: { secure: false } })).toThrow();
    expect(() => csrf({ cookieName: '__Secure-x', cookie: { path: '/app' } })).not.toThrow();
    // SameSite=None forces Secure, so the prefix is satisfied.
    expect(() =>
      csrf({ cookieName: '__Host-x', cookie: { secure: false, sameSite: 'none' } })
    ).not.toThrow();
  });

  it('rejects unsafe requests without a token', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET }));
    app.post('/x', (ctx) => ctx.json({ ok: true }));

    const res = await app.handle({ url: '/x', method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('accepts a valid token via header', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));
    app.post('/x', (ctx) => ctx.json({ ok: true }));

    const tokenRes = await app.handle('/token');
    const { token } = await tokenRes.json();
    const cookie = cookiePair(tokenRes, '__Host-bq.csrf');

    const res = await app.handle({
      url: '/x',
      method: 'POST',
      headers: { cookie, 'x-csrf-token': token },
    });
    expect(res.status).toBe(200);
  });

  it('accepts a valid token via form field', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));
    app.post('/x', (ctx) => ctx.json({ ok: true }));

    const tokenRes = await app.handle('/token');
    const { token } = await tokenRes.json();
    const cookie = cookiePair(tokenRes, '__Host-bq.csrf');

    const res = await app.handle({
      url: '/x',
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: `_csrf=${encodeURIComponent(token)}&foo=bar`,
    });
    expect(res.status).toBe(200);
  });

  it('rejects a tampered token', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));
    app.post('/x', (ctx) => ctx.json({ ok: true }));

    const tokenRes = await app.handle('/token');
    const { token } = await tokenRes.json();
    const cookie = cookiePair(tokenRes, '__Host-bq.csrf');

    const res = await app.handle({
      url: '/x',
      method: 'POST',
      headers: { cookie, 'x-csrf-token': `${token}x` },
    });
    expect(res.status).toBe(403);
  });

  it('works in plain double-submit mode without a secret', async () => {
    const app = createServer();
    app.use(csrf());
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));
    app.post('/x', (ctx) => ctx.json({ ok: true }));

    const tokenRes = await app.handle('/token');
    const { token } = await tokenRes.json();
    const cookie = cookiePair(tokenRes, '__Host-bq.csrf');

    const ok = await app.handle({
      url: '/x',
      method: 'POST',
      headers: { cookie, 'x-csrf-token': token },
    });
    expect(ok.status).toBe(200);

    const bad = await app.handle({
      url: '/x',
      method: 'POST',
      headers: { cookie, 'x-csrf-token': 'wrong' },
    });
    expect(bad.status).toBe(403);
  });

  it('returns null from csrfToken when middleware did not run', async () => {
    const app = createServer();
    app.get('/x', (ctx) => ctx.json({ token: csrfToken(ctx) }));
    const res = await app.handle('/x');
    expect(await res.json()).toEqual({ token: null });
  });
});

describe('server/csrf bound to the session', () => {
  // Opened by a test once `app.handle()` has returned, i.e. once the session
  // middleware has persisted the session.
  let openLateGate: () => void = () => {};
  let lateGate: Promise<void> = Promise.resolve();

  const appWithSession = (
    csrfOptions: Parameters<typeof csrf>[0] = { secret: SECRET },
    store: SessionStore = memoryStore()
  ) => {
    const app = createServer();
    app.use(session({ secret: SECRET, store, cookie: { secure: false } }));
    app.use(csrf({ cookie: { secure: false }, ...csrfOptions }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));
    app.get('/plain', (ctx) => ctx.text('no form here'));
    app.get('/start', (ctx) => {
      ctx.session!.visited = true;
      return ctx.json({ ok: true });
    });
    app.get('/late', (ctx) => {
      // The token is read while the body streams, after the middleware chain
      // (and with it the session) has finished.
      return new Response(
        new ReadableStream<Uint8Array>({
          async pull(controller) {
            // `pull` runs as soon as the stream is built; wait until the
            // session middleware has finished.
            await lateGate;
            controller.enqueue(new TextEncoder().encode(String(csrfToken(ctx))));
            controller.close();
          },
        })
      );
    });
    app.post('/login', (ctx) => {
      ctx.session!.$regenerate();
      ctx.session!.user = 'ada';
      return ctx.json({ ok: true });
    });
    app.post('/cart', (ctx) => {
      ctx.session!.cart = 1;
      return ctx.json({ ok: true });
    });
    app.post('/x', (ctx) => ctx.json({ ok: true }));
    return app;
  };

  type App = ReturnType<typeof createServer>;

  const startSession = async (app: App) => cookiePair(await app.handle('/start'), 'bq.sid');

  const mint = async (app: App, cookie?: string) => {
    const res = await app.handle({ url: '/token', headers: cookie ? { cookie } : {} });
    const { token } = (await res.json()) as { token: string };
    return { token, res };
  };

  const post = (app: App, url: string, cookie: string, token: string) =>
    app.handle({ url, method: 'POST', headers: { cookie, 'x-csrf-token': token } });

  it('keeps the secret of a stored session in the session instead of a cookie', async () => {
    const app = appWithSession();
    const sid = await startSession(app);
    const { token, res } = await mint(app, sid);

    expect(getSetCookies(res).some((c) => c.startsWith('bq.csrf='))).toBe(false);
    expect((await post(app, '/x', sid, token)).status).toBe(200);
  });

  it('rejects a valid token minted for another session (cookie injection)', async () => {
    const app = appWithSession();
    const attacker = await mint(app, await startSession(app));
    const anonymous = await mint(app);
    const plantedCookie = cookiePair(anonymous.res, 'bq.csrf');
    const victimSid = await startSession(app);

    // Planting a CSRF cookie no longer matters; only the session is consulted.
    for (const token of [attacker.token, anonymous.token]) {
      expect((await post(app, '/x', `${victimSid}; ${plantedCookie}`, token)).status).toBe(403);
    }
  });

  it('uses the signed cookie for visitors without a session', async () => {
    const app = appWithSession();
    const { token, res } = await mint(app);
    const csrfCookie = cookiePair(res, 'bq.csrf');

    expect(getSetCookies(res).some((c) => c.startsWith('bq.sid='))).toBe(false);
    expect(token).not.toBe(csrfCookie.slice('bq.csrf='.length));
    expect((await post(app, '/x', csrfCookie, token)).status).toBe(200);
    expect((await post(app, '/x', csrfCookie, 'forged')).status).toBe(403);
  });

  it('does not write anonymous traffic into the session store', async () => {
    const base = memoryStore();
    let writes = 0;
    const store: SessionStore = {
      get: (id) => base.get(id),
      set: (id, data, ttlMs) => {
        writes++;
        return base.set(id, data, ttlMs);
      },
      destroy: (id) => base.destroy(id),
    };
    const app = appWithSession({ secret: SECRET }, store);
    for (let i = 0; i < 20; i++) {
      const { res } = await mint(app);
      expect(getSetCookies(res).some((c) => c.startsWith('bq.sid='))).toBe(false);
    }
    const plain = await app.handle('/plain');
    expect(getSetCookies(plain).some((c) => c.startsWith('bq.sid='))).toBe(false);
    expect(writes).toBe(0);
  });

  it('keeps an anonymous token valid once the session is created', async () => {
    const app = appWithSession();
    const { token, res } = await mint(app);
    const csrfCookie = cookiePair(res, 'bq.csrf');

    const cart = await post(app, '/cart', csrfCookie, token);
    expect(cart.status).toBe(200);
    const sid = cookiePair(cart, 'bq.sid');

    // The session adopted the cookie secret: the form rendered before the
    // session existed still submits, and so does the session's own token.
    expect((await post(app, '/x', sid, token)).status).toBe(200);
    const bound = await mint(app, sid);
    expect((await post(app, '/x', sid, bound.token)).status).toBe(200);
  });

  it('rotates the token on $regenerate() so a fixated session cannot carry it over', async () => {
    const app = appWithSession();
    const sid = await startSession(app);
    const { token } = await mint(app, sid);

    const login = await post(app, '/login', sid, token);
    expect(login.status).toBe(200);
    const rotated = cookiePair(login, 'bq.sid');
    expect(rotated).not.toBe(sid);

    // The pre-login token (known to whoever planted the session) is dead.
    expect((await post(app, '/x', rotated, token)).status).toBe(403);

    // A page rendered after login hands out a working token.
    const fresh = await mint(app, rotated);
    expect(fresh.token).not.toBe(token);
    expect((await post(app, '/x', rotated, fresh.token)).status).toBe(200);
  });

  it('does not carry a planted cookie secret into a session regenerated on login', async () => {
    const app = appWithSession();
    // The attacker mints an anonymous pair and plants the cookie on the victim.
    const planted = await mint(app);
    const plantedCookie = cookiePair(planted.res, 'bq.csrf');

    // The victim logs in from an anonymous page that carries the planted cookie.
    const login = await post(app, '/login', plantedCookie, planted.token);
    expect(login.status).toBe(200);
    const sid = cookiePair(login, 'bq.sid');

    // The planted token must not work for the authenticated session.
    expect((await post(app, '/x', `${sid}; ${plantedCookie}`, planted.token)).status).toBe(403);
    const fresh = await mint(app, sid);
    expect((await post(app, '/x', sid, fresh.token)).status).toBe(200);
  });

  it('does not revive a session destroyed by the handler', async () => {
    const app = appWithSession();
    app.post('/logout', (ctx) => {
      ctx.session!.$destroy();
      return ctx.json({ ok: true });
    });
    const sid = await startSession(app);
    const { token } = await mint(app, sid);

    const logout = await post(app, '/logout', sid, token);
    expect(logout.status).toBe(200);
    const cookies = getSetCookies(logout).filter((c) => c.startsWith('bq.sid='));
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/^bq\.sid=;/);
  });

  it('persists the secret when the token is read after the handler returned', async () => {
    const app = appWithSession();
    const sid = await startSession(app);
    const { token } = await mint(app, sid);
    // After login the session holds no secret for its new id yet.
    const rotated = cookiePair(await post(app, '/login', sid, token), 'bq.sid');

    lateGate = new Promise((resolve) => {
      openLateGate = resolve;
    });
    const late = await app.handle({ url: '/late', headers: { cookie: rotated } });
    openLateGate();
    const lateToken = await late.text();
    expect(lateToken).not.toBe('null');
    expect((await post(app, '/x', rotated, lateToken)).status).toBe(200);
  });

  it('rejects unsafe requests without a matching secret', async () => {
    const app = appWithSession();
    const res = await app.handle({ url: '/x', method: 'POST', headers: { 'x-csrf-token': 'x' } });
    expect(res.status).toBe(403);
    expect((await post(app, '/x', await startSession(app), 'x')).status).toBe(403);
  });

  it('can opt out with bindToSession: false', async () => {
    const app = appWithSession({ secret: SECRET, bindToSession: false });
    const { res } = await mint(app, await startSession(app));
    expect(() => cookiePair(res, 'bq.csrf')).not.toThrow();
  });
});

describe('server/guard', () => {
  it('allows when the predicate is truthy', async () => {
    const app = createServer();
    app.get('/x', (ctx) => ctx.json({ ok: true }), [guard(() => true)]);
    const res = await app.handle('/x');
    expect(res.status).toBe(200);
  });

  it('denies with 403 by default', async () => {
    const app = createServer();
    app.get('/x', (ctx) => ctx.json({ ok: true }), [guard(() => false)]);
    const res = await app.handle('/x');
    expect(res.status).toBe(403);
  });

  it('supports a custom status', async () => {
    const app = createServer();
    app.get('/x', (ctx) => ctx.json({ ok: true }), [guard(() => false, { status: 401 })]);
    const res = await app.handle('/x');
    expect(res.status).toBe(401);
  });

  it('supports a custom onDeny handler', async () => {
    const app = createServer();
    app.get('/x', (ctx) => ctx.json({ ok: true }), [
      guard(() => false, { onDeny: (ctx) => ctx.redirect('/login') }),
    ]);
    const res = await app.handle('/x');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('awaits async predicates', async () => {
    const app = createServer();
    app.get('/x', (ctx) => ctx.json({ ok: true }), [guard(async () => Promise.resolve(false))]);
    const res = await app.handle('/x');
    expect(res.status).toBe(403);
  });
});

describe('server/basicAuth', () => {
  const build = () => {
    const app = createServer();
    app.use(
      basicAuth({
        verify: ({ username, password }) =>
          username === 'admin' && password === 'pw' ? { username } : false,
      })
    );
    app.get('/x', (ctx) => ctx.json({ user: ctx.state.user }));
    return app;
  };

  it('challenges when no credentials are supplied', async () => {
    const res = await build().handle('/x');
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Basic');
  });

  it('rejects invalid credentials', async () => {
    const res = await build().handle({
      url: '/x',
      headers: { authorization: `Basic ${btoa('admin:wrong')}` },
    });
    expect(res.status).toBe(401);
  });

  it('authenticates valid credentials and exposes the user', async () => {
    const res = await build().handle({
      url: '/x',
      headers: { authorization: `Basic ${btoa('admin:pw')}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { username: 'admin' } });
  });
});

describe('server/bearerAuth', () => {
  const build = () => {
    const app = createServer();
    app.use(bearerAuth({ verify: (token) => (token === 'good' ? { sub: '1' } : false) }));
    app.get('/x', (ctx) => ctx.json({ user: ctx.state.user }));
    return app;
  };

  it('challenges when no token is supplied', async () => {
    const res = await build().handle('/x');
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });

  it('rejects an invalid token', async () => {
    const res = await build().handle({ url: '/x', headers: { authorization: 'Bearer bad' } });
    expect(res.status).toBe(401);
  });

  it('authenticates a valid token', async () => {
    const res = await build().handle({ url: '/x', headers: { authorization: 'Bearer good' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { sub: '1' } });
  });
});
