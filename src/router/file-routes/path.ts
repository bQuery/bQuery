/**
 * Pure helpers that translate a file-route source path into a router path
 * pattern. No filesystem access — input is a manifest key (a string), output is
 * a `/users/:id`-style pattern the existing matcher understands.
 *
 * Supported segment syntax (a deliberately small, convention-aligned subset):
 * - `[id]`       → `:id`            (dynamic param)
 * - `[...rest]`  → `*`              (catch-all; matches the remainder)
 * - `(group)`    → ‹dropped›        (pathless layout/organisational group)
 * - literal      → literal          (static segment)
 *
 * @module bquery/router
 */

import type { CreateFileRoutesOptions, FileRouteKind } from './types';

const DEFAULT_PAGE_FILES = ['+page', 'index'];
const DEFAULT_LAYOUT_FILES = ['+layout', '_layout'];
const ROUTE_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** Strip a single recognised extension (e.g. `.ts`) from a filename. */
const stripExtension = (filename: string): string => {
  for (const ext of ROUTE_FILE_EXTENSIONS) {
    if (filename.endsWith(ext)) return filename.slice(0, -ext.length);
  }
  return filename;
};

/**
 * Strip leading and trailing `/` with a single linear scan. A `\/+$` regex here
 * backtracks super-linearly on strings of repeated slashes (ReDoS), so we trim
 * by index instead.
 */
const trimSlashes = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === 47 /* '/' */) start += 1;
  while (end > start && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(start, end);
};

/** Normalise a manifest key into clean, slash-separated parts. */
const splitKey = (key: string, routesDir: string): string[] => {
  let normalized = key.replace(/\\/g, '/').replace(/^(?:\.\/|\.\.\/)+/, '');
  normalized = normalized.replace(/^\/+/, '');
  const dir = trimSlashes(routesDir);
  if (dir) {
    if (normalized === dir) {
      normalized = '';
    } else if (normalized.startsWith(`${dir}/`)) {
      normalized = normalized.slice(dir.length + 1);
    }
  }
  return normalized.split('/').filter(Boolean);
};

/** Whether `basename` is (or is a split-file variant of) one of `markers`. */
const matchesMarker = (basename: string, markers: string[]): boolean =>
  markers.some((marker) => basename === marker || basename.startsWith(`${marker}.`));

/** Describes the route file derived from a manifest key. */
export interface ParsedFilePath {
  /** Kind of file (`page` contributes a navigable route). */
  kind: FileRouteKind;
  /** Router path pattern (e.g. `/users/:id`). */
  pattern: string;
  /** Directory segments that own this file (for layout-chain computation). */
  dirSegments: string[];
  /** Whether the pattern ends in a catch-all wildcard. */
  catchAll: boolean;
  /** Names of the dynamic params, in order (catch-all name included). */
  paramNames: string[];
}

/** Convert one file/dir segment to a pattern piece, or `null` to drop it. */
const segmentToPattern = (
  segment: string,
  paramNames: string[]
): { piece: string | null; catchAll: boolean } => {
  // Pathless group: (marketing) — organisational only, no URL contribution.
  if (segment.startsWith('(') && segment.endsWith(')')) {
    return { piece: null, catchAll: false };
  }
  // Catch-all: [...rest]
  const catchAllMatch = /^\[\.\.\.(.+)\]$/.exec(segment);
  if (catchAllMatch) {
    paramNames.push(catchAllMatch[1]);
    return { piece: '*', catchAll: true };
  }
  // Optional param [[id]] is normalised to a required param (matcher has no
  // optional segment support); documented as a known limitation.
  const optionalMatch = /^\[\[(.+)\]\]$/.exec(segment);
  if (optionalMatch) {
    paramNames.push(optionalMatch[1]);
    return { piece: `:${optionalMatch[1]}`, catchAll: false };
  }
  // Dynamic param: [id]
  const dynamicMatch = /^\[(.+)\]$/.exec(segment);
  if (dynamicMatch) {
    paramNames.push(dynamicMatch[1]);
    return { piece: `:${dynamicMatch[1]}`, catchAll: false };
  }
  return { piece: segment, catchAll: false };
};

/**
 * Parse a manifest key into a {@link ParsedFilePath}, or `null` when the file is
 * not a recognised route file (reserved `+`/`_` files, partials, etc.).
 */
export const parseFilePath = (
  key: string,
  options: CreateFileRoutesOptions = {}
): ParsedFilePath | null => {
  const routesDir = options.routesDir ?? 'routes';
  const pageFiles = options.pageFiles ?? DEFAULT_PAGE_FILES;
  const layoutFiles = options.layoutFiles ?? DEFAULT_LAYOUT_FILES;

  const parts = splitKey(key, routesDir);
  if (parts.length === 0) return null;

  const filename = parts[parts.length - 1];
  const dirSegments = parts.slice(0, -1);
  const basename = stripExtension(filename);

  let kind: FileRouteKind;
  let pathSegments: string[];

  if (matchesMarker(basename, pageFiles)) {
    kind = 'page';
    pathSegments = dirSegments;
  } else if (matchesMarker(basename, layoutFiles)) {
    kind = 'layout';
    pathSegments = dirSegments;
  } else if (basename === '+server' || basename.startsWith('+server.')) {
    kind = 'server';
    pathSegments = dirSegments;
  } else if (basename.startsWith('+') || basename.startsWith('_') || basename.startsWith('.')) {
    // Reserved/partial file we do not recognise — skip it.
    return null;
  } else {
    // Flat, "named" page file (Next/Nuxt-style): the filename is the leaf.
    kind = 'page';
    pathSegments = [...dirSegments, basename];
  }

  const paramNames: string[] = [];
  let catchAll = false;
  const pieces: string[] = [];
  for (const segment of pathSegments) {
    const { piece, catchAll: isCatchAll } = segmentToPattern(segment, paramNames);
    if (isCatchAll) catchAll = true;
    if (piece !== null) pieces.push(piece);
  }

  const pattern = pieces.length === 0 ? '/' : `/${pieces.join('/')}`;
  return { kind, pattern, dirSegments, catchAll, paramNames };
};

/**
 * Convert a file-route source path directly to its router path pattern.
 * Returns `null` for non-route files.
 *
 * @example
 * ```ts
 * filePathToRoutePattern('routes/users/[id]/+page.ts'); // '/users/:id'
 * filePathToRoutePattern('routes/files/[...path]/+page.ts'); // '/files/*'
 * filePathToRoutePattern('routes/index.ts'); // '/'
 * ```
 */
export const filePathToRoutePattern = (
  key: string,
  options: CreateFileRoutesOptions = {}
): string | null => parseFilePath(key, options)?.pattern ?? null;
