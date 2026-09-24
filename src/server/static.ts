/**
 * Static asset serving for the server module.
 *
 * `src/server` had sessions, CSRF, guards, auth, cookies, errors, file routes
 * and WebSocket sessions — but no way to send a file from disk, so every app
 * needed a reverse proxy just to deliver its own `client.js` (#222).
 *
 * `serveStatic()` is middleware: it answers for paths it can resolve to a file
 * under `root` and calls `next()` for everything else, so it composes with the
 * rest of the pipeline rather than taking over the server.
 *
 * File access goes through `node:fs`, which Bun, Node and Deno all provide, so
 * this works on every runtime `listen()` supports.
 *
 * @module bquery/server
 */

import { ServerHttpError } from './errors';
import type { ServerMiddleware } from './types';

/** Extension → MIME type. Covers what a web app actually serves. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.gz': 'application/gzip',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.zip': 'application/zip',
};

/** Precompressed sidecars, in the order they are preferred. */
const ENCODINGS: ReadonlyArray<{ encoding: string; suffix: string }> = [
  { encoding: 'br', suffix: '.br' },
  { encoding: 'gzip', suffix: '.gz' },
];

/** Options for {@link serveStatic}. */
export interface ServeStaticOptions {
  /** Directory to serve from. Files outside it are never reachable. */
  root: string;

  /**
   * URL prefix the assets are mounted under, e.g. `'/assets'`. The prefix is
   * stripped before resolving against `root`. Default: `'/'`.
   */
  prefix?: string;

  /** `Cache-Control` max-age in seconds. Default: `0`. */
  maxAge?: number;

  /**
   * Add `immutable` to `Cache-Control`. Only correct for content-hashed
   * filenames, where the URL changes whenever the bytes do. Default: `false`.
   */
  immutable?: boolean;

  /**
   * File served for a directory request. `false` disables directory indexes.
   * Default: `'index.html'`.
   */
  index?: string | false;

  /**
   * Serve a `.br`/`.gz` sidecar when the client accepts that encoding and the
   * file exists. Default: `false`.
   */
  precompressed?: boolean;

  /**
   * Serve dotfiles. Off by default, so `.env` and `.git` are not exposed by
   * pointing `root` at a project directory.
   * Default: `false`.
   */
  dotfiles?: boolean;

  /**
   * Extra or overriding extension → MIME mappings. Keys include the leading
   * dot and are matched case-insensitively.
   */
  contentTypes?: Readonly<Record<string, string>>;

  /** Fallback MIME type. Default: `'application/octet-stream'`. */
  defaultContentType?: string;
}

interface FsModule {
  createReadStream: typeof import('node:fs').createReadStream;
}

interface FsPromisesModule {
  stat: typeof import('node:fs/promises').stat;
  realpath: typeof import('node:fs/promises').realpath;
}

interface StreamModule {
  Readable: typeof import('node:stream').Readable;
}

interface PathModule {
  join: typeof import('node:path').join;
  normalize: typeof import('node:path').normalize;
  resolve: typeof import('node:path').resolve;
  sep: string;
  extname: typeof import('node:path').extname;
}

let modules: Promise<{
  fs: FsModule;
  fsp: FsPromisesModule;
  stream: StreamModule;
  path: PathModule;
}> | null = null;

/**
 * Load the Node built-ins lazily, so importing `@bquery/bquery/server` in a
 * browser bundle does not pull them in.
 */
const loadModules = async (): Promise<{
  fs: FsModule;
  fsp: FsPromisesModule;
  stream: StreamModule;
  path: PathModule;
}> => {
  modules ??= (async () => {
    const [fs, fsp, stream, path] = await Promise.all([
      import('node:fs') as Promise<FsModule>,
      import('node:fs/promises') as Promise<FsPromisesModule>,
      import('node:stream') as Promise<StreamModule>,
      import('node:path') as Promise<PathModule>,
    ]);
    return { fs, fsp, stream, path };
  })();
  return modules;
};

/**
 * A weak ETag from size and mtime. Cheap, and it changes whenever the file
 * does, which is what a validator needs — hashing every response body would
 * cost more than the request it saves.
 * @internal
 */
