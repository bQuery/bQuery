/**
 * Type declarations for `@bquery/unplugin`.
 *
 * @module @bquery/unplugin
 */

import type { UnpluginInstance, UnpluginOptions, UnpluginContextMeta } from 'unplugin';
import type { CompileStats } from '@bquery/bquery/view/compiler';

/**
 * A file pattern: a glob (matched against the path relative to the project
 * root, supporting `**`, `*`, `?` and `{a,b}`), a `RegExp` (matched against the
 * absolute `/`-separated path) or a predicate receiving the absolute path.
 */
export type FilePattern = string | RegExp | ((file: string) => boolean);

/** Options for view precompilation (`*.view.html` / `*.html?bq-view`). */
export interface ViewsOptions {
  /**
   * Files compiled when imported without the query flag.
   * @default ['**\/*.view.html']
   */
  include?: FilePattern | FilePattern[];
  /** Files never compiled implicitly (the query flag still opts them in). */
  exclude?: FilePattern | FilePattern[];
  /**
   * Query flag that opts any `.html` import into compilation.
   * @default 'bq-view'
   */
  query?: string;
  /**
   * Module the emitted code imports `registerCompiledExpressions` from.
   * @default '@bquery/bquery/view'
   */
  importSpecifier?: string;
  /** Directive prefix, matching `mount(..., { prefix })`. @default 'bq' */
  prefix?: string;
  /** Extra global identifiers left un-prefixed by the compiler. */
  globals?: Iterable<string>;
  /**
   * Emit a bundler warning for every expression that falls back to the runtime
   * evaluator. @default true
   */
  warnSkipped?: boolean;
  /** Called after each template compiles (e.g. to assert coverage). */
  onCompiled?: (result: { file: string; stats: CompileStats }) => void;
}

/** Options for the `virtual:bquery/routes` file-route manifest. */
export interface FileRoutesOptions {
  /** Directory scanned for route files, relative to the root. @default 'src/routes' */
  dir?: string;
  /** Route module extensions. @default ['.ts', '.tsx', '.js', '.jsx', '.mjs'] */
  extensions?: string[];
  /** Files under `dir` to leave out of the manifest. */
  exclude?: FilePattern | FilePattern[];
  /** Page leaf basenames, passed to `createFileRoutes`. @default ['+page', 'index'] */
  pageFiles?: string[];
  /** Layout basenames, passed to `createFileRoutes`. @default ['+layout', '_layout'] */
  layoutFiles?: string[];
  /**
   * Import route modules statically instead of with lazy `import()`.
   * @default false
   */
  eager?: boolean;
  /** Module `createFileRoutes` is imported from. @default '@bquery/bquery/router' */
  routerImport?: string;
  /** Vite dev only: called when a route file is added or removed. */
  onUpdate?: (file: string) => void;
}

/** Result of one catalog sync, passed to {@link I18nOptions.onExtract}. */
export interface CatalogSyncResult {
  /** Locale name (catalog basename or the `locales` record key). */
  locale: string;
  /** Absolute catalog path. */
  file: string;
  /** Whether this is the source-locale catalog (receives default strings). */
  primary: boolean;
  /** Whether the file was rewritten (`false` when the content was unchanged). */
  written: boolean;
  /** Keys added by this run. */
  added: string[];
  /** Keys pruned by this run (only with `prune`). */
  removed: string[];
}

/** Options for i18n catalog extraction and `virtual:bquery/messages`. */
export interface I18nOptions {
  /**
   * Source files scanned for `t()` / `tc()` / `defineMessages()`.
   * @default ['src/**\/*.{ts,tsx,js,jsx,mjs,cjs}']
   */
  include?: FilePattern | FilePattern[];
  /** Source files to skip. */
  exclude?: FilePattern | FilePattern[];
  /**
   * Source-locale catalog; new keys get their `defineMessages` default.
   * @default 'locales/en.json'
   */
  catalog?: string;
  /**
   * Further catalogs that receive new keys with an empty string (awaiting
   * translation). An array derives the locale from the file name; a record
   * maps locale → file.
   */
  locales?: string[] | Record<string, string>;
  /** Drop keys no longer found in source. @default false */
  prune?: boolean;
  /**
   * Write catalogs on build start and on source changes. `false` only serves
   * `virtual:bquery/messages`. @default true
   */
  extract?: boolean;
  /** Called after each sync with one result per catalog. */
  onExtract?: (results: CatalogSyncResult[]) => void;
}

