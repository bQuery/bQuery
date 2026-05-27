# Streaming SSR with `flushBoundary` and `createSSRCache`

For data-heavy pages, streaming the above-the-fold HTML immediately and progressively flushing slower sections keeps Largest Contentful Paint low. This workflow combines [`flushBoundary`](/guide/ssr#streaming-and-caching-1-14-0), [`createSSRCache`](/guide/ssr#streaming-and-caching-1-14-0), and [`createSSRMetrics`](/guide/ssr#streaming-and-caching-1-14-0).

## Goal

- Stream the page shell instantly.
- Defer heavy sections (`recommended`, `comments`) until their async data resolves.
- Cache the shell for 30 s, leave dynamic sections uncached.
- Expose hit / miss counters to a metrics endpoint.

## 1. Template with flush points

```ts
const template = `
  <main>
    <header>
      <h1 bq-text="title"></h1>
    </header>
    ${'/* flush after the hero */'}
    <!--@flush:hero-->

    <section bq-html-safe="recommendedHtml"></section>
    <!--@flush:recommended-->

    <section bq-html-safe="commentsHtml"></section>
  </main>
`;
```

Replace the `<!--@flush:*-->` markers at build time with `flushBoundary()` calls so the SSR pipeline knows where to chunk:

```ts
import { flushBoundary } from '@bquery/bquery/ssr';

const compiled = template
  .replace('<!--@flush:hero-->', flushBoundary('hero'))
  .replace('<!--@flush:recommended-->', flushBoundary('recommended'));
```

## 2. Cache + metrics

```ts
import { createSSRCache, createSSRMetrics } from '@bquery/bquery/ssr';

export const cache = createSSRCache({ ttl: 30_000, max: 1024 });
export const metrics = createSSRMetrics();
```

`metrics` exposes signals (`hits`, `misses`, `renderMs`) you can surface via `/_metrics`.

## 3. Server pipeline

```ts
import { createServer } from '@bquery/bquery/server';
import { renderToStream } from '@bquery/bquery/ssr';

const app = createServer();

app.get('/articles/:slug', async (ctx) => {
  const slug = ctx.params.slug;
  const data = {
    title: await getTitle(slug),
    recommendedHtml: getRecommended(slug),  // returns a Promise<string>
    commentsHtml: getComments(slug),         // returns a Promise<string>
  };

  const stream = renderToStream(compiled, data, {
    cache,
    metrics,
    key: `article:${slug}`,
  });

  return ctx.stream(stream, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
});

app.get('/_metrics', (ctx) =>
  ctx.json({
    hits: metrics.hits.value,
    misses: metrics.misses.value,
    avgRenderMs: metrics.renderMs.value,
  })
);

await app.listen({ port: 3000 });
```

## How chunks land in the browser

1. The hero (everything before `flushBoundary('hero')`) ships instantly — usually < 50 ms after the request hits the server.
2. The recommended block streams once `recommendedHtml` resolves.
3. The comments block flushes last.

The browser progressively renders each chunk, so the user sees content as soon as it is available rather than waiting for the slowest section.

## Edge variant

For edge runtimes use [`createEdgeHandler`](/guide/ssr#streaming-and-caching-1-14-0):

```ts
import { createEdgeHandler } from '@bquery/bquery/ssr';

export default createEdgeHandler(compiled, { cache, metrics });
```

The handler is a plain `(request: Request) => Promise<Response>` and works on Cloudflare Workers, Vercel Edge, Deno Deploy, and Bun edge runtimes.

## Pitfalls

- Cache keys default to URL; add user/locale variance via `{ key }` to avoid leaking personalized content.
- Do not put per-user data inside cached sections — split them with a flush boundary instead.
- `metrics.renderMs.value` reports time spent rendering, not total request time.

## Next steps

- Combine with the [Backend API + WebSocket workflow](./backend-api) to keep cached pages live via push updates.
- Add [Devtools timeline events](/guide/devtools) for `render:start` / `render:flush` to debug slow chunks.
