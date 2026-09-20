/**
 * Static asset serving (#222).
 *
 * The server module had no way to send a file from disk, so every app needed
 * a reverse proxy to deliver its own `client.js`. Most of this file is about
 * the two things that make static serving dangerous or wrong: path traversal,
 * and cache validators.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createServer, serveStatic, ServerHttpError } from '../src/server/index';
import {
  cacheControlFor,
  contentTypeFor,
  fileEtag,
  isNotModified,
  parseRange,
  resolveAssetPath,
  stripPrefix,
} from '../src/server/static';

let root: string;
let outside: string;

const BODY = 'hello static world';

beforeAll(async () => {
  const base = await mkdtemp(join(tmpdir(), 'bq-static-'));
  root = join(base, 'public');
  outside = base;
  await mkdir(join(root, 'nested'), { recursive: true });
  await writeFile(join(root, 'app.js'), BODY);
  await writeFile(join(root, 'index.html'), '<h1>root index</h1>');
  await writeFile(join(root, 'styles.css'), 'body{color:red}');
  await writeFile(join(root, 'noext'), 'raw bytes');
  await writeFile(join(root, '.env'), 'SECRET=1');
  await writeFile(join(root, 'empty.txt'), '');
  await writeFile(join(root, 'nested', 'index.html'), '<h1>nested index</h1>');
  await writeFile(join(root, 'compressed.js'), 'identity body');
  await writeFile(join(root, 'compressed.js.br'), 'brotli body');
  await writeFile(join(root, 'compressed.js.gz'), 'gzip body');
  await writeFile(join(outside, 'secret.txt'), 'do not serve me');
  // A symlink *inside* the root pointing outside it: the lexical containment
  // check passes, so only a realpath check keeps it from being served.
  await symlink(join(outside, 'secret.txt'), join(root, 'link.txt'));
});

afterAll(async () => {
  if (outside) await rm(outside, { recursive: true, force: true });
});

/** An app serving `root`, with a route after it to prove `next()` is called. */
const appFor = (options: Partial<Parameters<typeof serveStatic>[0]> = {}) => {
  const app = createServer();
  app.use(serveStatic({ root, ...options }));
  app.get('/fell-through', (ctx) => ctx.text('fell through'));
  return app;
};

