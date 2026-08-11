# File-based Routing

> **Status:** opt-in, additive. Programmatic routing (`createRouter`) stays fully
> supported and unchanged. Ships in the `router` module — no bundler, no build
> tool. Available since **1.15.0**.

bQuery's [`router`](./router) is programmatic: you hand `createRouter()` an array
of route definitions. The file-route convention is a thin, **bundler-agnostic**
layer on top that lets you:

- derive that route array from a directory layout (`routes/users/[id]/+page.ts`),
- attach a typed [`load`](#typed-load) that flows data into the view on both the
  server and client, and
- attach a typed [`action`](#typed-action) that a `<form>` (or `formAction()`)
  posts to — bridging `router`, [`ssr`](./ssr), and [`server`](./server).

It deliberately does **not** ship a bundler. The input is a _manifest_: the same
`Record<string, …>` a bundler glob (`import.meta.glob`) already gives you, or a
map you write by hand for a zero-build setup.

## The convention

A directory under `routes/` describes the URL; a `+page` file is the leaf:

| File                                   | Route pattern                                                 |
| -------------------------------------- | ------------------------------------------------------------- |
| `routes/index.ts` or `routes/+page.ts` | `/`                                                           |
| `routes/about/+page.ts`                | `/about`                                                      |
| `routes/users/[id]/+page.ts`           | `/users/:id`                                                  |
| `routes/files/[...path]/+page.ts`      | `/files/*` (catch-all)                                        |
| `routes/(marketing)/pricing/+page.ts`  | `/pricing` (pathless `(group)`)                               |
| `routes/blog/[slug].ts`                | `/blog/:slug` (flat, Next/Nuxt style)                         |
| `routes/+layout.ts`                    | layout for the subtree (recorded on `meta.fileRoute.layouts`) |
| `routes/api/users/+server.ts`          | server-only endpoint (no page)                                |

Supported segment syntax: `[id]` → `:id`, `[...rest]` → `*`, `(group)` → dropped.
The catch-all matches the remainder but is **unnamed** (the router's `*` does not
capture a param). Optional `[[id]]` segments are normalised to required params.

## Building the route table

`createFileRoutes()` turns a manifest into plain `RouteDefinition`s plus a
normalised `entries` list. The result drops straight into `createRouter()`.

```ts
import { createFileRoutes, createRouter } from '@bquery/bquery/router';

// With a bundler — a glob is your manifest, for free:
const pages = import.meta.glob('./routes/**/+page.ts');
const { routes, entries } = createFileRoutes(pages);

const router = createRouter({ routes });
```

```ts
// Zero-build — hand-write the manifest, no bundler required:
const { routes } = createFileRoutes({
  './routes/index.ts': () => import('./routes/index.ts'),
  './routes/users/[id]/+page.ts': () => import('./routes/users/[id]/+page.ts'),
});
```

Routes are sorted by specificity (`sortEntriesBySpecificity`) so the existing
first-match router resolves the most specific pattern: a static `/users/new`
beats a dynamic `/users/:id`, and catch-all routes always sort last. `parseFilePath`
and `filePathToRoutePattern` are exported if you need the raw conversion.

## Typed `load`

A `+page` module may export a `load`. Its return value becomes the route's
`data`. The same function runs **on the server before render** (via the SSR
router bridge) and **on the client on navigation** (via `createRouteData`).

```ts
// routes/users/[id]/+page.ts
import type { Load } from '@bquery/bquery/router';

export const load: Load<{ user: User }, { id: string }> = async ({ params, url }) => {
  return { user: await getUser(params.id) };
};
```

### Server: runs before render

The SSR router bridge recognises the file-route `load` automatically — no extra
wiring beyond what SSR already does for `meta.loader`:

```ts
import { createSSRContext, createSSRRouterContext, renderToResponse } from '@bquery/bquery/ssr';

const ctx = createSSRContext({ request });
const resolved = await createSSRRouterContext({ url: request.url, routes, ctx });
if (resolved.isRedirect) return Response.redirect(resolved.redirectTo!, 302);

// resolved.data and resolved.bindings.data hold the loader result.
return renderToResponse(template, { ...resolved.bindings }, { context: ctx });
```

### Client: runs on navigation

`createRouteData(router)` subscribes to the router and runs the matched route's
`load` whenever the route changes, exposing reactive `data` / `pending` / `error`
signals (with stale-response guarding). `useRouteData()` reads the ambient handle.

```ts
import { createRouteData, useRouteData } from '@bquery/bquery/router';

const { data, pending, error } = createRouteData(router);

// Elsewhere, in a component:
const { data } = useRouteData<{ user: User }>();
```

## Typed `action`

A `+page` module may export an `action` — the progressive-enhancement target for
a `<form>`. It receives the mutating request and returns a result.

```ts
// routes/users/[id]/+page.ts
import type { Action } from '@bquery/bquery/router';

export const action: Action<{ ok: true }, { id: string }> = async ({ request, params }) => {
  await updateUser(params.id, await request.formData());
  return { ok: true };
};
```

### Wiring actions to the server

The [`server`](./server) module turns these actions into reachable routes. Pass
the `entries` from `createFileRoutes()` to `mountFileRoutes()` (or
`createFileRouteServerRoutes()` for the raw `ServerRoute[]`). Routes whose module
statically exports no `action` are skipped; lazily-imported routes reply `405`
when no `action` exists.

```ts
import { createServer, csrf, mountFileRoutes } from '@bquery/bquery/server';
import { createFileRoutes } from '@bquery/bquery/router';

const { entries } = createFileRoutes(import.meta.glob('./routes/**/+page.ts'));

const app = createServer();
mountFileRoutes(app, entries, {
  middlewares: [csrf()], // mutations are CSRF-guarded
  dataPath: '/__data', // optional: also serve `load` as JSON under /__data/*
});
```

On the client, bind the form with `formAction()` from
[`forms`](./forms) for native-POST fallback plus fetch enhancement:

```ts
import { formAction } from '@bquery/bquery/forms';

const submit = formAction('/users/42', { method: 'POST', csrf: () => token });
submit.enhance(document.querySelector('form')!);
```

## API reference

### `router`

- `createFileRoutes(manifest, options?)` → `{ routes, entries }`
- `filePathToRoutePattern(key, options?)` / `parseFilePath(key, options?)`
- `sortEntriesBySpecificity(entries)`
- `createRouteData(router, options?)` / `useRouteData()`
- `getRouteLoad(route)` / `getRouteAction(route)`
- Types: `Load`, `LoadArgs`, `Action`, `ActionArgs`, `RouteModule`,
  `RouteManifest`, `RouteManifestEntry`, `FileRoute`, `FileRouteKind`,
  `ParsedFilePath`, `RouteData`, `RouteDataOptions`,
  `CreateFileRoutesOptions`, `CreateFileRoutesResult`

### `server`

- `mountFileRoutes(app, entries, options?)` → `ServerApp`
- `createFileRouteServerRoutes(entries, options?)` → `ServerRoute[]`
- Type: `FileRouteServerOptions`

## Caveats

- The catch-all `*` matches the remainder but does not capture a named param.
- Layout files are **recorded** on `meta.fileRoute.layouts` (a chain from root to
  leaf) for userland composition; the convention does not itself render a nested
  layout tree.
- `dataPath` JSON loader endpoints are opt-in; by default loaders run in-process
  (SSR before render, client on navigation), not over HTTP.

## Related modules

- [Router](./router) — the programmatic foundation this builds on.
- [SSR](./ssr) — `createSSRRouterContext` runs `load` before render.
- [Server](./server) — `mountFileRoutes` exposes `action` over HTTP.
- [Forms](./forms) — `formAction()` is the progressive-enhancement client.

## Version history

- **1.15.0** — Initial file-route convention: `createFileRoutes`, typed
  `Load` / `Action`, `createRouteData` / `useRouteData`, SSR `meta.load` bridge,
  and `mountFileRoutes` / `createFileRouteServerRoutes` server endpoints.
