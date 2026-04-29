/**
 * Tests for the SSR follow-up: hydration mismatch detection, Suspense
 * streaming, router/store deep integration, and resumability hooks.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { createStore, destroyStore } from '../src/store/index';
import {
  createResumableState,
  createSSRContext,
  createSSRRouterContext,
  defer,
  HYDRATION_HASH_ATTR,
  hydrateStoreSnapshot,
  renderToStreamSuspense,
  renderToString,
  renderToStringAsync,
  resolveSSRRoute,
  resumeState,
  runRouteLoaders,
  serializeStoreSnapshot,
  verifyHydration,
  type SSRStoreSnapshot,
  type SuspenseStreamOptions,
} from '../src/ssr/index';

const expectType = <T>(_value: T): void => {};

const collectStream = async (stream: ReadableStream<Uint8Array>): Promise<string> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(merged);
};

const collectStreamChunks = async (stream: ReadableStream<Uint8Array>): Promise<string[]> => {
  const reader = stream.getReader();
  const out: string[] = [];
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) out.push(decoder.decode(value, { stream: true }));
  }
  out.push(decoder.decode());
  return out.filter((s) => s.length > 0);
};

const extractHydrationHash = (html: string): string => {
  const match = html.match(/\bdata-bq-h="([^"]+)"/i);
  if (!match) {
    throw new Error(`Expected SSR HTML to include ${HYDRATION_HASH_ATTR}: ${html}`);
  }
  return match[1];
};

describe('hydration mismatch detection', () => {
  it('emits data-bq-h annotations on directive elements with annotateHydration', () => {
    const { html } = renderToString(
      '<div bq-text="title"></div><span bq-if="show"></span>',
      { title: 'Hi', show: true },
      { annotateHydration: true }
    );
    expect(html).toContain(HYDRATION_HASH_ATTR);
    expect(html).toMatch(/<div [^>]*data-bq-h="[a-z0-9]+"/);
    expect(html).toMatch(/<span [^>]*data-bq-h="[a-z0-9]+"/);
  });

  it('does not emit annotations by default', () => {
    const { html } = renderToString('<div bq-text="x"></div>', { x: 'hi' });
    expect(html).not.toContain(HYDRATION_HASH_ATTR);
  });

  it('strips bq-* directives but preserves data-bq-h when stripDirectives is true', () => {
    const { html } = renderToString(
      '<div bq-text="x"></div>',
      { x: 'hi' },
      { annotateHydration: true, stripDirectives: true }
    );
    expect(html).not.toContain('bq-text=');
    expect(html).toContain(HYDRATION_HASH_ATTR);
  });

  it('verifyHydration returns no mismatches when DOM matches the annotation', () => {
    const root = document.createElement('div');
    const html = renderToString('<p bq-text="msg"></p>', { msg: 'hello' }, { annotateHydration: true }).html;
    const p = document.createElement('p');
    p.setAttribute('bq-text', 'msg');
    p.setAttribute(HYDRATION_HASH_ATTR, extractHydrationHash(html));
    p.textContent = 'hello';
    root.replaceChildren(p);
    document.body.appendChild(root);
    const mismatches = verifyHydration(root, { warn: false });
    expect(mismatches).toHaveLength(0);
    root.remove();
  });

  it('verifyHydration flags mismatches when directives diverge', () => {
    const root = document.createElement('div');
    const html = renderToString('<p bq-text="msg"></p>', { msg: 'hello' }, { annotateHydration: true }).html;
    const initial = document.createElement('p');
    initial.setAttribute('bq-text', 'msg');
    initial.setAttribute(HYDRATION_HASH_ATTR, extractHydrationHash(html));
    initial.textContent = 'hello';
    root.replaceChildren(initial);
    document.body.appendChild(root);
    // Mutate the directive on the live DOM to simulate divergence.
    const hydrated = root.querySelector('p') as HTMLElement;
    hydrated.setAttribute('bq-text', 'changedExpression');
    const collected: string[] = [];
    const mismatches = verifyHydration(root, {
      warn: false,
      onMismatch: (m) => collected.push(m.element.tagName),
    });
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].expected).not.toBe(mismatches[0].actual);
    expect(collected).toEqual(['P']);
    root.remove();
  });

  it('verifyHydration is a safe no-op when the root has no querySelectorAll', () => {
    expect(verifyHydration(null as unknown as Element, { warn: false })).toEqual([]);
    expect(verifyHydration({} as Element, { warn: false })).toEqual([]);
  });

  it('verifyHydration respects the shared __BQUERY_DEV__ override for default warnings', () => {
    const root = document.createElement('div');
    const html = renderToString('<p bq-text="msg"></p>', { msg: 'hello' }, { annotateHydration: true }).html;
    const p = document.createElement('p');
    p.setAttribute('bq-text', 'changedExpression');
    p.setAttribute(HYDRATION_HASH_ATTR, extractHydrationHash(html));
    p.textContent = 'hello';
    root.replaceChildren(p);
    document.body.appendChild(root);

    const globalWithDev = globalThis as typeof globalThis & { __BQUERY_DEV__?: boolean };
    const hadOwnDevOverride = Object.prototype.hasOwnProperty.call(globalWithDev, '__BQUERY_DEV__');
    const originalDev = globalWithDev.__BQUERY_DEV__;
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    globalWithDev.__BQUERY_DEV__ = false;

    try {
      const mismatches = verifyHydration(root);
      expect(mismatches).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    } finally {
      console.warn = originalWarn;
      if (hadOwnDevOverride) {
        globalWithDev.__BQUERY_DEV__ = originalDev;
      } else {
        delete globalWithDev.__BQUERY_DEV__;
      }
      root.remove();
    }
  });

  it('verifyHydration mismatches stripped annotations because directives are no longer available', () => {
    const root = document.createElement('div');
    const html = renderToString('<p bq-text="msg"></p>', { msg: 'hello' }, {
      annotateHydration: true,
      stripDirectives: true,
    }).html;
    const p = document.createElement('p');
    p.setAttribute(HYDRATION_HASH_ATTR, extractHydrationHash(html));
    p.textContent = 'hello';
    root.replaceChildren(p);
    document.body.appendChild(root);

    try {
      const mismatches = verifyHydration(root, { warn: false });
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0].signature).toBe('');
      expect(mismatches[0].expected).not.toBe(mismatches[0].actual);
    } finally {
      root.remove();
    }
  });
});

describe('renderToStreamSuspense', () => {
  it('accepts only the supported suspense stream options at compile time', () => {
    expectType<SuspenseStreamOptions>({
      context: createSSRContext(),
      prefix: 'bq',
      stripDirectives: true,
      annotateHydration: true,
      slotIdPrefix: 'slot',
      slotTag: 'x-slot',
    });

    // @ts-expect-error renderToStreamSuspense does not support async head injection options
    expectType<SuspenseStreamOptions>({ injectHead: false });
    // @ts-expect-error renderToStreamSuspense does not support store serialization options
    expectType<SuspenseStreamOptions>({ storeScriptId: 'bq-store' });
    // @ts-expect-error renderToStreamSuspense does not support store serialization options
    expectType<SuspenseStreamOptions>({ storeGlobalKey: '__BQUERY_STORE__' });
  });

  it('flushes the synchronous shell with the deferred fallback first', async () => {
    let resolve!: (v: string) => void;
    const promise = new Promise<string>((r) => (resolve = r));
    const stream = renderToStreamSuspense(
      '<div><span bq-defer="user" bq-text="user"></span></div>',
      { user: defer(promise, 'loading…') }
    );
    const chunks = collectStreamChunks(stream);
    // Resolve after a tick so the shell flushes first.
    setTimeout(() => resolve('ada'), 5);
    const all = (await chunks).join('');
    expect(all).toContain('loading…');
    expect(all).toContain('<bq-slot');
    expect(all).toContain('<span bq-text="user"><bq-slot');
    expect(all).toContain('<template');
    expect(all).toContain('ada');
  });

  it('preserves marker element attributes while wrapping its children', async () => {
    const stream = renderToStreamSuspense(
      '<section class="card" bq-defer="user"><p bq-text="user"></p></section>',
      { user: defer(Promise.resolve('ada'), 'loading') }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<section class="card"><bq-slot id="bq-s-0">');
    expect(out).toContain('<p bq-text="user">loading</p>');
    expect(out).not.toContain('data-bq-defer');
  });

  it('accepts single-quoted and unquoted defer markers', async () => {
    const stream = renderToStreamSuspense(
      "<main><section bq-defer='user'><span bq-text='user'></span></section><aside bq-defer=post><span bq-text='post'></span></aside></main>",
      {
        user: defer(Promise.resolve('ada'), 'loading user'),
        post: defer(Promise.resolve('news'), 'loading post'),
      }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<section><bq-slot id="bq-s-0">');
    expect(out).toContain('<aside><bq-slot id="bq-s-1">');
    expect(out).not.toContain('data-bq-defer');
  });

  it('places markers before directive stripping removes bq-* attributes', async () => {
    const stream = renderToStreamSuspense(
      '<main><section class="card" bq-defer="user"><span bq-text="user"></span></section></main>',
      { user: defer(Promise.resolve('ada'), 'loading') },
      { stripDirectives: true }
    );
    const out = await collectStream(stream);
    expect(out).toContain(
      '<section class="card"><bq-slot id="bq-s-0"><span>loading</span></bq-slot></section>'
    );
    expect(out).not.toContain('bq-text');
    expect(out).not.toContain('data-bq-defer');
  });

  it('removes internal defer markers even when no deferred slot matches', async () => {
    const stream = renderToStreamSuspense(
      '<main><section class="card" bq-defer="user"><span>ready</span></section></main>',
      { user: 'ada' }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<section class="card"><span>ready</span></section>');
    expect(out).not.toContain('data-bq-defer');
    expect(out).not.toContain('<bq-slot');
  });

  it('appends a placeholder when no bq-defer marker is present', async () => {
    const stream = renderToStreamSuspense('<main><h1>Hello</h1></main>', {
      later: defer(Promise.resolve('boom'), undefined),
    });
    const out = await collectStream(stream);
    expect(out).toContain('<bq-slot id="bq-s-0">');
    expect(out).toContain('<template id="bq-r-0">boom</template>');
  });

  it('keeps resolved template IDs distinct for custom slot prefixes', async () => {
    const stream = renderToStreamSuspense(
      '<main><h1>Hello</h1></main>',
      { later: defer(Promise.resolve('boom'), undefined) },
      { slotIdPrefix: 'slot' }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<bq-slot id="slot-0">');
    expect(out).toContain('<template id="slot-r-0">boom</template>');
    expect(out).toContain('data-bq-slot="slot-0" data-bq-template="slot-r-0"');
  });

  it('does not double the resolved suffix for custom -r slot prefixes', async () => {
    const stream = renderToStreamSuspense(
      '<main><h1>Hello</h1></main>',
      { later: defer(Promise.resolve('boom'), undefined) },
      { slotIdPrefix: 'slot-r' }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<bq-slot id="slot-r-0">');
    expect(out).toContain('<template id="slot-r-template-0">boom</template>');
  });

  it('does not rewrite custom-element tag names named bq-defer', async () => {
    const stream = renderToStreamSuspense(
      '<main><bq-defer>keep me</bq-defer><section bq-defer="user"><span bq-text="user"></span></section></main>',
      { user: defer(Promise.resolve('ada'), 'loading') }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<bq-defer>keep me</bq-defer>');
    expect(out).toContain('<section><bq-slot id="bq-s-0">');
    expect(out).not.toContain('bq-defer="user"');
    expect(out).not.toContain('<data-bq-defer');
    expect(out).not.toContain('</data-bq-defer>');
  });

  it('falls back to bq-slot when slotTag is invalid', async () => {
    const stream = renderToStreamSuspense(
      '<main><section bq-defer="user"><span bq-text="user"></span></section></main>',
      { user: defer(Promise.resolve('ada'), 'loading') },
      { slotTag: 'script type="text/javascript"' }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<bq-slot id="bq-s-0">');
    expect(out).not.toContain('<script type="text/javascript"');
  });

  it('falls back to bq-slot when slotTag uses uppercase characters', async () => {
    const stream = renderToStreamSuspense(
      '<main><section bq-defer="user"><span bq-text="user"></span></section></main>',
      { user: defer(Promise.resolve('ada'), 'loading') },
      { slotTag: 'X-Slot' }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<bq-slot id="bq-s-0">');
    expect(out).not.toContain('<X-Slot');
  });

  it('accepts valid custom-element slot tags', async () => {
    const stream = renderToStreamSuspense(
      '<main><section bq-defer="user"><span bq-text="user"></span></section></main>',
      { user: defer(Promise.resolve('ada'), 'loading') },
      { slotTag: 'x-slot' }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<x-slot id="bq-s-0">');
    expect(out).toContain('</x-slot>');
  });

  it('wraps marked elements structurally when nested tags share the same name', async () => {
    const stream = renderToStreamSuspense(
      '<div><section bq-defer="user"><section><span bq-text="user"></span></section></section></div>',
      { user: defer(Promise.resolve('ada'), 'loading') }
    );
    const out = await collectStream(stream);
    expect(out).toContain(
      '<section><bq-slot id="bq-s-0"><section><span bq-text="user">loading</span></section></bq-slot></section>'
    );
  });

  it('preserves quoted > characters while wrapping marked elements', async () => {
    const stream = renderToStreamSuspense(
      '<main><section data-note="a > b" bq-defer="user"><span bq-text="user"></span></section></main>',
      { user: defer(Promise.resolve('ada'), 'loading') }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<section data-note="a > b"><bq-slot id="bq-s-0">');
    expect(out).not.toContain('data-bq-defer');
  });

  it('honours the SSRContext nonce on patch scripts', async () => {
    const ctx = createSSRContext({ nonce: 'NONCE123' });
    const stream = renderToStreamSuspense(
      '<div></div>',
      { x: defer(Promise.resolve('y')) },
      { context: ctx }
    );
    const out = await collectStream(stream);
    expect(out).toContain('nonce="NONCE123"');
  });

  it('aborts when the SSR context signal fires', async () => {
    const ac = new AbortController();
    const ctx = createSSRContext({ signal: ac.signal });
    ac.abort();
    const stream = renderToStreamSuspense('<div></div>', {}, { context: ctx });
    await expect(collectStream(stream)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports loader errors via SSRContext.onError without aborting the stream', async () => {
    const errors: unknown[] = [];
    const ctx = createSSRContext({ onError: (e) => errors.push(e) });
    const stream = renderToStreamSuspense(
      '<div></div>',
      { x: defer(Promise.reject(new Error('boom'))) },
      { context: ctx }
    );
    const out = await collectStream(stream);
    expect(out).toContain('<template id="bq-r-0"></template>');
    expect(errors).toHaveLength(1);
  });

  it('escapes HTML in resolved text fragments', async () => {
    const stream = renderToStreamSuspense('<div></div>', {
      x: defer(Promise.resolve('<script>alert(1)</script>')),
    });
    const out = await collectStream(stream);
    expect(out).toContain('&lt;script&gt;');
    // The ONLY <script> tag in the output should be the patch script, not the
    // injected payload.
    const scriptMatches = out.match(/<script[^>]*>/gi) ?? [];
    expect(scriptMatches.length).toBe(1);
  });

  it('patches every slot when multiple deferred values share a promise', async () => {
    const shared = Promise.resolve('done');
    const stream = renderToStreamSuspense('<main></main>', {
      first: defer(shared, 'one'),
      second: defer(shared, 'two'),
    });
    const out = await collectStream(stream);
    expect(out).toContain('<bq-slot id="bq-s-0">');
    expect(out).toContain('<bq-slot id="bq-s-1">');
    expect(out).toContain('<template id="bq-r-0">done</template>');
    expect(out).toContain('<template id="bq-r-1">done</template>');
  });
});

describe('router-bridge', () => {
  const routes = [
    { path: '/', component: () => null },
    {
      path: '/user/:id',
      component: () => null,
      meta: {
        loader: async ({ route }: { route: { params: Record<string, string> } }) => ({
          id: route.params.id,
        }),
      },
    },
    { path: '/old', redirectTo: '/new' },
  ];

  it('resolveSSRRoute matches paths and extracts params', () => {
    const r = resolveSSRRoute({ url: 'http://x/user/42?tab=info', routes });
    expect(r.matched).toBe(true);
    expect(r.route.params).toEqual({ id: '42' });
    expect(r.route.query).toEqual({ tab: 'info' });
    expect(r.isRedirect).toBe(false);
  });

  it('resolveSSRRoute reports redirects', () => {
    const r = resolveSSRRoute({ url: 'http://x/old', routes });
    expect(r.isRedirect).toBe(true);
    expect(r.redirectTo).toBe('/new');
  });

  it('resolveSSRRoute returns matched=false for unknown paths', () => {
    const r = resolveSSRRoute({ url: 'http://x/missing', routes });
    expect(r.matched).toBe(false);
    expect(r.route.path).toBe('/missing');
  });

  it('resolveSSRRoute strips the configured base prefix', () => {
    const r = resolveSSRRoute({ url: 'http://x/app/user/7', routes, base: '/app' });
    expect(r.matched).toBe(true);
    expect(r.route.params.id).toBe('7');
  });

  it('resolveSSRRoute does not strip partial base path collisions', () => {
    const r = resolveSSRRoute({ url: 'http://x/application', routes, base: '/app' });
    expect(r.matched).toBe(false);
    expect(r.route.path).toBe('/application');
  });

  it('resolveSSRRoute maps the exact base path to root', () => {
    const r = resolveSSRRoute({ url: 'http://x/app', routes, base: '/app' });
    expect(r.matched).toBe(true);
    expect(r.route.path).toBe('/');
  });

  it('runRouteLoaders invokes meta.loader with the route + ctx', async () => {
    const ctx = createSSRContext();
    const r = resolveSSRRoute({ url: 'http://x/user/9', routes });
    const data = (await runRouteLoaders(r.route, ctx)) as { id: string };
    expect(data).toEqual({ id: '9' });
  });

  it('runRouteLoaders reports loader errors via ctx.reportError', async () => {
    const errors: unknown[] = [];
    const ctx = createSSRContext({ onError: (e) => errors.push(e) });
    const r = {
      path: '/x',
      params: {},
      query: {},
      hash: '',
      matched: {
        path: '/x',
        component: () => null,
        meta: {
          loader: () => {
            throw new Error('nope');
          },
        },
      },
    };
    const data = await runRouteLoaders(r as never, ctx);
    expect(data).toBeUndefined();
    expect(errors).toHaveLength(1);
  });

  it('createSSRRouterContext returns merged bindings', async () => {
    const ctx = createSSRContext();
    const built = await createSSRRouterContext({
      url: 'http://x/user/3',
      routes,
      ctx,
    });
    expect(built.matched).toBe(true);
    expect(built.bindings.params).toEqual({ id: '3' });
    expect(built.bindings.data).toEqual({ id: '3' });
  });
});

describe('versioned store snapshots', () => {
  afterEach(() => {
    try {
      destroyStore('counter');
    } catch {
      /* ok */
    }
  });

  it('serializeStoreSnapshot captures all registered store states with a version', () => {
    createStore({ id: 'counter', state: () => ({ count: 7 }) });
    const { snapshot, json, scriptTag } = serializeStoreSnapshot({ version: '1' });
    expect(snapshot.version).toBe('1');
    expect(snapshot.state.counter).toEqual({ count: 7 });
    expect(JSON.parse(json)).toEqual(snapshot as unknown as Record<string, unknown>);
    expect(scriptTag).toContain('window["__BQUERY_STORE_SNAPSHOT__"]=');
  });

  it('serializeStoreSnapshot embeds the CSP nonce when provided', () => {
    createStore({ id: 'counter', state: () => ({ count: 1 }) });
    const { scriptTag } = serializeStoreSnapshot({ version: '1', nonce: 'XYZ' });
    expect(scriptTag).toContain('nonce="XYZ"');
  });

  it('serializeStoreSnapshot rejects empty versions', () => {
    expect(() => serializeStoreSnapshot({ version: '' })).toThrow(/version/);
  });

  it('hydrateStoreSnapshot applies state when the version matches', () => {
    const store = createStore({ id: 'counter', state: () => ({ count: 0 }) });
    const snap: SSRStoreSnapshot = { version: '1', state: { counter: { count: 99 } } };
    const r = hydrateStoreSnapshot(snap, { expectedVersion: '1' });
    expect(r.applied).toBe(true);
    expect(r.appliedIds).toContain('counter');
    expect(store.count).toBe(99);
  });

  it('hydrateStoreSnapshot skips on version mismatch', () => {
    createStore({ id: 'counter', state: () => ({ count: 0 }) });
    const snap: SSRStoreSnapshot = { version: '1', state: { counter: { count: 1 } } };
    const r = hydrateStoreSnapshot(snap, { expectedVersion: '2' });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('version-mismatch');
  });

  it('hydrateStoreSnapshot reports unknown ids in strict mode', () => {
    const original = console.warn;
    const calls: string[] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args.map(String).join(' '));
    };
    try {
      const snap: SSRStoreSnapshot = { version: '1', state: { ghost: { x: 1 } } };
      const r = hydrateStoreSnapshot(snap, { strict: true });
      expect(r.applied).toBe(false);
      expect(r.unknownIds).toEqual(['ghost']);
      expect(calls.some((l) => l.includes('ghost'))).toBe(true);
    } finally {
      console.warn = original;
    }
  });

  it('renderToStringAsync injects CSP nonces into store-state scripts', async () => {
    createStore({ id: 'counter', state: () => ({ count: 1 }) });
    const context = createSSRContext({ nonce: 'ASYNC_"<&' });
    const { html, storeScriptTag } = await renderToStringAsync(
      '<html><head></head><body><main></main></body></html>',
      {},
      { context, includeStoreState: true }
    );
    expect(html).not.toContain('__BQUERY_STORE_STATE__');
    expect(storeScriptTag).toContain(
      '<script nonce="ASYNC_&quot;&lt;&amp;" id="__BQUERY_STORE_STATE__">'
    );
  });

  it('renderToStringAsync reuses one serialized store snapshot for storeState and HTML', async () => {
    let reads = 0;
    createStore({
      id: 'counter',
      state: () => ({
        get count() {
          reads += 1;
          return reads;
        },
      }),
    });
    const { html, storeScriptTag, storeState } = await renderToStringAsync(
      '<html><head></head><body><main></main></body></html>',
      {},
      { includeStoreState: true }
    );
    expect(html).not.toContain('window["__BQUERY_INITIAL_STATE__"]');
    expect(storeState).toBe('{"counter":{"count":1}}');
    expect(storeScriptTag).toContain('window["__BQUERY_INITIAL_STATE__"]={"counter":{"count":1}}');
  });

  it('hydrateStoreSnapshot rejects invalid shapes', () => {
    const r = hydrateStoreSnapshot({ wrong: true });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('invalid-shape');
  });
});