describe('server/serveStatic', () => {
  it('serves a file with the right type, length and validators', async () => {
    const response = await appFor().handle('/app.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(response.headers.get('content-length')).toBe(String(BODY.length));
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('etag')).toMatch(/^W\/"/);
    expect(response.headers.get('last-modified')).toBeTruthy();
    expect(await response.text()).toBe(BODY);
  });

  it('serves css with its own content type', async () => {
    const response = await appFor().handle('/styles.css');
    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8');
  });

  it('falls back to octet-stream for an unknown extension', async () => {
    const response = await appFor().handle('/noext');
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
  });

  it('serves an empty file as a zero-length 200', async () => {
    const response = await appFor().handle('/empty.txt');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('0');
    expect(await response.text()).toBe('');
  });

  it('calls next() for a missing file', async () => {
    const response = await appFor().handle('/fell-through');
    expect(await response.text()).toBe('fell through');
  });

  it('calls next() for a non-GET method', async () => {
    const app = createServer();
    app.use(serveStatic({ root }));
    app.post('/app.js', (ctx) => ctx.text('posted'));

    const response = await app.handle({ method: 'POST', url: '/app.js' });
    expect(await response.text()).toBe('posted');
  });

  it('answers HEAD with the headers of the GET but no body', async () => {
    const response = await appFor().handle({ method: 'HEAD', url: '/app.js' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe(String(BODY.length));
    expect(await response.text()).toBe('');
  });

  it('serves the directory index', async () => {
    const response = await appFor().handle('/nested/');
    expect(await response.text()).toBe('<h1>nested index</h1>');
  });

  it('redirects a directory without a trailing slash', async () => {
    const response = await appFor().handle('/nested');
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/nested/');
  });

  it('calls next() for a directory when index is disabled', async () => {
    const app = createServer();
    app.use(serveStatic({ root, index: false }));
    app.get('/nested/', (ctx) => ctx.text('no index'));

    expect(await (await app.handle('/nested/')).text()).toBe('no index');
  });

  it('honours the mount prefix and ignores paths outside it', async () => {
    const app = createServer();
    app.use(serveStatic({ root, prefix: '/assets' }));
    app.get('/app.js', (ctx) => ctx.text('not static'));

    expect(await (await app.handle('/assets/app.js')).text()).toBe(BODY);
    expect(await (await app.handle('/app.js')).text()).toBe('not static');
  });

  it('applies maxAge and immutable to Cache-Control', async () => {
    const response = await appFor({ maxAge: 3600, immutable: true }).handle('/app.js');
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600, immutable');
  });

  it('honours a contentTypes override', async () => {
    const response = await appFor({ contentTypes: { '.js': 'application/javascript' } }).handle(
      '/app.js'
    );
    expect(response.headers.get('content-type')).toBe('application/javascript');
  });

  it('rejects a root option that is not a path', () => {
    expect(() => serveStatic({ root: '' })).toThrow(TypeError);
  });
});

describe('server/serveStatic path traversal', () => {
  const traversals = [
    '/../secret.txt',
    '/nested/../../secret.txt',
    '/%2e%2e/secret.txt',
    '/%2e%2e%2fsecret.txt',
    '/..%2fsecret.txt',
    '/....//secret.txt',
    '/nested/%2e%2e/%2e%2e/secret.txt',
  ];

  // Two layers stop these. The WHATWG URL parser resolves `..` and `%2e%2e`
  // away before the middleware runs, so those arrive as an ordinary miss;
  // the forms that survive parsing (`..%2f`) are rejected by the middleware
  // itself. What matters either way is that the file outside the root is
  // never in the response.
  it.each(traversals)('never serves a file outside the root for %s', async (path) => {
    const response = await appFor().handle(path);
    expect([403, 404]).toContain(response.status);
    expect(await response.text()).not.toContain('do not serve me');
  });

  it('rejects a traversal that survives URL normalization with 403', async () => {
    const response = await appFor().handle('/..%2fsecret.txt');
    expect(response.status).toBe(403);
  });

  it('does not serve a dotfile by default, and lets routes have it', async () => {
    // Not 403: a dotted path is not an attack, and vetoing it app-wide broke
    // `/.well-known/acme-challenge/<token>` for a root-mounted serveStatic.
    const response = await appFor().handle('/.env');
    expect(response.status).toBe(404);
  });

  it('lets a route answer a dotted path the middleware skipped', async () => {
    const app = appFor();
    app.get('/.well-known/acme-challenge/tok', (ctx) => ctx.text('challenge'));

    const response = await app.handle('/.well-known/acme-challenge/tok');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('challenge');
  });

  it('lets a route answer a path with malformed percent-encoding', async () => {
    const app = appFor();
    app.get('/*', (ctx) => ctx.text('catchall'));

    const response = await app.handle('/%ZZ');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('catchall');
  });

  it('serves a dotfile when explicitly allowed', async () => {
    const response = await appFor({ dotfiles: true }).handle('/.env');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('SECRET=1');
  });

  it('refuses a path with a NUL byte', async () => {
    const response = await appFor().handle('/app.js%00.png');
    expect(response.status).toBe(403);
  });
});

describe('server/serveStatic conditional requests', () => {
  it('answers 304 for a matching If-None-Match', async () => {
    const app = appFor();
    const first = await app.handle('/app.js');
    const etag = first.headers.get('etag') as string;

    const second = await app.handle({ url: '/app.js', headers: { 'if-none-match': etag } });

    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
    expect(second.headers.get('etag')).toBe(etag);
  });

  it('answers 200 for a stale If-None-Match', async () => {
    const response = await appFor().handle({
      url: '/app.js',
      headers: { 'if-none-match': 'W/"stale"' },
    });
    expect(response.status).toBe(200);
  });

  it('answers 304 for an If-Modified-Since at or after the mtime', async () => {
    const app = appFor();
    const first = await app.handle('/app.js');
    const lastModified = first.headers.get('last-modified') as string;

    const second = await app.handle({
      url: '/app.js',
      headers: { 'if-modified-since': lastModified },
    });
    expect(second.status).toBe(304);
  });
});

describe('server/serveStatic range requests', () => {
  it('answers 206 with the requested slice', async () => {
    const response = await appFor().handle({ url: '/app.js', headers: { range: 'bytes=0-4' } });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe(`bytes 0-4/${BODY.length}`);
    expect(response.headers.get('content-length')).toBe('5');
    expect(await response.text()).toBe(BODY.slice(0, 5));
  });

  it('answers an open-ended range', async () => {
    const response = await appFor().handle({ url: '/app.js', headers: { range: 'bytes=6-' } });
    expect(response.status).toBe(206);
    expect(await response.text()).toBe(BODY.slice(6));
  });

  it('answers a suffix range', async () => {
    const response = await appFor().handle({ url: '/app.js', headers: { range: 'bytes=-5' } });
    expect(response.status).toBe(206);
    expect(await response.text()).toBe(BODY.slice(-5));
  });

  it('answers 416 for a range past the end of the file', async () => {
    const response = await appFor().handle({ url: '/app.js', headers: { range: 'bytes=9999-' } });
    expect(response.status).toBe(416);
  });

  it('ignores a multi-range request and serves the whole body', async () => {
    const response = await appFor().handle({ url: '/app.js', headers: { range: 'bytes=0-2,5-7' } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BODY);
  });
});

describe('server/serveStatic precompressed sidecars', () => {
  it('serves the brotli sidecar when accepted', async () => {
    const response = await appFor({ precompressed: true }).handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'br, gzip' },
    });

    expect(response.headers.get('content-encoding')).toBe('br');
    expect(response.headers.get('vary')).toBe('Accept-Encoding');
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await response.text()).toBe('brotli body');
  });

  it('falls back to gzip when brotli is not accepted', async () => {
    const response = await appFor({ precompressed: true }).handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(await response.text()).toBe('gzip body');
  });

  it('serves the identity body when nothing is accepted', async () => {
    const response = await appFor({ precompressed: true }).handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'identity' },
    });
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(await response.text()).toBe('identity body');
  });

  it('does not offer ranges over a compressed body', async () => {
    const response = await appFor({ precompressed: true }).handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'br', range: 'bytes=0-2' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('accept-ranges')).toBeNull();
    expect(await response.text()).toBe('brotli body');
  });

  it('serves the identity body when precompressed is off', async () => {
    const response = await appFor().handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'br' },
    });
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(await response.text()).toBe('identity body');
  });
});

