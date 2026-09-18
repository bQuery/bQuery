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
 * Decode a URL path segment-wise and reject anything that escapes the root.
 *
 * Returns null when the path is unsafe. Traversal is checked on the decoded
 * form, so `%2e%2e%2f` is caught along with a literal `../`, and the resolved
 * path is re-checked against the root afterwards as a second line of defence.
 * @internal
 */
export const resolveAssetPath = (
  root: string,
  relativePath: string,
  path: PathModule,
  allowDotfiles: boolean
): string | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    return null; // malformed percent-encoding
  }

  // A NUL byte can truncate a path in some syscalls.
  if (decoded.includes('\0')) return null;

  const segments = decoded.split(/[/\\]+/).filter((segment) => segment.length > 0);
  for (const segment of segments) {
    if (segment === '..') return null;
    if (segment === '.') continue;
    if (!allowDotfiles && segment.startsWith('.')) return null;
  }

  const rootAbsolute = path.resolve(root);
  const candidate = path.resolve(path.join(rootAbsolute, ...segments));

  // Belt and braces: even with the segment check above, confirm the resolved
  // path is inside the root — symlinked or oddly-normalized roots included.
  const rootWithSep = rootAbsolute.endsWith(path.sep) ? rootAbsolute : rootAbsolute + path.sep;
  if (candidate !== rootAbsolute && !candidate.startsWith(rootWithSep)) return null;

  return candidate;
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
    // through to a route that might serve something.
    if (resolved === null) throw new ServerHttpError(403, 'Forbidden');

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

    const contentType = contentTypeFor(filePath, path.extname, contentTypes, defaultContentType);
    const etag = fileEtag(stats.size, stats.mtimeMs);

    const headers = new Headers({
      'content-type': contentType,
      'cache-control': cacheControlFor(maxAge, immutable),
      etag,
      'last-modified': new Date(stats.mtimeMs).toUTCString(),
      'accept-ranges': 'bytes',
    });

    if (
      isNotModified(
        ctx.request.headers.get('if-none-match'),
        ctx.request.headers.get('if-modified-since'),
        etag,
        stats.mtimeMs
      )
    ) {
      return new Response(null, { status: 304, headers });
    }

    // A precompressed sidecar replaces the body but keeps the original's
    // content type, and varies on Accept-Encoding so caches stay correct.
    let bodyPath = filePath;
    let bodySize = stats.size;

    if (precompressed) {
      const accepted = ctx.request.headers.get('accept-encoding') ?? '';
      for (const { encoding, suffix } of ENCODINGS) {
        if (!accepted.toLowerCase().includes(encoding)) continue;
        try {
          const sidecar = await fsp.stat(`${filePath}${suffix}`);
          if (!sidecar.isFile()) continue;
          bodyPath = `${filePath}${suffix}`;
          bodySize = sidecar.size;
          headers.set('content-encoding', encoding);
          headers.set('vary', 'Accept-Encoding');
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
    const rangeable = bodyPath === filePath;
    const range = rangeable ? parseRange(ctx.request.headers.get('range'), bodySize) : null;

    if (range === 'unsatisfiable') {
      headers.set('content-range', `bytes */${bodySize}`);
      throw new ServerHttpError(416, 'Range Not Satisfiable');
    }

    if (!rangeable) headers.delete('accept-ranges');

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
