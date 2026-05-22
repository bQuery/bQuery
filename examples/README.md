# bQuery examples

Runnable examples that demonstrate how to host a bQuery SSR app under
three different JavaScript runtimes, plus pointers to other code samples
found throughout the documentation.

## SSR runtime parity

Three minimal SSR servers — one per runtime — all using **the exact same**
bQuery template + binding context. They demonstrate the `1.11.0` runtime-agnostic
SSR surface built around `createSSRContext()`, `resolveSSRRoute()`, and
`renderToResponse()` running untouched on Bun, Deno, and Node ≥ 24.

| Runtime | Folder                    | How to run                                                               |
| ------- | ------------------------- | ------------------------------------------------------------------------ |
| Bun     | [`ssr-bun/`](./ssr-bun)   | `bun examples/ssr-bun/serve.ts`                                          |
| Deno    | [`ssr-deno/`](./ssr-deno) | `deno run -A examples/ssr-deno/serve.ts`                                 |
| Node    | [`ssr-node/`](./ssr-node) | `node --experimental-strip-types examples/ssr-node/serve.ts` (Node ≥ 24) |

All three serve <http://localhost:3000/> and respond to both `/` and
`/about` because those paths are the two route definitions in
[`shared/app.ts`](./shared/app.ts). They share that file to build the
binding context, resolve the route, and produce a `Response` via
`renderToResponse()`.

### Prerequisites

The examples import directly from `src/` inside this repository checkout, so
they do **not** require a prebuilt `dist/` bundle. From the repository root:

```bash
bun install
```

Optional smoke test against the published bundle layout:

```bash
bun run build
```

If you want to use a runtime that isn't pre-installed:

- **Bun** ≥ 1.3.13 — <https://bun.sh>
- **Deno** ≥ 1.40 — <https://deno.com> (the script uses `Deno.serve`)
- **Node** ≥ 24.0.0 — needed for `--experimental-strip-types` so the `.ts`
  file can run without a transpile step

### What each runtime entry does

Each `serve.ts` is a thin adapter that:

1. Imports the shared `handle(request, runtime)` from `shared/app.ts`.
2. Hands every incoming `Request` to `handle()`, which returns a `Response`.
3. Wires the runtime-specific HTTP server (`Bun.serve`, `Deno.serve`, or
   Node's `node:http`).

The handler is identical across runtimes because bQuery's SSR module
operates on the standard `Request`/`Response` interfaces.

### Walkthrough of the shared template

[`shared/app.ts`](./shared/app.ts) is intentionally small. It:

- Defines an HTML `TEMPLATE` string that uses the same `bq-*` directives
  the [View module](../docs/guide/view.md) consumes on the client:
  `bq-text`, `bq-for`, and so on.
- Declares two routes — `/` and `/about` — passed to `resolveSSRRoute()`.
- Calls `createSSRContext({ request, mode: 'string' })` so the SSR module
  knows it should produce a string (rather than a stream) for this
  response. Use `mode: 'stream'` plus `renderToStream()` for streaming
  responses (see the [SSR guide](../docs/guide/ssr.md)).
- Honors redirects from the resolved route via `Response.redirect()`.
- Renders the page with `renderToResponse(TEMPLATE, bindingContext, options)`
  with `etag: true` and a cache-control header so conditional requests
  return `304 Not Modified` automatically.

The binding context demonstrates several common SSR data shapes in one
place — a string (`title`), a derived message, the route metadata, and a
list rendered by `bq-for`.

### Verifying the response

Once a server is running, a quick smoke test:

```bash
curl -i http://localhost:3000/
curl -i http://localhost:3000/about
curl -i http://localhost:3000/missing  # 404 path
```

You should see SSR-rendered HTML, a stable `ETag` header on `200`
responses, and `Cache-Control: public, max-age=0, must-revalidate`.

## Other examples in this repository

While only the SSR servers live under `examples/`, several other
focused examples are co-located with the source and docs:

- **Storybook stories** — see [`stories/`](../stories) for live previews of
  the default component library and the [`storyHtml`](../docs/guide/storybook.md)
  helpers.
- **Tests as examples** — the [`tests/`](../tests) suite exercises every
  public module against `happy-dom`; they are the most up-to-date,
  copy-paste-ready usage references for individual APIs.
- **Guide cookbook** — the [Examples & Recipes](../docs/guide/examples.md)
  page collects short, self-contained snippets (counters, todo lists,
  modals, infinite scroll, file uploads, and more).
- **Step-by-step tutorial** — the [Tutorial](../docs/guide/tutorial.md)
  walks through building a complete bQuery app from zero, exercising
  Core, Reactive, View, Store, Forms, Router, Component, Motion,
  Platform, A11y, and Testing.

If you'd like to contribute a new runnable example, follow the existing
folder layout (one runtime per directory, shared application in
`shared/`) and update this README so each example has a clear "how to
run" command.