describe('serveStatic helpers', () => {
  const path = { join, extname, sep, resolve, normalize };

  describe('parseRange', () => {
    it('returns null with no header', () => {
      expect(parseRange(null, 100)).toBeNull();
    });

    it('parses a closed range', () => {
      expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    });

    it('clamps an end past the file size', () => {
      expect(parseRange('bytes=90-200', 100)).toEqual({ start: 90, end: 99 });
    });

    it('parses an open-ended range', () => {
      expect(parseRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
    });

    it('parses a suffix range', () => {
      expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    });

    it('clamps a suffix longer than the file', () => {
      expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
    });

    it('reports a start past the end as unsatisfiable', () => {
      expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
      expect(parseRange('bytes=50-10', 100)).toBe('unsatisfiable');
      expect(parseRange('bytes=-0', 100)).toBe('unsatisfiable');
    });

    it('ignores units it does not handle', () => {
      expect(parseRange('items=0-9', 100)).toBeNull();
      expect(parseRange('bytes=0-9,20-29', 100)).toBeNull();
      expect(parseRange('bytes=-', 100)).toBeNull();
    });
  });

  describe('resolveAssetPath', () => {
    it('resolves a path inside the root', () => {
      expect(resolveAssetPath('/srv/pub', '/a/b.js', path, false)).toBe(
        join('/srv/pub', 'a', 'b.js')
      );
    });

    it('reports traversal as an escape, encoded or not', () => {
      for (const attempt of ['/../x', '/a/../../x', '/%2e%2e/x', '/..%2fx']) {
        expect(resolveAssetPath('/srv/pub', attempt, path, false), attempt).toBe('escape');
      }
    });

    it('treats malformed percent-encoding as not ours, not as an attack', () => {
      expect(resolveAssetPath('/srv/pub', '/%ZZ', path, false)).toBe('not-ours');
    });

    it('reports a NUL byte as an escape', () => {
      expect(resolveAssetPath('/srv/pub', '/a%00.js', path, false)).toBe('escape');
    });

    it('treats a dotfile as not ours unless allowed', () => {
      expect(resolveAssetPath('/srv/pub', '/.env', path, false)).toBe('not-ours');
      expect(resolveAssetPath('/srv/pub', '/.env', path, true)).toBe(join('/srv/pub', '.env'));
    });

    it('treats a backslash as a separator', () => {
      expect(resolveAssetPath('/srv/pub', '/a\\..\\..\\x', path, false)).toBe('escape');
    });
  });

  describe('stripPrefix', () => {
    it('passes everything through for the root prefix', () => {
      expect(stripPrefix('/a/b', '/')).toBe('/a/b');
      expect(stripPrefix('/a/b', '')).toBe('/a/b');
    });

    it('strips a mount prefix', () => {
      expect(stripPrefix('/assets/a.js', '/assets')).toBe('/a.js');
      expect(stripPrefix('/assets/a.js', '/assets/')).toBe('/a.js');
      expect(stripPrefix('/assets', '/assets')).toBe('/');
    });

    it('returns null outside the prefix', () => {
      expect(stripPrefix('/other/a.js', '/assets')).toBeNull();
      expect(stripPrefix('/assetsx/a.js', '/assets')).toBeNull();
    });
  });

  describe('isNotModified', () => {
    const etag = 'W/"a-b"';

    it('matches a wildcard and an exact etag', () => {
      expect(isNotModified('*', null, etag, 0)).toBe(true);
      expect(isNotModified(etag, null, etag, 0)).toBe(true);
    });

    it('matches the strong form of a weak etag', () => {
      expect(isNotModified('"a-b"', null, etag, 0)).toBe(true);
    });

    it('matches one entry in a list', () => {
      expect(isNotModified('W/"x", W/"a-b"', null, etag, 0)).toBe(true);
    });

    it('does not match a different etag', () => {
      expect(isNotModified('W/"other"', null, etag, 0)).toBe(false);
    });

    it('prefers If-None-Match over If-Modified-Since', () => {
      const future = new Date(Date.now() + 60_000).toUTCString();
      expect(isNotModified('W/"other"', future, etag, Date.now())).toBe(false);
    });

    it('compares If-Modified-Since at second precision', () => {
      const mtime = Date.parse('2026-01-01T00:00:00Z');
      expect(isNotModified(null, 'Thu, 01 Jan 2026 00:00:00 GMT', etag, mtime + 400)).toBe(true);
      expect(isNotModified(null, 'Wed, 31 Dec 2025 23:59:59 GMT', etag, mtime)).toBe(false);
    });

    it('ignores an unparseable date', () => {
      expect(isNotModified(null, 'not a date', etag, 0)).toBe(false);
    });
  });

  describe('fileEtag and cacheControlFor', () => {
    it('changes the etag when size or mtime change', () => {
      expect(fileEtag(10, 1000)).toBe(fileEtag(10, 1000));
      expect(fileEtag(10, 1000)).not.toBe(fileEtag(11, 1000));
      expect(fileEtag(10, 1000)).not.toBe(fileEtag(10, 2000));
    });

    it('emits no-cache for a zero maxAge', () => {
      expect(cacheControlFor(0, false)).toBe('no-cache');
      expect(cacheControlFor(60, false)).toBe('public, max-age=60');
      expect(cacheControlFor(60, true)).toBe('public, max-age=60, immutable');
    });
  });

  describe('contentTypeFor', () => {
    it('maps by extension, case-insensitively', () => {
      expect(contentTypeFor('/a/b.PNG', extname, undefined, 'x')).toBe('image/png');
    });

    it('prefers an override', () => {
      expect(contentTypeFor('/a/b.png', extname, { '.PNG': 'image/custom' }, 'x')).toBe(
        'image/custom'
      );
    });

    it('falls back for an unknown extension', () => {
      expect(contentTypeFor('/a/b.unknown', extname, undefined, 'application/octet-stream')).toBe(
        'application/octet-stream'
      );
    });
  });
});

describe('serveStatic error surface', () => {
  it('raises a ServerHttpError for traversal rather than falling through to a route', async () => {
    const app = createServer();
    app.use(serveStatic({ root }));
    app.get('/*', (ctx) => ctx.text('catch-all'));

    const response = await app.handle('/..%2fsecret.txt');
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('catch-all');
    expect(ServerHttpError).toBeDefined();
  });
});

describe('global middleware on unmatched routes', () => {
  // serveStatic can only work as `app.use()` middleware if the stack runs for
  // requests no route matches. It previously short-circuited to 404 first,
  // which also meant CORS, logging and security-header middleware silently
  // skipped every 404 (#222).
  it('runs global middleware when no route matches', async () => {
    const seen: string[] = [];
    const app = createServer();
    app.use(async (ctx, next) => {
      seen.push(ctx.path);
      return next();
    });

    const response = await app.handle('/nothing-here');

    expect(seen).toEqual(['/nothing-here']);
    expect(response.status).toBe(404);
  });

  it('lets global middleware answer a request no route matches', async () => {
    const app = createServer();
    app.use(async (ctx, next) => (ctx.path === '/handled' ? ctx.text('from middleware') : next()));

    expect(await (await app.handle('/handled')).text()).toBe('from middleware');
    expect((await app.handle('/other')).status).toBe(404);
  });

  it('still reaches the custom notFound handler', async () => {
    const app = createServer({ notFound: (ctx) => ctx.text('custom 404', { status: 404 }) });
    app.use(async (_ctx, next) => next());

    const response = await app.handle('/missing');
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('custom 404');
  });

  it('routes errors thrown by global middleware through onError', async () => {
    const app = createServer();
    app.use(() => {
      throw new ServerHttpError(418, "I'm a teapot");
    });

    expect((await app.handle('/missing')).status).toBe(418);
  });
});

describe('server/serveStatic containment and caching', () => {
  it('refuses a symlink that escapes the root', async () => {
    // `resolveAssetPath` is lexical and `stat()` follows links, so without a
    // realpath check the outside file was served with 200.
    const response = await appFor().handle('/link.txt');
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('do not serve me');
  });

  it('keeps Content-Range on a 416', async () => {
    // RFC 9110 §15.5.17: it is the only way a resuming client learns the
    // current length. Throwing a ServerHttpError discarded it.
    const response = await appFor().handle({
      url: '/app.js',
      headers: { range: 'bytes=9999-' },
    });

    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe(`bytes */${BODY.length}`);
  });

  it('honours q=0 in Accept-Encoding', async () => {
    const app = appFor({ precompressed: true });

    const response = await app.handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'gzip;q=1.0, br;q=0' },
    });

    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(await response.text()).toBe('gzip body');
  });

  it('does not let the * wildcard override an explicit q=0', async () => {
    const app = appFor({ precompressed: true });

    const response = await app.handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'br;q=0, *' },
    });

    expect(response.headers.get('content-encoding')).toBe('gzip');
  });

  it('gives each representation its own ETag and always varies', async () => {
    const app = appFor({ precompressed: true });

    const identity = await app.handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'identity' },
    });
    const brotli = await app.handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'br' },
    });

    expect(identity.headers.get('vary')).toBe('Accept-Encoding');
    expect(brotli.headers.get('vary')).toBe('Accept-Encoding');
    expect(brotli.headers.get('etag')).not.toBe(identity.headers.get('etag'));
  });

  it('does not answer 304 across representations', async () => {
    // A cache holding the brotli variant must not revalidate on behalf of a
    // client that cannot decode it and be handed a bare 304.
    const app = appFor({ precompressed: true });

    const brotli = await app.handle({
      url: '/compressed.js',
      headers: { 'accept-encoding': 'br' },
    });
    const revalidated = await app.handle({
      url: '/compressed.js',
      headers: {
        'accept-encoding': 'identity',
        'if-none-match': brotli.headers.get('etag') as string,
      },
    });

    expect(revalidated.status).toBe(200);
    expect(await revalidated.text()).toBe('identity body');
  });
});