describe('resumability hooks', () => {
  it('createResumableState collects entries and renders a script tag', () => {
    const r = createResumableState();
    r.set('user', { id: 1 });
    r.set('flags', ['a', 'b']);
    expect(r.get<{ id: number }>('user')).toEqual({ id: 1 });
    const tag = r.render({ nonce: 'N1' });
    expect(tag).toContain('id="__BQUERY_RESUME__"');
    expect(tag).toContain('nonce="N1"');
    expect(tag).toContain('"id":1');
  });

  it('resumeState reads the snapshot from window and cleans up', () => {
    (window as unknown as Record<string, unknown>).__BQUERY_RESUME__ = { hello: 'world' };
    const reader = resumeState();
    expect(reader.hasSnapshot).toBe(true);
    expect(reader.get<string>('hello')).toBe('world');
    expect((window as unknown as Record<string, unknown>).__BQUERY_RESUME__).toBeUndefined();
  });

  it('resumeState returns an empty reader when no snapshot is present', () => {
    delete (window as unknown as Record<string, unknown>).__BQUERY_RESUME__;
    const reader = resumeState();
    expect(reader.hasSnapshot).toBe(false);
    expect(reader.get('anything')).toBeUndefined();
  });

  it('resumable script does not break out of <script> tags', () => {
    const r = createResumableState();
    r.set('xss', '</script><script>alert(1)</script>');
    const tag = r.render();
    expect(tag).not.toMatch(/<\/script><script>alert/);
    expect(tag).toContain('\\u003c\\u002fscript\\u003e');
  });
});