export const fileEtag = (size: number, mtimeMs: number): string =>
  `W/"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;

/**
 * Distinguish a precompressed representation's validator from the identity
 * one. Two representations of a URL that share an ETag are indistinguishable
 * to a cache, which is how compressed bytes end up served as identity.
 * @internal
 */
export const encodedEtag = (etag: string, encoding: string): string =>
  etag.endsWith('"') ? `${etag.slice(0, -1)}-${encoding}"` : `${etag}-${encoding}`;

/**
 * Parse `Accept-Encoding` into the set of encodings the client will take.
 *
 * A substring test cannot see quality values, and `q=0` means "not
 * acceptable" (RFC 9110 §12.5.3) — it is exactly how a client says *do not
 * send me brotli*. Matching on the token alone answered `gzip;q=1.0, br;q=0`
 * with brotli, an encoding the client had just refused.
 * @internal
 */
export const parseAcceptEncoding = (header: string | null): Map<string, number> => {
  const qualities = new Map<string, number>();
  if (!header) return qualities;

  for (const part of header.split(',')) {
    const [rawToken, ...parameters] = part.split(';');
    const token = rawToken?.trim().toLowerCase();
    if (!token) continue;

    const match = parameters
      .map((parameter) => /^\s*q=([\d.]+)\s*$/i.exec(parameter))
      .find((found) => found !== null);
    const quality = match ? Number.parseFloat(match[1] as string) : 1;

    qualities.set(token, Number.isNaN(quality) ? 0 : quality);
  }

  return qualities;
};

/**
 * Whether the client will accept an encoding, honouring `q=0` and `*`.
 *
 * An explicit entry always beats the `*` wildcard, so `br;q=0, *` refuses
 * brotli while still accepting anything else.
 * @internal
 */
export const acceptsEncoding = (qualities: Map<string, number>, encoding: string): boolean =>
  (qualities.get(encoding) ?? qualities.get('*') ?? 0) > 0;

/**
 * Why {@link resolveAssetPath} declined to serve a path.
 *
 * The distinction matters to the caller: an escape attempt is answered `403`,
 * but a dotfile or an undecodable path is simply not ours to serve, so the
 * request falls through to the routes. Collapsing them made global
 * `serveStatic()` veto `/.well-known/acme-challenge/<token>` and any URL with
 * a stray `%`, neither of which is an attack.
 */
export type AssetPathRejection = 'escape' | 'not-ours';

/**
 * Decode a URL path segment-wise and reject anything that escapes the root.
 *
 * Returns a rejection reason instead of a path when the path cannot be
 * served. Traversal is checked on the decoded form, so `%2e%2e%2f` is caught
 * along with a literal `../`, and the resolved path is re-checked against the
 * root afterwards as a second line of defence.
 * @internal
 */
export const resolveAssetPath = (
  root: string,
  relativePath: string,
  path: PathModule,
  allowDotfiles: boolean
): string | AssetPathRejection => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    return 'not-ours'; // malformed percent-encoding — let the routes try
  }

  // A NUL byte can truncate a path in some syscalls.
  if (decoded.includes('\0')) return 'escape';

  const segments = decoded.split(/[/\\]+/).filter((segment) => segment.length > 0);
  for (const segment of segments) {
    if (segment === '..') return 'escape';
    if (segment === '.') continue;
    if (!allowDotfiles && segment.startsWith('.')) return 'not-ours';
  }

  const rootAbsolute = path.resolve(root);
  const candidate = path.resolve(path.join(rootAbsolute, ...segments));

  // Belt and braces: even with the segment check above, confirm the resolved
  // path is inside the root — symlinked or oddly-normalized roots included.
  const rootWithSep = rootAbsolute.endsWith(path.sep) ? rootAbsolute : rootAbsolute + path.sep;
  if (candidate !== rootAbsolute && !candidate.startsWith(rootWithSep)) return 'escape';

  return candidate;
};

