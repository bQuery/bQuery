/**
 * Tests for the runtime-agnostic / DOM-free SSR pipeline.
 *
 * These tests exercise the new public API introduced for cross-runtime SSR:
 * runtime detection, the pure renderer, the safe expression evaluator,
 * `SSRContext`, head/asset managers, async/streaming render, hydration
 * strategies and the runtime adapters.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { signal } from '../src/reactive/index';
import {
  configureSSR,
  createAssetManager,
  createBunHandler,
  createDenoHandler,
  createHeadManager,
  createNodeHandler,
  createSSRContext,
  createSSRHandler,
  createWebHandler,
  defer,
  defineLoader,
  detectRuntime,
  getSSRConfig,
  getSSRRuntimeFeatures,
  hydrateOnIdle,
  hydrateOnInteraction,
  hydrateOnMedia,
  hydrateOnVisible,
  isBrowserRuntime,
  isServerRuntime,
  renderToResponse,
  renderToStream,
  renderToString,
  renderToStringAsync,
  type NodeIncomingMessage,
} from '../src/ssr/index';

afterEach(() => {
  // Reset SSR config so individual tests don't bleed.
  configureSSR({ backend: 'auto', documentImpl: null });
});

describe('runtime detection', () => {
  it('detects a known runtime', () => {
    const rt = detectRuntime();
    // happy-dom installs `window` so isBrowserRuntime() can be true; that's OK.
    expect(['bun', 'deno', 'node', 'browser', 'workerd', 'unknown']).toContain(rt);
  });

  it('isServerRuntime / isBrowserRuntime are mutually exclusive', () => {
    if (isServerRuntime()) expect(isBrowserRuntime()).toBe(false);
    if (isBrowserRuntime()) expect(isServerRuntime()).toBe(false);
  });

  it('reports feature support', () => {
    const features = getSSRRuntimeFeatures();
    expect(typeof features.fetchApi).toBe('boolean');
    expect(typeof features.webStreams).toBe('boolean');
    expect(typeof features.textEncoder).toBe('boolean');
  });
});

describe('configureSSR', () => {
  it('switches to the pure renderer when backend = "pure"', () => {
    configureSSR({ backend: 'pure' });
    expect(getSSRConfig().backend).toBe('pure');
    const result = renderToString('<p bq-text="msg"></p>', { msg: 'pure' });
    expect(result.html).toContain('pure');
  });

  it('forces the DOM backend when configured', () => {
    configureSSR({ backend: 'dom' });
    expect(getSSRConfig().backend).toBe('dom');
    const result = renderToString('<p bq-text="msg"></p>', { msg: 'dom' });
    expect(result.html).toContain('dom');
  });

  it('accepts a custom DOMParser implementation', () => {
    configureSSR({
      backend: 'dom',
      documentImpl: { DOMParser: globalThis.DOMParser },
    });
    expect(getSSRConfig().documentImpl).not.toBeNull();
    const result = renderToString('<div bq-text="msg"></div>', { msg: 'custom' });
    expect(result.html).toContain('custom');
  });
});

describe('pure renderer (DOM-free)', () => {
  it('renders bq-text without a DOMParser', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<h1 bq-text="title"></h1>', { title: 'No DOM' });
    expect(result.html).toContain('<h1');
    expect(result.html).toContain('No DOM');
  });

  it('renders bq-if removing the element when false', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<p bq-if="show">Hello</p>', { show: false });
    expect(result.html).not.toContain('Hello');
  });

  it('renders bq-for', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<ul><li bq-for="item in items" bq-text="item"></li></ul>', {
      items: ['A', 'B', 'C'],
    });
    expect(result.html).toContain('A');
    expect(result.html).toContain('B');
    expect(result.html).toContain('C');
  });

  it('renders bq-class object syntax', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString(
      '<div bq-class="{ active: isActive, disabled: !enabled }"></div>',
      { isActive: true, enabled: false }
    );
    expect(result.html).toContain('active');
    expect(result.html).toContain('disabled');
  });

  it('renders bq-bind:href', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<a bq-bind:href="url">link</a>', { url: '/about' });
    expect(result.html).toContain('href="/about"');
  });

  it('parses unquoted attributes before self-closing custom elements', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<main><my-el a=b/><span>after</span></main>', {});
    expect(result.html).toContain('<my-el a="b"></my-el><span>after</span>');
  });

  it('drops javascript: URLs from bq-bind:href', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<a href="javascript:alert(1)">x</a>', {});
    expect(result.html).not.toContain('javascript');
  });

  it('removes inline event handlers', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<div onclick="alert(1)">hi</div>', {});
    expect(result.html).not.toContain('onclick');
  });

  it('removes <script> tags entirely', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<div>ok<script>alert(1)</script></div>', {});
    expect(result.html).not.toContain('<script');
    expect(result.html).toContain('ok');
  });

  it('unwraps signals automatically', () => {
    configureSSR({ backend: 'pure' });
    const title = signal('Reactive');
    const result = renderToString('<h1 bq-text="title"></h1>', { title });
    expect(result.html).toContain('Reactive');
  });

  it('strips directive attributes when stripDirectives is true', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString(
      '<h1 bq-text="title">x</h1>',
      { title: 'Hello' },
      { stripDirectives: true }
    );
    expect(result.html).not.toContain('bq-text');
    expect(result.html).toContain('Hello');
  });
});

describe('safe expression evaluator', () => {
  it('rejects arbitrary code (no new Function fallback)', () => {
    configureSSR({ backend: 'pure' });
    // The legacy implementation accepted complex expressions via new Function();
    // the new one returns undefined for anything outside the supported grammar.
    const result = renderToString(
      '<p bq-text="(() => 42)()">marker</p>',
      {},
      { stripDirectives: true }
    );
    // Should be rendered as empty <p></p> — no 42 leaking from the expression.
    expect(result.html).not.toContain('42');
    // Original child text is replaced by the (empty) bq-text result.
    expect(result.html).not.toContain('marker');
  });

  it('supports comparisons', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<p bq-if="count > 5">big</p>', { count: 10 });
    expect(result.html).toContain('big');
  });

  it('supports ternary expressions', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString("<p bq-text=\"ok ? 'yes' : 'no'\"></p>", { ok: true });
    expect(result.html).toContain('yes');
  });

  it('supports optional chaining', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<p bq-text="user?.name"></p>', { user: undefined });
    expect(result.html).toContain('<p');
  });

  it('supports null coalescing', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<p bq-text="value ?? \'default\'"></p>', { value: null });
    expect(result.html).toContain('default');
  });

  it('preserves this binding for member calls', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<p bq-text="user.label(\'Ada\')"></p>', {
      user: {
        prefix: 'Dr.',
        label(this: { prefix: string }, name: string) {
          return `${this.prefix} ${name}`;
        },
      },
    });
    expect(result.html).toContain('Dr. Ada');
  });

  it('blocks prototype access via member expressions', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<p bq-text="x.__proto__"></p>', { x: { y: 1 } });
    // Should produce empty text (undefined → '').
    expect(result.html).not.toContain('Object');
  });
});

describe('SSRContext', () => {
  it('parses cookies and locale from the request', () => {
    const request = new Request('http://example.com/page', {
      headers: {
        cookie: 'sid=abc; theme=dark',
        'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
        'user-agent': 'TestBot/1.0',
      },
    });
    const ctx = createSSRContext({ request });
    expect(ctx.cookies.sid).toBe('abc');
    expect(ctx.cookies.theme).toBe('dark');
    expect(ctx.locale).toBe('de-DE');
    expect(ctx.userAgent).toBe('TestBot/1.0');
    expect(ctx.url.pathname).toBe('/page');
  });

  it('generates a CSP nonce', () => {
    const ctx = createSSRContext();
    expect(typeof ctx.nonce).toBe('string');
  });
});

describe('head manager', () => {
  it('renders title, meta, link, and script tags', () => {
    const head = createHeadManager();
    head.add({
      title: 'Page',
      meta: [{ name: 'description', content: 'desc' }],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
      script: [{ src: '/app.js', module: true }],
    });
    const html = head.render();
    expect(html).toContain('<title>Page</title>');
    expect(html).toContain('name="description"');
    expect(html).toContain('href="/favicon.ico"');
    expect(html).toContain('type="module"');
  });

  it('applies a nonce when supplied', () => {
    const head = createHeadManager();
    head.add({ script: [{ body: 'console.log(1)' }] });
    const html = head.render({ nonce: 'abc' });
    expect(html).toContain('nonce="abc"');
  });

  it('escapes </script> sequences in inline bodies', () => {
    const head = createHeadManager();
    head.add({ script: [{ body: '</script><script>alert(1)</script>' }] });
    const html = head.render();
    expect(html).not.toContain('</script><script>');
  });

  it('applies a title template', () => {
    const head = createHeadManager();
    head.add({ title: 'Home', titleTemplate: '%s | Acme' });
    expect(head.render()).toContain('<title>Home | Acme</title>');
  });
});

describe('asset manager', () => {
  it('emits modulepreload, preload and stylesheet links', () => {
    const assets = createAssetManager();
    assets.module('/app.js');
    assets.preload('/font.woff2', { as: 'font', type: 'font/woff2', crossorigin: 'anonymous' });
    assets.style('/main.css');
    const html = assets.render();
    expect(html).toContain('rel="modulepreload"');
    expect(html).toContain('rel="preload"');
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain('as="font"');
  });
});

describe('renderToStringAsync', () => {
  it('awaits Promise values in the context', async () => {
    const result = await renderToStringAsync('<p bq-text="msg"></p>', {
      msg: Promise.resolve('async'),
    });
    expect(result.html).toContain('async');
  });

  it('awaits defer() values', async () => {
    const result = await renderToStringAsync('<p bq-text="msg"></p>', {
      msg: defer(Promise.resolve('deferred')),
    });
    expect(result.html).toContain('deferred');
  });

  it('uses defer fallback when the promise rejects', async () => {
    const errors: unknown[] = [];
    const ctx = createSSRContext({ onError: (e) => errors.push(e) });
    const result = await renderToStringAsync(
      '<p bq-text="msg"></p>',
      { msg: defer(Promise.reject(new Error('boom')), 'fallback') },
      { context: ctx }
    );
    expect(result.html).toContain('fallback');
    expect(errors.length).toBe(1);
  });

  it('runs defineLoader-tagged functions', async () => {
    const loader = defineLoader(async () => 'loaded');
    const result = await renderToStringAsync('<p bq-text="msg"></p>', { msg: loader });
    expect(result.html).toContain('loaded');
  });

  it('injects head and asset HTML into </head>', async () => {
    configureSSR({ backend: 'pure' });
    const ctx = createSSRContext();
    ctx.head.add({ title: 'Hello' });
    ctx.assets.module('/app.js');
    const result = await renderToStringAsync(
      '<html><head></head><body><p bq-text="msg"></p></body></html>',
      { msg: 'x' },
      { context: ctx }
    );
    expect(result.html).toContain('<title>Hello</title>');
    expect(result.html).toContain('rel="modulepreload"');
    // injection should happen before </head>
    expect(result.html.indexOf('<title>')).toBeLessThan(result.html.indexOf('</head>'));
  });

  it('respects an aborted signal', async () => {
    const ac = new AbortController();
    ac.abort();
    const ctx = createSSRContext({ signal: ac.signal });
    expect(renderToStringAsync('<p></p>', {}, { context: ctx })).rejects.toThrow();
  });
});

describe('renderToStream', () => {
  it('emits the rendered HTML through a Web stream', async () => {
    const stream = renderToStream('<p bq-text="msg"></p>', { msg: 'stream' });
    const reader = stream.getReader();
    let html = '';
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value);
    }
    expect(html).toContain('stream');
  });

  it('errors the stream when aborted', async () => {
    const ac = new AbortController();
    const ctx = createSSRContext({ signal: ac.signal });
    const stream = renderToStream('<p bq-text="msg"></p>', { msg: 'x' }, { context: ctx });
    ac.abort();
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toBeDefined();
  });
});

describe('renderToResponse', () => {
  it('returns a Response with text/html content type', async () => {
    const response = await renderToResponse('<p bq-text="msg"></p>', { msg: 'resp' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body).toContain('resp');
  });

  it('honours the Cache-Control option', async () => {
    const response = await renderToResponse('<p>x</p>', {}, { cacheControl: 'public, max-age=60' });
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('computes a weak ETag when requested', async () => {
    const response = await renderToResponse('<p>etag</p>', {}, { etag: true });
    const etag = response.headers.get('etag');
    expect(etag).toMatch(/^W\//);
  });

  it('returns 304 Not Modified when If-None-Match matches', async () => {
    const first = await renderToResponse('<p>etag</p>', {}, { etag: true });
    const etag = first.headers.get('etag')!;
    const ctx = createSSRContext({
      request: new Request('http://x/', { headers: { 'if-none-match': etag } }),
    });
    const second = await renderToResponse('<p>etag</p>', {}, { etag: true, context: ctx });
    expect(second.status).toBe(304);
  });
});

describe('runtime adapters', () => {
  it('createWebHandler is identity', () => {
    const handler = (_req: Request) => new Response('x');
    expect(createWebHandler(handler)).toBe(handler);
  });

  it('createBunHandler wraps a handler and returns Response', async () => {
    const wrapped = createBunHandler(() => new Response('bun'));
    const r = await wrapped(new Request('http://x/'));
    expect(await r.text()).toBe('bun');
  });

  it('createDenoHandler wraps a handler and returns Response', async () => {
    const wrapped = createDenoHandler(() => new Response('deno'));
    const r = await wrapped(new Request('http://x/'));
    expect(await r.text()).toBe('deno');
  });

  it('createNodeHandler converts Node http req/res into a fetch handler', async () => {
    const headerStore: Record<string, string | number | readonly string[]> = {};
    let body = '';
    let ended = false;
    const res = {
      statusCode: 0,
      setHeader(name: string, value: string | number | readonly string[]) {
        headerStore[name.toLowerCase()] = value;
      },
      write(chunk: string | Uint8Array) {
        body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
        return true;
      },
      end(chunk?: string | Uint8Array) {
        if (chunk) {
          body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
        }
        ended = true;
      },
    };
    const req: NodeIncomingMessage = {
      url: '/path?q=1',
      method: 'GET',
      headers: { host: 'example.com', 'x-test': 'value' },
      on(
        _event: 'data' | 'end' | 'error',
        _listener:
          | ((chunk: Uint8Array | string) => void)
          | (() => void)
          | ((err: unknown) => void)
      ) {
        /* no-op */
      },
    };
    const wrapped = createNodeHandler(async (request) => {
      expect(request.url).toBe('http://example.com/path?q=1');
      expect(request.headers.get('x-test')).toBe('value');
      return new Response('node-ok', { status: 201, headers: { 'x-y': '1' } });
    });
    await wrapped(req, res);
    expect(res.statusCode).toBe(201);
    expect(headerStore['x-y']).toBe('1');
    expect(body).toBe('node-ok');
    expect(ended).toBe(true);
  });

  it('createNodeHandler preserves Node request bodies', async () => {
    const res = {
      statusCode: 0,
      setHeader(_name: string, _value: string | number | readonly string[]) {
        /* no-op */
      },
      write(_chunk: string | Uint8Array) {
        return true;
      },
      end(_chunk?: string | Uint8Array) {
        /* no-op */
      },
    };
    const req: NodeIncomingMessage = {
      url: '/submit',
      method: 'POST',
      headers: { host: 'example.com', 'content-type': 'application/json' },
      on(
        event: 'data' | 'end' | 'error',
        listener:
          | ((chunk: Uint8Array | string) => void)
          | (() => void)
          | ((err: unknown) => void)
      ) {
        if (event === 'data') {
          (listener as (chunk: string) => void)('{"ok":true}');
        }
        if (event === 'end') {
          (listener as () => void)();
        }
      },
    };
    const wrapped = createNodeHandler(async (request) => {
      expect(request.method).toBe('POST');
      expect(request.headers.get('content-type')).toBe('application/json');
      expect(await request.text()).toBe('{"ok":true}');
      return new Response('ok');
    });
    await wrapped(req, res);
  });

  it('createSSRHandler returns a runtime-appropriate adapter', () => {
    const handler = (_req: Request) => new Response('ok');
    const wrapped = createSSRHandler(handler);
    expect(typeof wrapped).toBe('function');
  });
});

