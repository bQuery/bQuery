/**
 * Public contracts for the opt-in file-route convention.
 *
 * These types are intentionally framework-agnostic: a "route module" is any
 * object that may carry a {@link Load} and/or {@link Action} plus a default
 * component export, and a "manifest" is the `Record<string, …>` you already get
 * from a bundler glob (`import.meta.glob`) or can hand-write for a zero-build
 * setup. Nothing here ships or assumes a bundler.
 *
 * @module bquery/router
 */

/**
 * Arguments passed to a route {@link Load} function.
 *
 * The same shape is used on the server (where `ctx` is the active SSR context)
 * and on the client (where `ctx` is `undefined` unless you thread one through).
 *
 * @typeParam Params - Shape of the matched route params (defaults to a string map).
 * @typeParam Ctx - Type of the ambient context (`SSRContext` on the server).
 */
export interface LoadArgs<
  Params extends Record<string, string> = Record<string, string>,
  Ctx = unknown,
> {
  /** Params extracted from the matched route (e.g. `{ id: '42' }`). */
  params: Params;
  /** The full request URL being loaded. */
  url: URL;
  /** The originating `Request`, when one exists (server / client fetch). */
  request?: Request;
  /** Ambient context — the SSR context on the server, otherwise `undefined`. */
  ctx?: Ctx;
  /** Abort signal that fires when the navigation/render is cancelled. */
  signal?: AbortSignal;
}

/**
 * A typed route data loader. Runs on the server before render and on client
 * navigation; its return value is exposed to the view as the route's `data`.
 *
 * @example
 * ```ts
 * // routes/users/[id]/+page.ts
 * import type { Load } from '@bquery/bquery/router';
 *
 * export const load: Load<{ user: User }, { id: string }> = async ({ params }) => {
 *   return { user: await getUser(params.id) };
 * };
 * ```
 */
export type Load<
  Data = unknown,
  Params extends Record<string, string> = Record<string, string>,
  Ctx = unknown,
> = (args: LoadArgs<Params, Ctx>) => Data | Promise<Data>;

/**
 * Arguments passed to a route {@link Action} function.
 *
 * @typeParam Params - Shape of the matched route params.
 * @typeParam Ctx - Type of the ambient context (`ServerContext` on the server).
 */
export interface ActionArgs<
  Params extends Record<string, string> = Record<string, string>,
  Ctx = unknown,
> {
  /** The mutating `Request` (usually a `POST` carrying `FormData`). */
  request: Request;
  /** Params extracted from the matched route. */
  params: Params;
  /** The request URL. */
  url: URL;
  /** Ambient context — the server context on the server, otherwise `undefined`. */
  ctx?: Ctx;
}

/**
 * A typed route action. Receives a mutating request and returns a result; the
 * natural progressive-enhancement target for a `<form>` (see `formAction()` in
 * `@bquery/bquery/forms`).
 *
 * @example
 * ```ts
 * import type { Action } from '@bquery/bquery/router';
 *
 * export const action: Action<{ ok: true }, { id: string }> = async ({ request }) => {
 *   await updateUser(await request.formData());
 *   return { ok: true };
 * };
 * ```
 */
export type Action<
  Result = unknown,
  Params extends Record<string, string> = Record<string, string>,
  Ctx = unknown,
> = (args: ActionArgs<Params, Ctx>) => Result | Promise<Result>;

/**
 * The shape of a `+page` / `+layout` module. Every member is optional so plain
 * component modules, data-only modules, and action-only endpoints all qualify.
 */
export interface RouteModule {
  /** The view/component for this route (any value; rendered by userland). */
  default?: unknown;
  /** Route-level data loader. */
  load?: Load;
  /** Route-level mutation handler. */
  action?: Action;
  /** Extra metadata merged into the generated route's `meta`. */
  meta?: Record<string, unknown>;
}

/**
 * A manifest entry: either an eagerly-evaluated {@link RouteModule} or a lazy
 * importer returning one. This matches both `import.meta.glob('...', { eager })`
 * forms, so a Vite/Rollup/webpack glob can be passed straight through.
 */
export type RouteManifestEntry =
  | RouteModule
  | (() => Promise<RouteModule> | RouteModule)
  | (() => Promise<{ default: unknown } & RouteModule>);

/**
 * A file-route manifest: maps source file paths to their modules (or lazy
 * importers). Keys are paths like `./routes/users/[id]/+page.ts`.
 */
export type RouteManifest = Record<string, RouteManifestEntry>;

/**
 * The kind of file recognised by the convention.
 */
export type FileRouteKind = 'page' | 'layout' | 'server';

/**
 * A single normalised file route produced by {@link createFileRoutes}.
 */
export interface FileRoute {
  /** Stable id (the route pattern, or `'/'` for the index). */
  id: string;
  /** Router path pattern (e.g. `/users/:id`, `/files/*`). */
  pattern: string;
  /** Original manifest key this route came from. */
  source: string;
  /** Whether this route is a catch-all (`[...rest]` → `*`). */
  catchAll: boolean;
  /** Number of dynamic (`:param`) segments — used for specificity sorting. */
  dynamicCount: number;
  /** The route-level loader, if the module exported one. */
  load?: Load;
  /** The route-level action, if the module exported one. */
  action?: Action;
  /**
   * Whether the module exports a `load`. `undefined` for lazily-imported
   * modules, where presence cannot be known without importing.
   */
  hasLoad?: boolean;
  /**
   * Whether the module exports an `action`. `undefined` for lazily-imported
   * modules, where presence cannot be known without importing.
   */
  hasAction?: boolean;
  /** Ids of the layout chain from root to this route (outermost first). */
  layouts: string[];
  /** Resolve the route's component (default export), lazily if needed. */
  component: () => unknown | Promise<unknown>;
  /** Resolve the route's full module (awaiting a lazy importer). */
  resolve: () => Promise<RouteModule>;
}

/**
 * Options for {@link createFileRoutes}.
 */
export interface CreateFileRoutesOptions {
  /**
   * Directory prefix to strip from manifest keys before deriving paths.
   * Leading `./` and `/` are ignored. Default: `'routes'`.
   */
  routesDir?: string;
  /**
   * File basenames (without extension) treated as the route leaf for a
   * directory. Default: `['+page', 'index']`.
   */
  pageFiles?: string[];
  /**
   * File basenames treated as layouts for their directory subtree.
   * Default: `['+layout', '_layout']`.
   */
  layoutFiles?: string[];
}

/**
 * Result of {@link createFileRoutes}.
 */
export interface CreateFileRoutesResult {
  /**
   * Route definitions ready for `createRouter({ routes })` (client) and the SSR
   * router bridge (`resolveSSRRoute` / `createSSRRouterContext`). Each carries
   * `meta.load` / `meta.action` / `meta.fileRoute`.
   */
  routes: import('../types').RouteDefinition[];
  /** The normalised file routes, sorted by descending specificity. */
  entries: FileRoute[];
}