/**
 * Whether a path, with symlinks resolved, is still inside the root.
 *
 * {@link resolveAssetPath}'s containment check is lexical, but `stat()`
 * follows symlinks — so a link *inside* the root pointing outside it passed
 * both layers and served the outside file, contradicting the documented
 * guarantee. Build outputs are a realistic place for such links to appear.
 * @internal
 */
export const isInsideRoot = async (
  root: string,
  candidate: string,
  fsp: FsPromisesModule,
  path: PathModule
): Promise<boolean> => {
  try {
    const realRoot = await fsp.realpath(path.resolve(root));
    const realCandidate = await fsp.realpath(candidate);
    const withSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
    return realCandidate === realRoot || realCandidate.startsWith(withSep);
  } catch {
    // A path we cannot resolve is not one we will serve.
    return false;
  }
};

/**
 * Parse a single-range `Range` header against a known size.
 *
 * Returns `null` when the header is absent or not a byte range this
 * implementation handles (multi-range requests included — serving the whole
 * body is a valid response to those). Returns `'unsatisfiable'` when the range
 * is syntactically fine but outside the file.
 * @internal
 */
export const parseRange = (
  header: string | null,
  size: number
): { start: number; end: number } | 'unsatisfiable' | null => {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start: number;
  let end: number;

  if (rawStart === '') {
    // Suffix range: the last N bytes.
    const suffix = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number.parseInt(rawStart, 10);
    end = rawEnd === '' ? size - 1 : Number.parseInt(rawEnd, 10);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= size) return 'unsatisfiable';

  return { start, end: Math.min(end, size - 1) };
};

/** Pick the MIME type for a path. @internal */
export const contentTypeFor = (
  filePath: string,
  extname: PathModule['extname'],
  overrides: Readonly<Record<string, string>> | undefined,
  fallback: string
): string => {
  const ext = extname(filePath).toLowerCase();
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (key.toLowerCase() === ext) return value;
    }
  }
  return CONTENT_TYPES[ext] ?? fallback;
};

/** Build the `Cache-Control` value. @internal */
export const cacheControlFor = (maxAge: number, immutable: boolean): string => {
  if (maxAge <= 0) return 'no-cache';
  return `public, max-age=${Math.floor(maxAge)}${immutable ? ', immutable' : ''}`;
};

/**
 * Whether the request's validators say the client's copy is still good.
 * `If-None-Match` wins over `If-Modified-Since` when both are present.
 * @internal
 */
