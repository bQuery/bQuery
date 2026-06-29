/**
 * Build a router route table from a file-route manifest.
 *
 * The manifest is whatever a bundler glob (`import.meta.glob`) or a hand-written
 * map gives you: `{ './routes/users/[id]/+page.ts': () => import(...) }`. This
 * stays bundler-agnostic — no filesystem, no bundled build tool — and produces
 * plain {@link RouteDefinition}s consumable by `createRouter()` (client) and the
 * SSR router bridge (server).
 *
 * @module bquery/router
 */

import type { RouteDefinition } from '../types';
import { parseFilePath } from './path';
import type {
  Action,
  CreateFileRoutesOptions,
  CreateFileRoutesResult,
  FileRoute,
  Load,
  RouteManifest,
  RouteManifestEntry,
  RouteModule,
} from './types';

const isLazyEntry = (
  entry: RouteManifestEntry
): entry is () => Promise<RouteModule> | RouteModule => typeof entry === 'function';

/** Resolve a manifest entry to its module (awaiting a lazy importer). */
const resolveModule = async (entry: RouteManifestEntry): Promise<RouteModule> =>
  isLazyEntry(entry) ? await entry() : entry;

/** A layout file discovered in the manifest, keyed by its owning directory. */
interface LayoutEntry {
  dirSegments: string[];
  id: string;
}

const dirIsPrefix = (prefix: string[], dir: string[]): boolean => {
  if (prefix.length > dir.length) return false;
  return prefix.every((segment, index) => segment === dir[index]);
};

/**
 * Build navigable route definitions and normalised file-route entries from a
 * manifest.
 *
 * @example
 * ```ts
 * // Vite/Rollup/webpack: a glob gives you the manifest for free.
 * const pages = import.meta.glob('./routes/**\/+page.ts');
 * const { routes } = createFileRoutes(pages);
 * const router = createRouter({ routes });
 * ```
 *
 * @example
 * ```ts
 * // Zero-build: hand-write the manifest, no bundler needed.
 * const { routes } = createFileRoutes({
 *   './routes/index.ts': () => import('./routes/index.ts'),
 *   './routes/users/[id]/+page.ts': () => import('./routes/users/[id]/+page.ts'),
 * });
 * ```
 */
export const createFileRoutes = (
  manifest: RouteManifest,
  options: CreateFileRoutesOptions = {}
): CreateFileRoutesResult => {
  const layouts: LayoutEntry[] = [];

  // First pass: collect layouts so pages can compute their layout chains.
  for (const source of Object.keys(manifest)) {
    const parsed = parseFilePath(source, options);
    if (parsed?.kind === 'layout') {
      layouts.push({ dirSegments: parsed.dirSegments, id: parsed.pattern });
    }
  }

  const entries: FileRoute[] = [];

  // Second pass: build a FileRoute per page.
  for (const [source, entry] of Object.entries(manifest)) {
    const parsed = parseFilePath(source, options);
    if (!parsed || parsed.kind !== 'page') continue;

    const lazy = isLazyEntry(entry);
    const eager = lazy ? undefined : (entry as RouteModule);

    const load: Load | undefined = lazy
      ? async (args) => {
          const mod = await resolveModule(entry);
          return mod.load ? mod.load(args) : undefined;
        }
      : eager?.load;

    const action: Action | undefined = lazy
      ? async (args) => {
          const mod = await resolveModule(entry);
          if (!mod.action) {
            throw new Error(`bQuery router: no action exported for route "${parsed.pattern}".`);
          }
          return mod.action(args);
        }
      : eager?.action;

    const component = (): unknown | Promise<unknown> => {
      if (lazy) {
        return Promise.resolve(resolveModule(entry)).then((mod) => mod.default ?? mod);
      }
      return eager?.default ?? eager;
    };

    const layoutChain = layouts
      .filter((layout) => dirIsPrefix(layout.dirSegments, parsed.dirSegments))
      .sort((a, b) => a.dirSegments.length - b.dirSegments.length)
      .map((layout) => layout.id);

    entries.push({
      id: parsed.pattern,
      pattern: parsed.pattern,
      source,
      catchAll: parsed.catchAll,
      dynamicCount: parsed.paramNames.length,
      load,
      action,
      hasLoad: lazy ? undefined : !!eager?.load,
      hasAction: lazy ? undefined : !!eager?.action,
      layouts: layoutChain,
      component,
      resolve: () => Promise.resolve(resolveModule(entry)),
    });
  }

  sortEntriesBySpecificity(entries);

  const routes: RouteDefinition[] = entries.map((fileRoute) => {
    const meta: Record<string, unknown> = {
      fileRoute: {
        id: fileRoute.id,
        source: fileRoute.source,
        layouts: fileRoute.layouts,
        catchAll: fileRoute.catchAll,
      },
    };
    if (fileRoute.load) meta.load = fileRoute.load;
    if (fileRoute.action) meta.action = fileRoute.action;
    return {
      path: fileRoute.pattern,
      meta,
      component: fileRoute.component,
    };
  });

  return { routes, entries };
};

const segmentCount = (pattern: string): number =>
  pattern.split('/').filter(Boolean).length;

/**
 * Sort routes so that the existing first-match router resolves the most
 * specific pattern: static segments beat dynamic params at the same depth, and
 * catch-all routes always sort last.
 *
 * @internal
 */
export const sortEntriesBySpecificity = (entries: FileRoute[]): void => {
  entries.sort((a, b) => {
    if (a.catchAll !== b.catchAll) return a.catchAll ? 1 : -1;
    if (a.dynamicCount !== b.dynamicCount) return a.dynamicCount - b.dynamicCount;
    const segDelta = segmentCount(b.pattern) - segmentCount(a.pattern);
    if (segDelta !== 0) return segDelta;
    return a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0;
  });
};
