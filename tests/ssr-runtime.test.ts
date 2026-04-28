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
  hydrateIsland,
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

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
};

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

  it('renders with a custom DOMParser even when the global Node constructor is unavailable', () => {
    const originalNodeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Node');
    configureSSR({
      backend: 'dom',
      documentImpl: { DOMParser: globalThis.DOMParser },
    });
    delete (globalThis as { Node?: typeof Node }).Node;
    try {
      const result = renderToString('<div bq-text="msg"></div>', { msg: 'custom-node-less' });
      expect(result.html).toContain('custom-node-less');
    } finally {
      if (originalNodeDescriptor) {
        Object.defineProperty(globalThis, 'Node', originalNodeDescriptor);
      }
    }
  });

  it('skips DOM-backend bq-for clones when clone directives remove them', () => {
    configureSSR({ backend: 'dom' });
    const result = renderToString(
      '<ul><li bq-for="(item, index) in items" bq-if="item"><span bq-text="index"></span></li></ul>',
      { items: [true, false, true] },
      { stripDirectives: true }
    );

    expect(result.html).toContain('0');
    expect(result.html).toContain('2');
    expect(result.html).not.toContain('1');
    expect(result.html).not.toContain('bq-if');
  });

  it('renders zero DOM-backend bq-for items when the list is not an array', () => {
    configureSSR({ backend: 'dom' });
    const result = renderToString(
      '<ul><li bq-for="item in missingItems"><span>template</span></li></ul>',
      {},
      { stripDirectives: true }
    );

    expect(result.html).toContain('<ul></ul>');
    expect(result.html).not.toContain('template');
    expect(result.html).not.toContain('bq-for');
  });

  it('strips invalid DOM-backend bq-for attributes like the pure renderer', () => {
    configureSSR({ backend: 'dom' });
    const result = renderToString('<ul><li bq-for="item items"><span>template</span></li></ul>', {});

    expect(result.html).toContain('<ul><li><span>template</span></li></ul>');
    expect(result.html).not.toContain('bq-for');
  });

  it('strips invalid DOM-backend bq-for attributes even when similarly named context data exists', () => {
    configureSSR({ backend: 'dom' });
    const result = renderToString('<ul><li bq-for="item items"><span>template</span></li></ul>', {
      items: ['A', 'B'],
    });

    expect(result.html).toContain('<ul><li><span>template</span></li></ul>');
    expect(result.html).not.toContain('bq-for');
  });

  it('still processes nested directives after invalid DOM-backend bq-for normalization', () => {
    configureSSR({ backend: 'dom' });
    const result = renderToString(
      '<ul><li bq-for="item items"><span bq-text="label"></span></li></ul>',
      { items: ['A', 'B'], label: 'nested-template' },
      { stripDirectives: true }
    );

    expect(result.html).toContain('<ul><li><span>nested-template</span></li></ul>');
    expect(result.html).not.toContain('bq-for');
    expect(result.html).not.toContain('bq-text');
  });

  it('normalizes invalid DOM-backend bq-for before hydration signature capture', () => {
    configureSSR({ backend: 'dom' });
    const invalid = renderToString(
      '<ul><li bq-for="item items" bq-text="label"></li></ul>',
      { items: ['A', 'B'], label: 'template' },
      { annotateHydration: true }
    );
    const normalized = renderToString(
      '<ul><li bq-text="label"></li></ul>',
      { label: 'template' },
      { annotateHydration: true }
    );

    const domHash = invalid.html.match(/\bdata-bq-h="([^"]+)"/)?.[1];
    const normalizedHash = normalized.html.match(/\bdata-bq-h="([^"]+)"/)?.[1];

    expect(domHash).toBeDefined();
    expect(domHash).toBe(normalizedHash);
    expect(invalid.html).not.toContain('bq-for');
    expect(invalid.html).toContain('template');
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

  it('continues evaluating invalid pure-renderer bq-for elements normally', () => {
    configureSSR({ backend: 'pure' });
    const invalid = renderToString(
      '<ul><li bq-for="item items" bq-class="{ active: on }"><span bq-text="label"></span></li></ul>',
      { on: true, label: 'nested-template' },
      { annotateHydration: true }
    );
    const normalized = renderToString(
      '<ul><li bq-class="{ active: on }"><span bq-text="label"></span></li></ul>',
      { on: true, label: 'nested-template' },
      { annotateHydration: true }
    );

    expect(invalid.html).toBe(normalized.html);
    expect(invalid.html).toContain('active');
    expect(invalid.html).toContain('nested-template');
    expect(invalid.html).not.toContain('bq-for');
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

  it('trims pure-renderer templates like the DOM backend', () => {
    const template = '  <p bq-text="msg"></p>  ';

    configureSSR({ backend: 'pure' });
    const pure = renderToString(template, { msg: 'aligned' }, { stripDirectives: true });

    configureSSR({ backend: 'dom' });
    const dom = renderToString(template, { msg: 'aligned' }, { stripDirectives: true });

    expect(pure.html).toBe(dom.html);
    expect(pure.html).toBe('<p>aligned</p>');
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

  it('does not evaluate the non-taken ternary branch', () => {
    configureSSR({ backend: 'pure' });
    let yesCalls = 0;
    let noCalls = 0;
    const result = renderToString('<p bq-text="ok ? yes() : no()"></p>', {
      ok: true,
      yes() {
        yesCalls++;
        return 'yes';
      },
      no() {
        noCalls++;
        return 'no';
      },
    });

    expect(result.html).toContain('yes');
    expect(yesCalls).toBe(1);
    expect(noCalls).toBe(0);
  });

  it('supports optional chaining', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<p bq-text="user?.name"></p>', { user: undefined });
    expect(result.html).toContain('<p');
  });

  it('does not evaluate skipped optional-chain index expressions', () => {
    configureSSR({ backend: 'pure' });
    let calls = 0;
    const result = renderToString('<p bq-text="user?.[trackKey()] ?? \'fallback\'"></p>', {
      user: undefined,
      trackKey() {
        calls++;
        return 'name';
      },
    });

    expect(result.html).toContain('fallback');
    expect(calls).toBe(0);
  });

  it('does not evaluate skipped optional-chain call arguments', () => {
    configureSSR({ backend: 'pure' });
    let calls = 0;
    const result = renderToString('<p bq-text="user?.format(trackArg()) ?? \'fallback\'"></p>', {
      user: undefined,
      trackArg() {
        calls++;
        return 'Ada';
      },
    });

    expect(result.html).toContain('fallback');
    expect(calls).toBe(0);
  });

  it('supports null coalescing', () => {
    configureSSR({ backend: 'pure' });
    const result = renderToString('<p bq-text="value ?? \'default\'"></p>', { value: null });
    expect(result.html).toContain('default');
  });

  it('does not evaluate a short-circuited && right-hand side', () => {
    configureSSR({ backend: 'pure' });
    let calls = 0;
    const result = renderToString('<p bq-text="ok && track()"></p>', {
      ok: false,
      track() {
        calls++;
        return 'unexpected';
      },
    });

    expect(result.html).toContain('<p');
    expect(result.html).not.toContain('unexpected');
    expect(calls).toBe(0);
  });

  it('does not evaluate a short-circuited || right-hand side', () => {
    configureSSR({ backend: 'pure' });
    let calls = 0;
    const result = renderToString('<p bq-text="value || track()"></p>', {
      value: 'ready',
      track() {
        calls++;
        return 'unexpected';
      },
    });

    expect(result.html).toContain('ready');
    expect(calls).toBe(0);
  });

  it('does not evaluate a short-circuited ?? right-hand side', () => {
    configureSSR({ backend: 'pure' });
    let calls = 0;
    const result = renderToString('<p bq-text="value ?? track()"></p>', {
      value: 0,
      track() {
        calls++;
        return 1;
      },
    });

    expect(result.html).toContain('0');
    expect(calls).toBe(0);
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

  it('ignores prototype-polluting cookie names', () => {
    const request = new Request('http://example.com/page', {
      headers: {
        cookie: 'sid=abc; __proto__=polluted; constructor=bad; prototype=oops',
      },
    });
    const ctx = createSSRContext({ request });

    expect(ctx.cookies.sid).toBe('abc');
    expect(Object.keys(ctx.cookies)).toEqual(['sid']);
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(Object.prototype.hasOwnProperty.call(ctx.cookies, key)).toBe(false);
    }
  });

  it('generates a CSP nonce', () => {
    const ctx = createSSRContext();
    expect(typeof ctx.nonce).toBe('string');
  });

  it('uses native Headers for responseHeaders when available', () => {
    const ctx = createSSRContext();
    ctx.responseHeaders.append('x-test', '1');
    expect(Array.from(ctx.responseHeaders.keys())).toEqual(['x-test']);
  });

  it('falls back structurally when Request-adjacent globals are unavailable', () => {
    const originalRequest = globalThis.Request;
    const originalHeaders = globalThis.Headers;
    const originalAbortController = globalThis.AbortController;
    Object.defineProperty(globalThis, 'Request', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'Headers', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'AbortController', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const ctx = createSSRContext({ url: '/fallback' });
      expect(ctx.request.url).toBe('http://localhost/fallback');
      expect(ctx.url.href).toBe('http://localhost/fallback');
      expect(ctx.headers.get('cookie')).toBeNull();
      expect(ctx.signal.aborted).toBe(false);
      expect(Array.from(ctx.responseHeaders)).toEqual([]);
      expect(typeof ctx.responseHeaders.keys).toBe('undefined');
      ctx.responseHeaders.append('x-fallback', 'test');
      expect(ctx.responseHeaders.get('x-fallback')).toBe('test');
    } finally {
      Object.defineProperty(globalThis, 'Request', {
        value: originalRequest,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, 'Headers', {
        value: originalHeaders,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, 'AbortController', {
        value: originalAbortController,
        configurable: true,
        writable: true,
      });
    }
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

  it('skips weak ETag generation when TextEncoder is unavailable', async () => {
    const originalTextEncoderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
    delete (globalThis as { TextEncoder?: typeof TextEncoder }).TextEncoder;

    try {
      const response = await renderToResponse('<p>etag</p>', {}, { etag: true });
      expect(response.headers.get('etag')).toBeNull();
    } finally {
      if (originalTextEncoderDescriptor) {
        Object.defineProperty(globalThis, 'TextEncoder', originalTextEncoderDescriptor);
      }
    }
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
      ): NodeIncomingMessage {
        /* no-op */
        return this as NodeIncomingMessage;
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
      ): NodeIncomingMessage {
        if (event === 'data') {
          (listener as (chunk: string) => void)('{"ok":true}');
        }
        if (event === 'end') {
          (listener as () => void)();
        }
        return this as NodeIncomingMessage;
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

  it('createNodeHandler falls back to localhost for invalid host headers', async () => {
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
      url: '/bad-host',
      method: 'GET',
      headers: { host: 'bad host' },
      on(
        _event: 'data' | 'end' | 'error',
        _listener:
          | ((chunk: Uint8Array | string) => void)
          | (() => void)
          | ((err: unknown) => void)
      ): NodeIncomingMessage {
        return this as NodeIncomingMessage;
      },
    };
    const wrapped = createNodeHandler(async (request) => {
      expect(request.url).toBe('http://localhost/bad-host');
      return new Response('ok');
    });
    await wrapped(req, res);
  });

  it('createNodeHandler returns 413 when request bodies exceed the configured limit', async () => {
    let body = '';
    const res = {
      statusCode: 0,
      setHeader(_name: string, _value: string | number | readonly string[]) {
        /* no-op */
      },
      write(chunk: string | Uint8Array) {
        body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
        return true;
      },
      end(chunk?: string | Uint8Array) {
        if (chunk) body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      },
    };
    const req: NodeIncomingMessage = {
      url: '/upload',
      method: 'POST',
      headers: { host: 'example.com', 'content-length': '11' },
      on(
        event: 'data' | 'end' | 'error',
        listener:
          | ((chunk: Uint8Array | string) => void)
          | (() => void)
          | ((err: unknown) => void)
      ): NodeIncomingMessage {
        if (event === 'data') {
          (listener as (chunk: string) => void)('hello world');
        }
        if (event === 'end') {
          (listener as () => void)();
        }
        return this as NodeIncomingMessage;
      },
    };
    const wrapped = createNodeHandler(
      async () => {
        throw new Error('handler should not run');
      },
      { maxBodyBytes: 10 }
    );
    await wrapped(req, res);
    expect(res.statusCode).toBe(413);
    expect(body).toContain('Request body exceeds 10 bytes.');
  });

  it('createNodeHandler stops buffering once request bodies exceed the configured limit', async () => {
    let body = '';
    let destroyedWith: Error | undefined;
    let onData: ((chunk: Uint8Array | string) => void) | undefined;
    let onEnd: (() => void) | undefined;
    const allocatedSizes: number[] = [];
    const OriginalArrayBuffer = globalThis.ArrayBuffer;
    Object.defineProperty(globalThis, 'ArrayBuffer', {
      value: new Proxy(OriginalArrayBuffer, {
        construct(target, args, newTarget) {
          allocatedSizes.push(Number(args[0] ?? 0));
          return Reflect.construct(target, args, newTarget);
        },
      }),
      configurable: true,
    });
    const res = {
      statusCode: 0,
      setHeader(_name: string, _value: string | number | readonly string[]) {
        /* no-op */
      },
      write(chunk: string | Uint8Array) {
        body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
        return true;
      },
      end(chunk?: string | Uint8Array) {
        if (chunk) body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      },
    };
    const req: NodeIncomingMessage = {
      url: '/upload',
      method: 'POST',
      headers: { host: 'example.com' },
      destroy(error?: Error) {
        destroyedWith = error;
      },
      on(
        event: 'data' | 'end' | 'error',
        listener:
          | ((chunk: Uint8Array | string) => void)
          | (() => void)
          | ((err: unknown) => void)
      ): NodeIncomingMessage {
        if (event === 'data') onData = listener as (chunk: Uint8Array | string) => void;
        if (event === 'end') onEnd = listener as () => void;
        return this as NodeIncomingMessage;
      },
    };
    try {
      const wrapped = createNodeHandler(
        async () => {
          throw new Error('handler should not run');
        },
        { maxBodyBytes: 10 }
      );
      const pending = wrapped(req, res);
      onData?.(new Uint8Array(11));
      onData?.(new Uint8Array(1024));
      onEnd?.();
      await pending;
      expect(res.statusCode).toBe(413);
      expect(body).toContain('Request body exceeds 10 bytes.');
      expect(destroyedWith?.name).toBe('NodeRequestLimitError');
      expect(allocatedSizes).not.toContain(1035);
    } finally {
      Object.defineProperty(globalThis, 'ArrayBuffer', {
        value: OriginalArrayBuffer,
        configurable: true,
        writable: true,
      });
    }
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
    expect(typeof handle.cancel).toBe('function');
    handle.cancel();
    document.body.removeChild(div);
  });

  it('hydrateOnMedia returns a HydrationHandle', () => {
    const div = document.createElement('div');
    div.id = 'media-island';
    document.body.appendChild(div);
    const handle = hydrateOnMedia('#media-island', { title: signal('x') }, '(min-width: 9999px)');
    expect(typeof handle.cancel).toBe('function');
    handle.cancel();
    document.body.removeChild(div);
  });

  it('hydrateOnMedia falls back to legacy addListener/removeListener', () => {
    const div = document.createElement('div');
    div.id = 'media-legacy-island';
    document.body.appendChild(div);
    const originalMatchMedia = window.matchMedia;
    let registered:
      | ((event: MediaQueryListEvent | MediaQueryList) => void)
      | undefined;
    let removed:
      | ((event: MediaQueryListEvent | MediaQueryList) => void)
      | undefined;
    Object.defineProperty(window, 'matchMedia', {
      value: (() =>
        ({
          matches: false,
          media: '(min-width: 1px)',
          onchange: null,
          addListener(handler: (event: MediaQueryListEvent | MediaQueryList) => void) {
            registered = handler;
          },
          removeListener(handler: (event: MediaQueryListEvent | MediaQueryList) => void) {
            removed = handler;
          },
        }) as LegacyMediaQueryList) as unknown as typeof window.matchMedia,
      configurable: true,
      writable: true,
    });
    try {
      const handle = hydrateOnMedia('#media-legacy-island', { title: signal('x') }, '(min-width: 1px)');
      expect(typeof registered).toBe('function');
      handle.cancel();
      expect(removed).toBe(registered);
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        value: originalMatchMedia,
        configurable: true,
        writable: true,
      });
      document.body.removeChild(div);
    }
  });

  it('hydrateIsland resolves null for missing targets', () => {
    expect(hydrateIsland('#missing-island', { title: signal('x') })).toBeNull();
  });

  it('hydration strategies resolve null for missing targets', async () => {
    const visible = hydrateOnVisible('#missing-visible', { title: signal('v') });
    const idle = hydrateOnIdle('#missing-idle', { title: signal('i') });
    const interaction = hydrateOnInteraction('#missing-interaction', { title: signal('x') });
    const originalMatchMedia = window.matchMedia;
    const matchingMediaQuery = {
      matches: true,
      addEventListener() {
        /* no-op */
      },
      removeEventListener() {
        /* no-op */
      },
    };
    Object.defineProperty(window, 'matchMedia', {
      value: (() => matchingMediaQuery) as unknown as typeof window.matchMedia,
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