export const isNotModified = (
  ifNoneMatch: string | null,
  ifModifiedSince: string | null,
  etag: string,
  mtimeMs: number
): boolean => {
  if (ifNoneMatch) {
    if (ifNoneMatch.trim() === '*') return true;
    const candidates = ifNoneMatch.split(',').map((value) => value.trim());
    // A strong validator matches its weak form: W/"x" and "x" are the same entity.
    const bare = etag.replace(/^W\//, '');
    return candidates.some(
      (candidate) => candidate === etag || candidate.replace(/^W\//, '') === bare
    );
  }

  if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    if (Number.isFinite(since)) {
      // HTTP dates have second precision; compare at that resolution.
      return Math.floor(mtimeMs / 1000) * 1000 <= since;
    }
  }

  return false;
};

/** Strip the mount prefix, or null when the path is outside it. @internal */
export const stripPrefix = (pathname: string, prefix: string): string | null => {
  const normalized = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  if (normalized === '' || normalized === '/') return pathname;
  if (pathname === normalized) return '/';
  if (pathname.startsWith(`${normalized}/`)) return pathname.slice(normalized.length);
  return null;
};

/**
 * Serve files from disk.
 *
 * Answers `GET` and `HEAD` for paths that resolve to a file under `root`, and
 * calls `next()` for anything else — a missing file, another method, a path
 * outside the mount prefix — so routes can still handle those.
 *
 * @example Serve a build directory under `/assets`
 * ```ts
 * import { createServer, serveStatic } from '@bquery/bquery/server';
 *
 * const app = createServer();
 * app.use(
 *   serveStatic({
 *     root: './dist/client',
 *     prefix: '/assets',
 *     maxAge: 31_536_000,
 *     immutable: true, // content-hashed filenames only
 *     precompressed: true,
 *   })
 * );
 * ```
 */
export const serveStatic = (options: ServeStaticOptions): ServerMiddleware => {
  const {
    root,
    prefix = '/',
    maxAge = 0,
    immutable = false,
    index = 'index.html',
    precompressed = false,
    dotfiles = false,
    contentTypes,
    defaultContentType = 'application/octet-stream',
  } = options;

  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('serveStatic: `root` must be a non-empty path.');
  }

  return async (ctx, next) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next();

    const relative = stripPrefix(ctx.url.pathname, prefix);
    if (relative === null) return next();

    const { fs, fsp, stream, path } = await loadModules();

    const resolved = resolveAssetPath(root, relative, path, dotfiles);
    // A traversal attempt is not a routing miss — say so rather than falling
    // through to a route that might serve something. A dotfile or an
    // undecodable path is a different matter: this middleware simply does not
    // own it, so the routes still get their turn. Answering 403 there made a
    // root-mounted `serveStatic()` veto `/.well-known/...` app-wide.
    if (resolved === 'escape') throw new ServerHttpError(403, 'Forbidden');
    if (resolved === 'not-ours') return next();

    let filePath = resolved;
    let stats: Awaited<ReturnType<FsPromisesModule['stat']>>;

    try {
      stats = await fsp.stat(filePath);
    } catch {
      return next();
    }

    if (stats.isDirectory()) {
      if (index === false) return next();
      // `ctx.path` has its trailing slash stripped, so ask the URL — the
      // difference between `/dir` and `/dir/` is exactly what decides whether
      // relative links inside the index resolve.
      if (!ctx.url.pathname.endsWith('/')) {
        const location = `${ctx.url.pathname}/${ctx.url.search}`;
        return new Response(null, { status: 308, headers: { location } });
      }
      filePath = path.join(filePath, index);
      try {
        stats = await fsp.stat(filePath);
      } catch {
        return next();
      }
    }

    if (!stats.isFile()) return next();

    // `resolveAssetPath`'s containment check is lexical and `stat()` follows
    // symlinks, so a link inside the root pointing outside it would otherwise
    // be served — which the `root` option promises never happens.
    if (!(await isInsideRoot(root, filePath, fsp, path))) {
      throw new ServerHttpError(403, 'Forbidden');
    }

    const contentType = contentTypeFor(filePath, path.extname, contentTypes, defaultContentType);
    const etag = fileEtag(stats.size, stats.mtimeMs);

    const headers = new Headers({
      'content-type': contentType,
      'cache-control': cacheControlFor(maxAge, immutable),
      etag,
      'last-modified': new Date(stats.mtimeMs).toUTCString(),
      'accept-ranges': 'bytes',
    });

    // Set before the conditional check, not after: `Vary` describes the URL,
    // not the body, so a 304 has to carry the same one as the 200 it
    // revalidates. A shared cache that saw only the 304 would otherwise store
    // the entry without an encoding in its key and serve one client's
    // representation to another.
    if (precompressed) {
      headers.set('vary', 'Accept-Encoding');
    }

    // A precompressed sidecar replaces the body but keeps the original's
    // content type, and varies on Accept-Encoding so caches stay correct.
    let bodyPath = filePath;
    let bodySize = stats.size;
    // The validators describe the bytes sent, so a sidecar brings its own.
    let bodyMtimeMs = stats.mtimeMs;

    // Resolved *before* the conditional check, because picking a sidecar
    // rewrites the ETag. Checking first compared the client's validator
    // against the identity ETag while the response would ship the encoded
    // one, so a precompressed asset could never revalidate: every conditional
    // request re-sent the whole compressed body.
    if (precompressed) {
      const accepted = parseAcceptEncoding(ctx.request.headers.get('accept-encoding'));
      // Ordered by the client's stated preference, not by our own list. The
      // qualities are already parsed, and `gzip;q=1.0, br;q=0.1` is a client
      // asking for gzip for a reason — decode cost on a constrained device, a
      // proxy tuned for CPU. Ties keep `ENCODINGS` order, so the common
      // `gzip, br` (no q-values) still prefers brotli.
      const qualityOf = (encoding: string): number =>
        accepted.get(encoding) ?? accepted.get('*') ?? 0;
      const candidates = ENCODINGS.filter(({ encoding }) =>
        acceptsEncoding(accepted, encoding)
      ).sort((a, b) => qualityOf(b.encoding) - qualityOf(a.encoding));

      for (const { encoding, suffix } of candidates) {
        try {
          const sidecar = await fsp.stat(`${filePath}${suffix}`);
          if (!sidecar.isFile()) continue;
          bodyPath = `${filePath}${suffix}`;
          bodySize = sidecar.size;
          bodyMtimeMs = sidecar.mtimeMs;
          headers.set('content-encoding', encoding);
          // Distinguish the representations. Sharing the identity file's
          // validator let a cache revalidate the brotli variant on behalf of
          // a client that does not accept `br`, get a bare 304, and hand back
          // compressed bytes with no `Content-Encoding` — a corrupt body.
          //
          // Built from the sidecar's own size and mtime, not the identity
          // file's: a sidecar rebuilt on its own — a stale one replaced after
          // a bad deploy — would otherwise keep the old validator, and every
          // cache holding the old bytes would keep revalidating them as fresh.
          headers.set('etag', encodedEtag(fileEtag(sidecar.size, sidecar.mtimeMs), encoding));
          headers.set('last-modified', new Date(sidecar.mtimeMs).toUTCString());
          break;
        } catch {
          // No sidecar for this encoding; try the next one.
        }
      }
    }

    // Range requests address the bytes actually sent. With a precompressed
    // sidecar those are the compressed bytes, which a client asking for a
    // range of the identity representation would not expect — so ranges are
    // only offered when the body is the file itself.
    //
    // Decided before the conditional check, because a 304's headers are
    // merged into the cached entry (RFC 9111 §4.3.4): a 304 still carrying
    // `Accept-Ranges: bytes` would advertise ranges on a stored compressed
    // body that its own 200 had declined to offer them on.
    const rangeable = bodyPath === filePath;
    if (!rangeable) headers.delete('accept-ranges');

    // Against the validators actually being sent, which the sidecar block
    // above may have replaced.
    if (
      isNotModified(
        ctx.request.headers.get('if-none-match'),
        ctx.request.headers.get('if-modified-since'),
        headers.get('etag') ?? etag,
        bodyMtimeMs
      )
    ) {
      // The encoded ETag and `Vary` stay — they are what a cache updates its
      // entry from. `Content-Encoding` does not: RFC 9110 §15.4.5 lists the
      // representation metadata a 304 may carry, and it is not among them.
      // Resolving the sidecar before this check is what put it here.
      headers.delete('content-encoding');
      return new Response(null, { status: 304, headers });
    }

    const range = rangeable ? parseRange(ctx.request.headers.get('range'), bodySize) : null;

    if (range === 'unsatisfiable') {
      // Returned, not thrown: `ServerHttpError` carries no headers and the
      // default `onError` builds a fresh response, so throwing dropped the
      // `Content-Range` that RFC 9110 requires on a 416 — the only way a
      // resuming client learns the current length.
      headers.set('content-range', `bytes */${bodySize}`);
      headers.delete('content-length');
      return new Response(null, { status: 416, headers });
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : bodySize - 1;
    const length = bodySize === 0 ? 0 : end - start + 1;

    headers.set('content-length', String(length));
    if (range) {
      headers.set('content-range', `bytes ${start}-${end}/${bodySize}`);
    }

    // HEAD carries the headers of the GET it stands in for, but no body.
    if (ctx.method === 'HEAD') {
      return new Response(null, { status: range ? 206 : 200, headers });
    }

    if (length === 0) {
      return new Response(null, { status: range ? 206 : 200, headers });
    }

    const nodeStream = fs.createReadStream(bodyPath, { start, end });
    const body = stream.Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

    return new Response(body, { status: range ? 206 : 200, headers });
  };
};
