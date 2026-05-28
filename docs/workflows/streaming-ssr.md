# Streaming SSR with `flushBoundary` and `createSSRCache`

For data-heavy pages, `flushBoundary()` lets you split the final SSR HTML into multiple stream chunks once rendering completes. This workflow combines [`flushBoundary`](/guide/ssr#streaming-and-caching-1-14-0), [`createSSRCache`](/guide/ssr#streaming-and-caching-1-14-0), and [`createSSRMetrics`](/guide/ssr#streaming-and-caching-1-14-0); use `renderToStreamSuspense()` with `defer()` when you need true progressive async streaming.

## Goal

- Split the page shell, `recommended`, and `comments` into separate HTML chunks.
- Cache the shell for 30 s, leave dynamic sections uncached.
- Expose render / slot timing metrics to a metrics endpoint.

## 1. Template with flush points

```ts
const template = `
  <main>
    <header>
      <h1 bq-text="title"></h1>
    </header>
    <!-- flush after the hero -->
    <!--@flush:hero-->

    <section bq-html-safe="recommendedHtml"></section>
    <!--@flush:recommended-->

    <section bq-html-safe="commentsHtml"></section>
  </main>
`;
```

Replace the `<!--@flush:*-->` markers at build time with `flushBoundary()` calls so the SSR pipeline knows where to chunk. `flushBoundary()` takes no arguments — it returns a constant marker string that `renderToStream()` splits on:

```ts
import { flushBoundary } from '@bquery/bquery/ssr';

const compiled = template
  .replace('<!--@flush:hero-->', flushBoundary())
  .replace('<!--@flush:recommended-->', flushBoundary());
```

## 2. Cache + metrics

```ts
import { createSSRCache, createSSRMetrics } from '@bquery/bquery/ssr';

export const cache = createSSRCache({ ttlMs: 30_000, maxEntries: 1024 });
export const metrics = createSSRMetrics();
```

`metrics` is an imperative collector — call `metrics.snapshot()` to read `{ renderCount, totalRenderMs, slotCount, totalSlotMs, hydrationMismatches }` and expose it via `/_metrics`.

## 3. Server pipeline

```ts
import { createServer } from '@bquery/bquery/server';
import { createSSRContext, renderToStream } from '@bquery/bquery/ssr';

const app = createServer();

app.get('/articles/:slug', async (ctx) => {
  const slug = ctx.params.slug;
  const data = {
    title: await getTitle(slug),
    recommendedHtml: await getRecommended(slug),
    commentsHtml: await getComments(slug),
  };

  // Streaming path: build an SSR context with the metrics collector so the
  // chunks emitted by `renderToStream()` record render/slot timings.
  const context = createSSRContext({ request: ctx.request, metrics });
  const stream = renderToStream(compiled, data, { context });

  return ctx.stream(stream, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
});

// Response-cached (non-streaming) variant — caching lives on `renderToResponse`.
app.get('/articles/:slug/static', async (ctx) => {
  const data = { title: await getTitle(ctx.params.slug) };
  return ctx.renderResponse(compiled, data, {
    cache: { store: cache, vary: ['accept-language'] },
  });
});

app.get('/_metrics', (ctx) => ctx.json(metrics.snapshot()));

await app.listen({ port: 3000 });
```

## How chunks land in the browser

1. The hero (everything before the first `flushBoundary()`) becomes the first chunk in the response stream.
2. The recommended block becomes the next chunk.
3. The comments block becomes the final chunk.

Note that `renderToStream()` currently resolves the full binding context and renders every chunk before enqueueing them, so flush boundaries control how the final HTML is chunked on the stream, not time-to-first-byte or when async sections become available. Use `renderToStreamSuspense()` with `defer()` for true progressive/out-of-order streaming.

The browser still receives distinct chunks on the response stream, but the boundaries do not let slow async sections render ahead of the rest of the document.

## Edge variant

For edge runtimes use [`createEdgeHandler`](/guide/ssr#streaming-and-caching-1-14-0). It wraps a fetch-style handler — cache/metrics wiring lives inside the handler:

```ts
import { createEdgeHandler, createSSRContext, renderToResponse } from '@bquery/bquery/ssr';

export default createEdgeHandler(async (request) => {
  const context = createSSRContext({ request, metrics });
  const data = {
    /* …resolve data from the request… */
  };
  return renderToResponse(compiled, data, {
    context,
    cache: { store: cache, vary: ['accept-language'] },
  });
});
```

The handler is a plain `(request: Request) => Promise<Response>` and works on Cloudflare Workers, Vercel Edge, Deno Deploy, and Bun edge runtimes.

## Pitfalls

- Cache keys default to the request URL plus `cache.vary` headers; supply `createSSRCache({ getKey })` for custom keying (e.g. per-user or per-locale variance) so you don't leak personalized content.
- Do not put per-user data inside cached sections — split them with a flush boundary instead.
- `metrics.snapshot().totalRenderMs` reports time spent rendering, not total request time.

## Next steps

- Combine with the [Backend API + WebSocket workflow](./backend-api) to keep cached pages live via push updates.
- Add [Devtools timeline events](/guide/devtools) for `render:start` / `render:flush` to debug slow chunks.
