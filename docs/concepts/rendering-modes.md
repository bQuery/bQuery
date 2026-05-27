# Rendering Modes

bQuery.js supports four rendering modes from the same codebase. This page summarises each one and when to choose it. The implementations live in the [SSR module](/guide/ssr) and the [Server module](/guide/server).

## CSR — Client-Side Rendering

The page ships an empty (or near-empty) shell. JavaScript builds the DOM in the browser.

**Pros**: Simplest to deploy (static host or CDN). No server runtime required for rendering.
**Cons**: Slower First Contentful Paint, hostile to SEO without prerendering, requires JS to display content.

Use when: dashboards behind auth, embedded widgets, internal tools, prototypes.

```ts
import { $, signal, effect } from '@bquery/bquery';

const count = signal(0);
effect(() => $('#counter').text(`Count: ${count.value}`));
```

## SSR — Server-Side Rendering (sync)

`renderToStringAsync()` renders the application to an HTML string on the server, including any signal state and any awaited async data. The browser receives a fully rendered HTML document and hydrates it.

**Pros**: Fast First Contentful Paint, SEO-friendly, works without JS for non-interactive content.
**Cons**: Requires a runtime that can run JavaScript (Node, Bun, Deno, or edge).

Use when: marketing pages, content sites, e-commerce, anything that needs SEO or fast first paint.

```ts
import { createServer } from '@bquery/bquery/server';

const app = createServer();
app.get('/', (ctx) =>
  ctx.renderResponse(`<h1 bq-text="title"></h1>`, { title: 'Hello' })
);
await app.listen({ port: 3000 });
```

## Streaming SSR

`renderToStream()` flushes the page in chunks as they're ready. Combined with [`flushBoundary`](/guide/ssr), slow async data does not block the rest of the document.

**Pros**: Time-to-First-Byte stays low even when individual sections are slow.
**Cons**: More moving parts; intermediate proxies / CDNs must support streaming.

Use when: pages with mixed fast/slow data fetches; user-facing pages where TTFB matters.

```ts
import { flushBoundary } from '@bquery/bquery/ssr';

const template = `
  <header bq-text="title"></header>
  ${flushBoundary()}
  <main bq-html-safe="bodyHtml"></main>
  ${flushBoundary()}
  <footer bq-text="footer"></footer>
`;

app.get('/article', (ctx) =>
  ctx.renderStream(template, { title: '…', bodyHtml: '…', footer: '…' })
);
```

## Resumable hydration

`createResumableState()` serialises just enough server state for the client to *resume* execution without re-running setup. The client takes over the existing DOM and reactive graph without rebuilding it.

**Pros**: Minimal JS executed at hydration; ideal for content-heavy pages.
**Cons**: Newer model; not every app pattern benefits.

Use when: large content pages with localized interactivity (article + comments, product + reviews).

## Choosing a mode

| Need                                            | Recommended mode               |
| ----------------------------------------------- | ------------------------------ |
| SEO + fast first paint                          | SSR or Streaming SSR           |
| Mixed fast/slow data on one page                | Streaming SSR                  |
| Mostly content with small interactive islands   | Resumable hydration            |
| Behind auth, no SEO need                        | CSR                            |
| Embeddable widget                               | CSR (or pre-rendered HTML)     |

You can mix modes per route in the same app — `createServer()` lets each route decide how it renders.

## Hydration vs no-hydration

By default, SSR output ships with a hydration script that wires up signals and event listeners. For pages that are truly static (a privacy page, an about page), you can return the rendered HTML as-is without shipping a hydration bundle to the client — see [SSR](/guide/ssr) for the available render APIs and asset wiring.

## SSR cache

`createSSRCache()` lets you cache full responses or fragments keyed by URL, headers, or any custom key. The cache key is computed deterministically; the `Vary` header is merged correctly (see the [SSR module guide](/guide/ssr) for wildcard `Vary: *` semantics).

## See also

- [SSR module guide](/guide/ssr) — full API, adapters, snapshots, resumability
- [Server module guide](/guide/server) — request handlers, body parsing, streaming, SSE
- [Workflows — SSR + hydration](/workflows/) — end-to-end examples on Node / Bun / Deno
- [Supported Runtimes](/concepts/runtimes)
