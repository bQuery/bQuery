import { describe, expect, it } from 'bun:test';
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
    const cookie = cookiePair(login, 'bq.sid');

    const me = await app.handle({ url: '/me', headers: { cookie } });
    expect(await me.json()).toEqual({ userId: 'u_1' });
  });

  it('signs the session cookie with secure-by-default attributes', async () => {
    const app = buildApp(memoryStore());
    const login = await app.handle({ url: '/login', method: 'POST' });
    const attributes = setCookieAttributes(login, 'bq.sid');
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

  it('ignores a tampered session cookie', async () => {
    const store = memoryStore();
    const app = buildApp(store);
    const login = await app.handle({ url: '/login', method: 'POST' });
    const cookie = cookiePair(login, 'bq.sid');
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
    const cookie = cookiePair(login, 'bq.sid');

    const logout = await app.handle({ url: '/logout', method: 'POST', headers: { cookie } });
    expect(setCookieAttributes(logout, 'bq.sid')).toContain('Max-Age=0');

    const me = await app.handle({ url: '/me', headers: { cookie } });
    expect(await me.json()).toEqual({ userId: null });
  });

  it('regenerates the id and invalidates the old session (fixation defense)', async () => {
    const store = memoryStore();
    const app = buildApp(store);
    const login = await app.handle({ url: '/login', method: 'POST' });
    const oldCookie = cookiePair(login, 'bq.sid');

    const rotate = await app.handle({
      url: '/rotate',
      method: 'POST',
      headers: { cookie: oldCookie },
    });
    const body = await rotate.json();
    expect(body.after).not.toBe(body.before);
    const newCookie = cookiePair(rotate, 'bq.sid');
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
    const cookie = cookiePair(login, 'bq.sid');
    const me = await app.handle({ url: '/me', headers: { cookie } });
    // A read-only request re-issues the same session cookie with a fresh Max-Age.
    const rolled = setCookieAttributes(me, 'bq.sid');
    expect(rolled).toContain('Max-Age=');
    expect(cookiePair(me, 'bq.sid')).toBe(cookie);
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
    const cookie = cookiePair(login, 'bq.sid');

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
    const cookie = cookiePair(reset, 'bq.sid');
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
    const cookie = cookiePair(login, 'bq.sid');
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
    expect(() => cookiePair(res, 'bq.csrf')).not.toThrow();
  });

  it('marks the CSRF secret cookie Secure by default (#169)', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));

    const res = await app.handle('/token');
    expect(setCookieAttributes(res, 'bq.csrf')).toContain('Secure');
  });

  it('allows opting out of Secure on the CSRF cookie (#169)', async () => {
    const app = createServer();
    app.use(csrf({ secret: SECRET, cookie: { secure: false } }));
    app.get('/token', (ctx) => ctx.json({ token: csrfToken(ctx) }));

    const res = await app.handle('/token');
    expect(setCookieAttributes(res, 'bq.csrf')).not.toContain('Secure');
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
    const cookie = cookiePair(tokenRes, 'bq.csrf');

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
    const cookie = cookiePair(tokenRes, 'bq.csrf');

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
    const cookie = cookiePair(tokenRes, 'bq.csrf');

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
    const cookie = cookiePair(tokenRes, 'bq.csrf');

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