/** Options for CSP nonce injection (Vite only). */
export interface CspOptions {
  /**
   * `'auto'` generates one nonce per dev-server start with bQuery's
   * `generateNonce()`; a string is used verbatim. @default 'auto'
   */
  nonce?: 'auto' | string;
  /** Directive overrides merged over the defaults; `false` removes one. */
  directives?: Record<string, string | string[] | false>;
  /** A full policy (`{nonce}` is replaced) or a function of the nonce. */
  policy?: string | ((nonce: string) => string);
  /** Send `Content-Security-Policy-Report-Only` instead. @default false */
  reportOnly?: boolean;
  /** Send the header from the dev server. @default true */
  header?: boolean;
  /**
   * Also stamp the (fixed, string) `nonce` on built HTML — e.g. a placeholder
   * your server replaces per request. @default false
   */
  build?: boolean;
}

/**
 * Context passed to the SSR entry's render function. The dev middleware fills
 * every field; in production you build it yourself (`server` omitted).
 */
export interface SsrRenderContext {
  /** The full request URL. */
  url: URL;
  /** Raw (untransformed) contents of `template`, or `''`. */
  template: string;
  /** The CSP nonce when `csp` is enabled (pass it to `createSSRContext`). */
  nonce?: string;
  /** `true` in the dev middleware. */
  dev: boolean;
  /** The Vite dev server (dev middleware only). */
  server?: unknown;
}

/**
 * The render export of the SSR entry. Return an HTML string, a `Response`, or
 * `null`/`undefined` to fall through to the next middleware.
 */
export type SsrRender = (
  request: Request,
  ctx: SsrRenderContext
) => string | Response | null | undefined | Promise<string | Response | null | undefined>;

/** Options for the SSR dev middleware (Vite only). */
export interface SsrOptions {
  /** Server entry, relative to the root. @default 'src/entry-server.ts' */
  entry?: string;
  /** Name of the render export. @default 'render' */
  export?: string;
  /** HTML template passed as `ctx.template`; `false` for none. @default 'index.html' */
  template?: string | false;
  /** Run HTML results through `server.transformIndexHtml()`. @default true */
  transformHtml?: boolean;
  /** Extra predicate deciding which HTML navigations are rendered. */
  filter?: (url: URL, req: unknown) => boolean;
}

/** Options of the bQuery bundler plugin. */
export interface BQueryPluginOptions {
  /** Project root. Defaults to Vite's root, webpack's `context`, or `cwd`. */
  root?: string;
  /** View precompilation. Enabled by default. */
  views?: boolean | ViewsOptions;
  /** `virtual:bquery/routes`. Enabled by default (only active when imported). */
  fileRoutes?: boolean | FileRoutesOptions;
  /** Catalog extraction + `virtual:bquery/messages`. Disabled by default. */
  i18n?: boolean | I18nOptions;
  /** Dev-server CSP nonces (Vite only). Disabled by default. */
  csp?: boolean | CspOptions;
  /** SSR dev middleware (Vite only). Disabled by default. */
  ssr?: boolean | SsrOptions;
}

/** Id of the file-routes virtual module. */
export declare const ROUTES_MODULE_ID: 'virtual:bquery/routes';
/** Id of the catalogs virtual module. */
export declare const MESSAGES_MODULE_ID: 'virtual:bquery/messages';
/** Default CSP directives used by {@link buildCspPolicy}. */
export declare const DEFAULT_CSP_DIRECTIVES: Readonly<Record<string, string[]>>;

/** Builds the dev `Content-Security-Policy` value for a nonce. */
export declare function buildCspPolicy(
  nonce: string,
  overrides?: Record<string, string | string[] | false>
): string;

/** Builds the module a view template compiles to. */
export declare function buildViewModule(
  template: string,
  options: ViewsOptions,
  hmr: boolean
): { code: string; stats: CompileStats };

/** A route file discovered under {@link FileRoutesOptions.dir}. */
export interface RouteFileRecord {
  /** Manifest key: the root-relative path with a leading `/`. */
  key: string;
  /** Absolute path. */
  file: string;
  kind: 'page' | 'layout';
  /** Router pattern derived by `parseFilePath`. */
  pattern: string;
}

/** Lists the route files for a root (server-only `+server` files excluded). */
export declare function scanRouteFiles(
  options: FileRoutesOptions,
  root: string
): Promise<RouteFileRecord[]>;

/** Generates the `virtual:bquery/routes` source. */
export declare function generateRoutesModule(
  records: RouteFileRecord[],
  options: FileRoutesOptions,
  root: string
): string;

/** Generates the `virtual:bquery/messages` source. */
export declare function generateMessagesModule(
  messages: Record<string, unknown>,
  hmr: boolean
): string;

/** The unplugin factory (one sub-plugin per enabled feature). */
export declare function unpluginFactory(
  options: BQueryPluginOptions | undefined,
  meta: UnpluginContextMeta
): UnpluginOptions[];

/** The bQuery unplugin instance with `.vite`, `.rollup`, `.webpack`, `.rspack`, `.esbuild`. */
export declare const bquery: UnpluginInstance<BQueryPluginOptions | undefined, true>;

export default bquery;