describe('hydration strategies', () => {
  // happy-dom doesn't provide IntersectionObserver, so hydrateOnVisible falls
  // back to immediate hydration. We mainly check the API is callable and
  // returns a HydrationHandle.
  it('hydrateOnVisible returns a HydrationHandle', () => {
    const div = document.createElement('div');
    div.id = 'visible-island';
    div.innerHTML = '<span bq-text="title"></span>';
    document.body.appendChild(div);
    const handle = hydrateOnVisible('#visible-island', { title: signal('v') });
    expect(typeof handle.cancel).toBe('function');
    expect(handle.ready).toBeInstanceOf(Promise);
    handle.cancel();
    document.body.removeChild(div);
  });

  it('hydrateOnIdle resolves and hydrates', async () => {
    const div = document.createElement('div');
    div.id = 'idle-island';
    div.innerHTML = '<span bq-text="title"></span>';
    document.body.appendChild(div);
    const handle = hydrateOnIdle('#idle-island', { title: signal('i') });
    const view = await handle.ready;
    expect(view).not.toBeNull();
    document.body.removeChild(div);
  });

  it('hydrateOnInteraction returns a HydrationHandle', () => {
    const div = document.createElement('div');
    div.id = 'interaction-island';
    document.body.appendChild(div);
    const handle = hydrateOnInteraction('#interaction-island', { title: signal('x') });
    expect(handle.cancel).toBeFunction();
    handle.cancel();
    document.body.removeChild(div);
  });

  it('hydrateOnMedia returns a HydrationHandle', () => {
    const div = document.createElement('div');
    div.id = 'media-island';
    document.body.appendChild(div);
    const handle = hydrateOnMedia('#media-island', { title: signal('x') }, '(min-width: 9999px)');
    expect(handle.cancel).toBeFunction();
    handle.cancel();
    document.body.removeChild(div);
  });

  it('hydration strategies resolve null for missing targets', async () => {
    const visible = hydrateOnVisible('#missing-visible', { title: signal('v') });
    const idle = hydrateOnIdle('#missing-idle', { title: signal('i') });
    const interaction = hydrateOnInteraction('#missing-interaction', { title: signal('x') });
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const media = hydrateOnMedia('#missing-media', { title: signal('x') }, '(min-width: 1px)');
      expect(await visible.ready).toBeNull();
      expect(await idle.ready).toBeNull();
      expect(await interaction.ready).toBeNull();
      expect(await media.ready).toBeNull();
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        value: originalMatchMedia,
        configurable: true,
        writable: true,
      });
    }
  });

  it('hydrateOnIdle resolves null when document is unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const handle = hydrateOnIdle('#server-only', { title: signal('i') });
      expect(await handle.ready).toBeNull();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'document', descriptor);
      }
    }
  });
});
