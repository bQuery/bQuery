/**
 * Cross-runtime smoke test for `@bquery/bquery/ssr`.
 *
 * Exercises the runtime-agnostic SSR pipeline using only Web standard APIs
 * (Request, Response, ReadableStream, fetch, URL, TextEncoder/Decoder).
 *
 * Designed to run unmodified on Node ≥ 24, Bun ≥ 1.3.13 and Deno latest by
 * importing the built ESM bundle (`dist/ssr.es.mjs`). Run `bun run build`
 * first.
 *
 * The runtime is detected automatically; the script exits with a non-zero
 * code on the first failed assertion.
 */

import {
  createResumableState,
  createSSRContext,
  detectRuntime,
  isServerRuntime,
  renderToResponse,
  renderToStream,
  renderToString,
  renderToStringAsync,
  resolveSSRRoute,
  serializeStoreSnapshot,
} from '../../dist/ssr.es.mjs';

const failures = [];
let passed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    const message =
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`  ✗ ${name}`);
    console.error(`    ${message}`);
  }
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const collectStream = async (stream) => {
  const chunks = [];
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join('');
};

const runtimeName =
  typeof globalThis.Bun !== 'undefined'
    ? 'bun'
    : typeof globalThis.Deno !== 'undefined'
      ? 'deno'
      : 'node';

console.log(`bQuery SSR cross-runtime smoke test — runtime: ${runtimeName}`);

await test('detectRuntime returns the active runtime', () => {
  const detected = detectRuntime();
  assert(detected === runtimeName, `expected runtime ${runtimeName}, got ${detected}`);
  assert(isServerRuntime(), 'expected isServerRuntime() to be true');
});

await test('renderToString uses the DOM-free renderer when DOMParser is absent', () => {
  const { html } = renderToString(
    '<main><h1 bq-text="title"></h1><ul><li bq-for="x in items" bq-text="x"></li></ul></main>',
    { title: 'Hello', items: ['a', 'b', 'c'] },
    { stripDirectives: true }
  );
  assert(html.includes('<h1>Hello</h1>'), `unexpected html: ${html}`);
  assert(
    html.includes('<li>a</li>') && html.includes('<li>b</li>') && html.includes('<li>c</li>'),
    `for-loop not rendered correctly: ${html}`
  );
});

await test('annotateHydration emits data-bq-h hashes', () => {
  const { html } = renderToString('<p bq-text="x"></p>', { x: 'y' }, { annotateHydration: true });
  assert(html.includes('data-bq-h="'), `expected hash, got ${html}`);
});

await test('renderToStringAsync resolves promises in the binding context', async () => {
  const { html } = await renderToStringAsync('<p bq-text="msg"></p>', {
    msg: Promise.resolve('async!'),
  });
  assert(html.includes('>async!</p>'), `unexpected: ${html}`);
});

await test('renderToStream produces a UTF-8 ReadableStream', async () => {
  const stream = renderToStream('<p bq-text="x"></p>', { x: 'streamed' });
  const text = await collectStream(stream);
  assert(text.includes('>streamed</p>'), `unexpected: ${text}`);
});

await test('renderToResponse builds a real Response with headers', async () => {
  const response = await renderToResponse(
    '<p bq-text="x"></p>',
    { x: 'res' },
    { etag: true, cacheControl: 'public, max-age=60' }
  );
  assert(response.status === 200, `status was ${response.status}`);
  assert(
    response.headers.get('content-type')?.includes('text/html') === true,
    'wrong content-type'
  );
  assert(response.headers.get('cache-control') === 'public, max-age=60', 'wrong cache-control');
  const body = await response.text();
  assert(body.includes('>res</p>'), `unexpected body: ${body}`);
});

await test('createSSRContext exposes Request-derived metadata', () => {
  const req = new Request('https://example.test/path?q=1', {
    headers: { 'user-agent': 'cross-runtime' },
  });
  const ctx = createSSRContext({ request: req });
  assert(ctx.url.pathname === '/path', `pathname was ${ctx.url.pathname}`);
  assert(ctx.headers.get('user-agent') === 'cross-runtime', 'header missing');
});

await test('resolveSSRRoute matches paths across runtimes', () => {
  const r = resolveSSRRoute({
    url: 'http://x/user/42',
    routes: [{ path: '/user/:id', component: () => null }],
  });
  assert(r.matched && r.route.params.id === '42', `params: ${JSON.stringify(r.route.params)}`);
});

await test('serializeStoreSnapshot returns a valid script tag', () => {
  const { json, scriptTag } = serializeStoreSnapshot({ version: 'v1' });
  assert(JSON.parse(json).version === 'v1', 'version mismatch in JSON');
  assert(scriptTag.startsWith('<script '), `scriptTag: ${scriptTag}`);
});

await test('createResumableState round-trips JSON safely', () => {
  const r = createResumableState();
  r.set('key', { nested: ['ok'] });
  const tag = r.render();
  assert(tag.includes('"nested"'), `unexpected: ${tag}`);
});

console.log(`\n${passed} passed, ${failures.length} failed (${runtimeName}).`);
if (failures.length > 0) {
  const proc = globalThis.process;
  const Deno = globalThis.Deno;
  if (proc?.exit) proc.exit(1);
  else if (Deno?.exit) Deno.exit(1);
  else throw new Error('cross-runtime smoke test failed');
}
