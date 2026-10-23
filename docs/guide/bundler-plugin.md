# Bundler Plugin

::: warning In development — not published yet
`@bquery/unplugin` is still in development and **not yet published on npm**,
so the install commands below do not work yet. It is developed in its own
repository, [bQuery/unplugin](https://github.com/bQuery/unplugin): follow it
for releases, progress and issues. This page describes the planned `0.1.0`.
:::

> `@bquery/unplugin` is a separate, optional package. bQuery itself stays
> zero-build: nothing on this page is needed to use the library from a CDN or
> without a bundler.

`@bquery/unplugin` connects bQuery's build-time tools to your bundler. It is
built on [unplugin](https://unplugin.unjs.io/): one implementation, with
adapters for **Vite**, **Rollup**, **webpack**, **Rspack** and **esbuild**.

| Feature                                     | What it replaces                                       | Bundlers         | Default |
| ------------------------------------------- | ------------------------------------------------------ | ---------------- | ------- |
| [View precompilation](#view-precompilation) | running `bquery-view-compile` and importing its output | all (HMR: Vite)  | on      |
| [File routes](#file-routes)                 | writing the `import.meta.glob` manifest by hand        | all (live: Vite) | on      |
| [i18n catalogs](#i18n-catalogs)             | running `bquery-i18n extract` after every change       | all              | off     |
| [CSP nonces](#csp-nonces-in-dev)            | allowing `'unsafe-inline'` in development              | Vite             | off     |
| [SSR dev middleware](#ssr-dev-middleware)   | writing a custom dev server around `ssrLoadModule()`   | Vite             | off     |

The plugin is a thin layer over APIs that bQuery already ships and tests:
[`@bquery/bquery/view/compiler`](./view#optional-compiler-build-step),
[`@bquery/bquery/i18n/extract`](./i18n#message-extraction-optional),
[`createFileRoutes()`](./file-routing), `generateNonce()` from
[`security`](./security), and the [SSR](./ssr) context.

## Install

Once the first release is on npm (see the note at the top of this page):

::: code-group

```sh [npm]
npm install -D @bquery/unplugin
```

```sh [bun]
bun add -d @bquery/unplugin
```

```sh [pnpm]
pnpm add -D @bquery/unplugin
```

:::

`@bquery/bquery` (`^1.17.2`) is a peer dependency. Install the bundler you use;
each one is an optional peer dependency.

## Setup

All adapters take the same [options](#options).

::: code-group

```ts [Vite]
// vite.config.ts
import { defineConfig } from 'vite';
import bquery from '@bquery/unplugin/vite';

export default defineConfig({
  plugins: [
    bquery({
      i18n: { catalog: 'locales/en.json', locales: ['locales/de.json'] },
      csp: true,
      ssr: { entry: 'src/entry-server.ts' },
    }),
  ],
});
```

```js [Rollup]
// rollup.config.js
import bquery from '@bquery/unplugin/rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/main.ts',
  output: { dir: 'dist', format: 'es' },
  plugins: [bquery({ i18n: true }), nodeResolve()],
};
```

```js [webpack]
// webpack.config.js
import bquery from '@bquery/unplugin/webpack';

export default {
  entry: './src/main.ts',
  plugins: [bquery({ i18n: true })],
};
```

```js [Rspack]
// rspack.config.js
import bquery from '@bquery/unplugin/rspack';

export default {
  entry: './src/main.ts',
  plugins: [bquery({ i18n: true })],
};
```

```js [esbuild]
// build.mjs
import { build } from 'esbuild';
import bquery from '@bquery/unplugin/esbuild';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'esm',
  splitting: true,
  outdir: 'dist',
  plugins: [bquery({ i18n: true })],
});
```

:::

The root export also gives access to every adapter: `import { bquery } from '@bquery/unplugin'`,
then `bquery.vite()`, `bquery.rollup()`, and so on.

### TypeScript

To type the virtual modules and template imports, reference the client types
once, for example in `src/env.d.ts`:

```ts
/// <reference types="@bquery/unplugin/client" />
```

## Options

```ts
interface BQueryPluginOptions {
  root?: string; // default: Vite root, webpack/Rspack `context`, esbuild `absWorkingDir`, or cwd
  views?: boolean | ViewsOptions; // default: enabled
  fileRoutes?: boolean | FileRoutesOptions; // default: enabled (active only when imported)
  i18n?: boolean | I18nOptions; // default: disabled
  csp?: boolean | CspOptions; // default: disabled; Vite only
  ssr?: boolean | SsrOptions; // default: disabled; Vite only
}
```

Pass `true` to turn a feature on with its defaults, or `false` to turn it off.
Views and file routes are on by default because they do nothing until you
import a template or `virtual:bquery/routes`. The other features write files,
change response headers or take over requests, so you turn them on yourself.

## View precompilation

`view` evaluates `bq-*` expressions at runtime with `new Function()`, which
needs `'unsafe-eval'` in your CSP. The
[optional compiler](./view#optional-compiler-build-step) precompiles
expressions into plain functions. The plugin runs the compiler when a template
is imported, so the CLI and the generated files are no longer needed.

There are two ways to import a template:

```ts
// 1. Files matching `views.include` (default: **/*.view.html)
import template from './views/todo-list.view.html';

// 2. Any .html file with the ?bq-view query, e.g. the markup already in index.html
import '../index.html?bq-view';
```

Each import becomes the module that `compileToModule()` emits: it calls
`registerCompiledExpressions()` when it runs. The default export is the
template markup as a string. As the [view guide](./view#optional-compiler-build-step)
requires, import a template before you mount it:

```ts
import { mount, signal } from '@bquery/bquery/view';
import template from './views/counter.view.html'; // registers the compiled expressions

document.querySelector('#app')!.innerHTML = template;
mount('#app', { count: signal(0) }); // uses the precompiled functions automatically
```

The compiler skips expressions it cannot handle, such as arrow functions,
template literals or assignments. These keep working through the runtime
evaluator, and the plugin emits one bundler warning for each skipped
expression:

```
[bquery:views] src/views/counter.view.html: "`Hi ${name}`" falls back to the runtime evaluator (template literals fall back to runtime).
```

**HMR (Vite):** when you edit a template, the new module registers its
expressions again. If the markup changed, the update passes on to the modules
that import the template, which usually means a page reload. Modules that
self-accept HMR can re-mount instead.

| Option            | Default                 | Description                                                                      |
| ----------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `include`         | `['**/*.view.html']`    | Templates compiled without the query flag. Globs, `RegExp`s or predicates.       |
| `exclude`         | —                       | Templates never compiled implicitly. The query flag still opts them in.          |
| `query`           | `'bq-view'`             | Query flag that opts any `.html` import in.                                      |
| `importSpecifier` | `'@bquery/bquery/view'` | Module that `registerCompiledExpressions` is imported from.                      |
| `prefix`          | `'bq'`                  | Directive prefix. Must match `mount(…, { prefix })`.                             |
| `globals`         | —                       | Extra global identifiers the compiler leaves unprefixed.                         |
| `warnSkipped`     | `true`                  | Emit one warning for each expression that falls back to the runtime.             |
| `onCompiled`      | —                       | `({ file, stats }) => void`, called after each compile (e.g. to check coverage). |

## File routes

The [file-routing guide](./file-routing) builds the manifest with
`import.meta.glob`. The plugin generates that manifest for you as a virtual
module:

```ts
import { createRouter } from '@bquery/bquery/router';
import { routes } from 'virtual:bquery/routes';

const router = createRouter({ routes });
```

The module scans `fileRoutes.dir` (default `src/routes`), then passes the
result to `createFileRoutes()`. Every page and layout is loaded lazily with
`import()`, so each route gets its own chunk. `+server` files are left out
because they are server-only and must never reach the client bundle. The
module exports:

| Export               | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `routes` (+ default) | `RouteDefinition[]` for `createRouter()` and the SSR bridge (`createSSRRouterContext`).         |
| `entries`            | Normalised `FileRoute[]`, e.g. for `mountFileRoutes()` from `@bquery/bquery/server`.            |
| `manifest`           | The generated manifest. Keys are root-relative paths such as `/src/routes/users/[id]/+page.ts`. |
| `layouts`            | Layout modules keyed by layout id. These are the ids listed in `meta.fileRoute.layouts`.        |
| `options`            | The options passed to `createFileRoutes()` (`routesDir`, …).                                    |

The same module works in server code, for example in an SSR entry:

```ts
import { createSSRRouterContext } from '@bquery/bquery/ssr';
import { routes } from 'virtual:bquery/routes';

const resolved = await createSSRRouterContext({ url: request.url, routes, ctx });
```

**Live updates (Vite):** when you add or delete a file under `dir`, the plugin
regenerates the module and reloads the page. Edits to an existing route module
use normal HMR. Other bundlers regenerate the module on the next build.

| Option         | Default                                  | Description                                                         |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `dir`          | `'src/routes'`                           | Directory scanned for route files, relative to the root.            |
| `extensions`   | `['.ts', '.tsx', '.js', '.jsx', '.mjs']` | Extensions treated as route modules.                                |
| `exclude`      | —                                        | Files under `dir` to leave out.                                     |
| `pageFiles`    | `['+page', 'index']`                     | Passed to `createFileRoutes()`.                                     |
| `layoutFiles`  | `['+layout', '_layout']`                 | Passed to `createFileRoutes()`.                                     |
| `eager`        | `false`                                  | Import route modules statically instead of lazily.                  |
| `routerImport` | `'@bquery/bquery/router'`                | Module that `createFileRoutes` is imported from.                    |
| `onUpdate`     | —                                        | Vite only: `(file) => void` after a route file is added or removed. |

## i18n catalogs

With `i18n` enabled, the plugin runs the
[extractor](./i18n#message-extraction-optional) when the build starts. In watch
mode and the Vite dev server, it runs again whenever a matching source file
changes. New keys are merged into your JSON catalogs with `mergeCatalog()`:

- Existing translations are never overwritten. Stale keys are kept unless you
  set `prune: true`.
- The source-locale `catalog` receives the `defineMessages()` defaults. The
  other `locales` receive new keys with an empty string, ready to translate.
- A catalog is written only when its content changes, so file watchers are not
  triggered by unchanged writes. The JSON format matches the `bquery-i18n` CLI
  exactly.
- A catalog that is not valid JSON (for example while you are editing it) is
  left untouched, and the plugin emits a warning.

```ts
bquery({
  i18n: {
    include: ['src/**/*.{ts,tsx}'],
    catalog: 'locales/en.json',
    locales: ['locales/de.json', 'locales/fr.json'],
  },
});
```

### `virtual:bquery/messages`

The catalogs are also available as a module, keyed by locale. In the Vite dev
server, `hotReload()` merges edited catalogs into a running instance with
`mergeMessages()`, without a page reload:

```ts
import { createI18n } from '@bquery/bquery/i18n';
import { messages, hotReload } from 'virtual:bquery/messages';

export const i18n = hotReload(
  createI18n({ locale: 'en', fallbackLocale: 'en', messages }),
  () => rerender() // optional: re-render after a catalog changes
);
```

`mergeMessages()` is not reactive. Strings you have already rendered update
the next time they are translated, or right away if you pass the `onUpdate`
callback. Outside the Vite dev server, `hotReload()` does nothing.
The module inlines every catalog. For large apps, keep loading locales lazily
with `loadLocale('de', () => import('../locales/de.json'))` instead.

| Option      | Default                                | Description                                                                                               |
| ----------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `include`   | `['src/**/*.{ts,tsx,js,jsx,mjs,cjs}']` | Source files scanned for `t()` / `tc()` / `defineMessages()`.                                             |
| `exclude`   | —                                      | Source files to skip.                                                                                     |
| `catalog`   | `'locales/en.json'`                    | Source-locale catalog. The locale name comes from the file name.                                          |
| `locales`   | `[]`                                   | Other catalogs, as an array of files or a `{ locale: file }` record.                                      |
| `prune`     | `false`                                | Remove keys that are no longer found in the source.                                                       |
| `extract`   | `true`                                 | `false` serves `virtual:bquery/messages` without writing catalogs.                                        |
| `onExtract` | —                                      | `(results) => void`, called after each sync with `{ locale, file, written, added, removed }` per catalog. |

## CSP nonces in dev

With `csp` enabled, the Vite dev server serves a strict policy without
`'unsafe-inline'`. When the server starts, the plugin creates one nonce with
`generateNonce()` from `@bquery/bquery/security` and does two things with it:

- It sets Vite's `html.cspNonce` to the nonce. Vite then adds `nonce="…"` to
  every `<script>`, `<style>` and stylesheet/preload `<link>` in the HTML it
  serves, including SSR output, and injects `<meta property="csp-nonce">`.
  Vite's client reads that meta tag to add the nonce to the styles it injects
  at runtime.
- It sends a matching `Content-Security-Policy` header with HTML responses.

The default policy is:

```
default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'nonce-…';
img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;
object-src 'none'; base-uri 'self'
```

```ts
bquery({
  csp: {
    // Allow the runtime evaluator while not every expression is precompiled:
    directives: { 'script-src': ["'self'", "'unsafe-eval'"] },
  },
});
```

`script-src` and `style-src` always receive the nonce, even when you override
them. In a production build the plugin does nothing, because a static file
cannot hold a per-request nonce. If your server replaces a placeholder per
request, set `build: true` together with a fixed nonce string, such as
`{ nonce: '__CSP_NONCE__', build: true }`.

| Option       | Default  | Description                                                                     |
| ------------ | -------- | ------------------------------------------------------------------------------- |
| `nonce`      | `'auto'` | `'auto'` creates one nonce per dev-server start. A string is used as the nonce. |
| `directives` | —        | Overrides merged over the default directives. `false` removes a directive.      |
| `policy`     | —        | A full policy string (`{nonce}` is replaced), or `(nonce) => string`.           |
| `reportOnly` | `false`  | Send `Content-Security-Policy-Report-Only` instead.                             |
| `header`     | `true`   | Send the header. `false` only stamps nonces on tags.                            |
| `build`      | `false`  | Also stamp the fixed `nonce` string on built HTML.                              |

## SSR dev middleware

With `ssr` enabled, the Vite dev server renders HTML navigations through your
server entry:

1. For a `GET`/`HEAD` request that accepts `text/html` and has no file
   extension (or `.html`), the plugin loads the entry with
   `server.ssrLoadModule()`. Edits to the entry apply without a restart.
2. It calls the entry's `render` export with a Web `Request` and a context
   object.
3. It passes HTML output through `server.transformIndexHtml()`, which injects
   the Vite client, CSP nonces and the output of other plugins, then sends the
   response.
4. When `render` throws, the plugin fixes the stack trace with
   `server.ssrFixStacktrace()` and passes the error to Vite's error handling.

The middleware runs after Vite's static-file and module middlewares and before
its `index.html` fallback. Assets and modules are therefore never sent to the
entry.

### The render contract

```ts
// src/entry-server.ts
import { createSSRContext, renderToResponse } from '@bquery/bquery/ssr';
import type { SsrRenderContext } from '@bquery/unplugin';

export async function render(request: Request, ctx: SsrRenderContext) {
  const ssr = createSSRContext({ request, nonce: ctx.nonce });
  return renderToResponse(ctx.template, { title: 'Hello' }, { context: ssr });
}
```

`render(request, ctx)` returns one of the following:

- **an HTML string:** sent with status `200` after `transformIndexHtml()`.
- **a `Response`:** if its `content-type` is `text/html`, the body is passed
  through `transformIndexHtml()` and the status and headers are kept. Any other
  response, such as JSON or a redirect, is streamed through unchanged.
- **`null` / `undefined`:** the request goes to the next middleware, which for
  a SPA is Vite's `index.html`.

`ctx` contains:

| Field      | Description                                                                       |
| ---------- | --------------------------------------------------------------------------------- |
| `url`      | The full request `URL`.                                                           |
| `template` | The raw `index.html` (the `ssr.template` option). Vite transforms the final HTML. |
| `nonce`    | The CSP nonce when `csp` is enabled. Pass it to `createSSRContext({ nonce })`.    |
| `dev`      | Always `true`.                                                                    |
| `server`   | The Vite dev server.                                                              |

The signature is `(Request) => Response`, the same as bQuery's runtime
adapters. In production you can reuse the entry, for example with
`createNodeHandler((request) => render(request, { url: new URL(request.url), template, dev: false }))`.
This takes `template` from your built `index.html`.

| Option          | Default                 | Description                                                          |
| --------------- | ----------------------- | -------------------------------------------------------------------- |
| `entry`         | `'src/entry-server.ts'` | Server entry, relative to the root.                                  |
| `export`        | `'render'`              | Name of the render export.                                           |
| `template`      | `'index.html'`          | File passed as `ctx.template`. `false` passes `''`.                  |
| `transformHtml` | `true`                  | Run HTML output through `server.transformIndexHtml()`.               |
| `filter`        | —                       | `(url, req) => boolean` that narrows which navigations are rendered. |

## Limitations

- **`csp` and `ssr` work only with Vite.** They need a dev server. Other
  bundlers ignore them and print one warning per build.
- **Live updates depend on the bundler.** Vite updates file routes when files
  are added or removed, and gives views and catalogs HMR. Rollup, webpack and
  Rspack in watch mode re-extract catalogs on change, but only regenerate
  `virtual:bquery/routes` on the next full build. esbuild re-runs the
  extraction on every rebuild.
- **webpack and Rspack** use the same code paths as the other bundlers through
  unplugin's adapters. Unlike Vite, Rollup and esbuild, they are not covered by
  the plugin's own test suite.
- **Templates are resolved from relative paths** (`./`, `../`) or root-relative
  paths (`/src/…`). Templates imported by bare package specifiers are not
  compiled.
- **The CSP nonce changes once per dev-server start, not per request**, and is
  shared by all requests. That is enough to develop against a strict policy.
  In production, create nonces per request with `createSSRContext()`.
- The i18n extractor is the same best-effort scanner as the CLI. See the
  [i18n guide](./i18n#message-extraction-optional) for what it detects.
