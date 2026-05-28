# Server

::: tip What's new in 1.14.0
The server module gained `ServerHttpError`, expanded `ctx` helpers (`ctx.body`, `ctx.cookies`, `ctx.setCookie`, `ctx.accepts`, `ctx.stream`, `ctx.sse`, `ctx.renderStream`, `ctx.renderResponse`), and `app.listen()` in 1.14.0. Cookies now validate header-safe characters and body parsing enforces size limits by streamed byte count *before* decoding JSON / form / multipart / text bodies. See the [1.14.0 release notes](/release-notes/1.14#additive-module-expansions).
:::

The server module adds a lightweight, Express-inspired backend layer to bQuery without introducing runtime dependencies. It focuses on the smallest useful primitives for request pipelines: middleware, route params, query parsing, safe response helpers, direct SSR rendering, and runtime-agnostic WebSocket session routing.

```ts
import { ServerHttpError, badRequest, createServer } from '@bquery/bquery/server';
```

---

## Public surface

Runtime helpers:

| Export                                  | Purpose                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `createServer()`                        | Create an app-like server handle with middleware, HTTP routes, SSR responses, and WebSocket routing. |
| `ServerHttpError` / `badRequest()` etc. | Structured HTTP errors for reusable status-aware failures.                                           |
| `isWebSocketRequest(request)`           | Check whether a `Request` is a valid WebSocket upgrade handshake.                                    |
| `isServerWebSocketSession(value)`       | Narrow the result of `handleWebSocket()` to a runtime-agnostic session descriptor.                   |

Commonly used types:

| Type                        | Purpose                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `ServerApp`                 | The app handle returned by `createServer()`.                                            |
| `ServerContext`             | Per-request context passed to handlers and middleware.                                  |
| `ServerRoute`               | Route definition accepted by `app.add()`.                                               |
| `ServerRequestInit`         | Lightweight request input accepted by `handle()` and `handleWebSocket()`.               |
| `ServerResult`              | Result union for WebSocket resolution: `Response`, `ServerWebSocketSession`, or `null`. |
| `ServerWebSocketSession`    | Runtime-agnostic session object returned for matched WebSocket upgrades.                |
| `ServerWebSocketPeer`       | Minimal runtime socket shape consumed by a session.                                     |
| `ServerWebSocketConnection` | Wrapped peer passed to WebSocket handlers, including `sendJson()`.                      |
| `ServerWebSocketHandlerSet` | WebSocket lifecycle callbacks and handshake metadata.                                   |
| `ServerWebSocketMiddleware` | Middleware shape for WebSocket route pipelines.                                         |
| `ServerWebSocketData`       | Raw payload union accepted by `socket.send(...)`.                                       |

```ts
import type { ServerContext, ServerWebSocketSession } from '@bquery/bquery/server';
```

---

## `createServer()`

Creates an app-like request handler with `use()`, `get()`, `post()`, `put()`, `patch()`, `delete()`, `all()`, `add()`, `ws()`, `handle()`, and `handleWebSocket()`.

Recent additions:

- `app.listen()` for runtime-native listeners on supported runtimes
- `ctx.body()` for content-type-aware body parsing
- `ctx.cookies` and `ctx.setCookie()`
- `ctx.stream()`, `ctx.sse()`, `ctx.renderStream()`, and `ctx.renderResponse()`
- structured `ServerHttpError` helpers

```ts
const app = createServer();
```

### Basic usage

```ts
const app = createServer();

app.use(async (ctx, next) => {
  ctx.state.startedAt = Date.now();
  return await next();
});

app.get('/health', (ctx) => ctx.json({ ok: true }));

app.get('/users/:id', (ctx) =>
  ctx.json({
    id: ctx.params.id,
    include: ctx.query.include,
  })
);

const response = await app.handle('/users/42?include=roles&include=teams');
```

---

## Context helpers

Each handler receives a `ServerContext` with:

- `request` — normalized `Request`
- `url` — parsed `URL` for the current request
- `path` — normalized pathname without query string
- `method` — uppercase HTTP method
- `params` — null-prototype route params captured from `:param` segments
- `query` — null-prototype query params (`string` or `string[]` for repeated keys)
- `state` — mutable per-request bag for middleware coordination
- `cookies` — parsed request cookies
- `isWebSocketRequest` — `true` for upgrade handshakes
- `body()` — parse JSON, urlencoded form, multipart form-data, text, or raw buffers
- `accepts(types)` — returns the first matching accepted media type
- `setCookie(name, value, options?)` — appends `Set-Cookie`

Response helpers:

- `ctx.response(body, init?)`
- `ctx.text(body, init?)`
- `ctx.html(body, init?)` — sanitizes by default
- `ctx.json(data, init?)`
- `ctx.stream(stream, init?)`
- `ctx.sse(source, init?)`
- `ctx.redirect(location, status?)`
- `ctx.render(template, data, options?)` — wraps `renderToString()` with the same DOM-free fallback used by `@bquery/bquery/ssr`
- `ctx.renderStream(template, data, options?)`
- `ctx.renderResponse(template, data, options?)`

`params` and `query` are created as null-prototype dictionaries and reserved keys such as `__proto__`, `constructor`, and `prototype` are rejected or ignored to keep request-derived data isolated from object prototypes.

Repeated query values are preserved as arrays:

```ts
app.get('/search', (ctx) =>
  ctx.json({
    tags: ctx.query.tag,
  })
);

await app.handle('/search?tag=docs&tag=server');
// => { "tags": ["docs", "server"] }
```

### Body parsing and cookies

```ts
app.post('/profile', async (ctx) => {
  const body = (await ctx.body()) as { name: string };
  ctx.setCookie('seen-profile', '1', { httpOnly: true, path: '/' });
  return ctx.json({ name: body.name, theme: ctx.cookies.theme });
});
```

### Streaming and SSE helpers

```ts
app.get('/events', (ctx) =>
  ctx.sse([
    { event: 'ready', data: 'connected' },
    { event: 'message', data: 'hello' },
  ])
);

app.get('/stream', (ctx) =>
  ctx.renderStream('<main><h1 bq-text="title"></h1></main>', { title: 'Streamed' })
);
```

---

## Middleware and error handling

Global middleware registered with `app.use()` runs before route-scoped middleware. Both can share per-request values through `ctx.state` and can short-circuit the pipeline by returning a `Response` instead of calling `next()`.

```ts
const app = createServer({
  middlewares: [
    async (ctx, next) => {
      ctx.state.requestId = ctx.request.headers.get('x-request-id') ?? 'local';
      return await next();
    },
  ],
  notFound: (ctx) => ctx.json({ message: 'Not Found' }, { status: 404 }),
  onError(error, ctx) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ctx.json({ message }, { status: 500 });
  },
});
```

You can also throw `ServerHttpError` (or helpers such as `badRequest()`) to return a status-aware response through the default error handler:

```ts
app.get('/input', () => {
  throw badRequest('Missing required query parameter.');
});
```

Route-scoped middleware is passed as the third argument to method helpers or through `ServerRoute.middlewares` when using `app.add()`:

```ts
const requireUser = async (ctx, next) => {
  if (!ctx.request.headers.has('authorization')) {
    return ctx.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return await next();
};

app.get('/admin', (ctx) => ctx.json({ requestId: ctx.state.requestId }), [requireUser]);
```

`createServer()` also accepts `baseUrl` for resolving relative inputs passed to `handle()` and `handleWebSocket()`. This keeps tests and zero-build examples ergonomic while still normalizing every request to a standard Web `Request` internally.

---

## WebSocket routes

Register WebSocket endpoints with `app.ws(path, handlerSetOrFactory, middlewares?)`.

`handleWebSocket()` resolves upgrade requests into a runtime-agnostic session object:

- `null` — request is not a WebSocket handshake or no WebSocket route matched
- `Response` — middleware or error handling short-circuited the upgrade
- `ServerWebSocketSession` — ready to attach to your runtime socket

```ts
import { createServer, isServerWebSocketSession, isWebSocketRequest } from '@bquery/bquery/server';

const app = createServer();

app.ws('/chat/:room', (ctx) => ({
  protocols: ['chat'],
  onOpen(socket) {
    socket.sendJson({ type: 'ready', room: ctx.params.room });
  },
  onMessage(message, socket) {
    socket.sendJson({ type: 'echo', message });
  },
}));

export default async function handler(request: Request) {
  if (isWebSocketRequest(request)) {
    const result = await app.handleWebSocket(request);

    if (result instanceof Response || result === null) {
      return result ?? new Response('Not Found', { status: 404 });
    }

    if (isServerWebSocketSession(result)) {
      const { socket, response } = Deno.upgradeWebSocket(request, {
        protocol: result.protocols[0],
      });

      socket.onopen = () => {
        void result.open(socket);
      };
      socket.onmessage = (event) => {
        void result.message(socket, event);
      };
      socket.onclose = (event) => {
        void result.close(socket, event);
      };
      socket.onerror = (event) => {
        void result.error(socket, event);
      };

      return response;
    }
  }

  return app.handle(request);
}
```

Use `socket.send(...)` for raw frames or `socket.sendJson(...)` for JSON payloads. Incoming string frames are parsed with `JSON.parse()` by default and fall back to the raw string when parsing fails; provide `deserialize(event)` on the route to override that behavior.

Middleware still runs for WebSocket routes, so auth, logging, and per-request state can be shared between HTTP and upgrade flows. Middleware may also short-circuit a WebSocket request by returning a normal `Response`.

HTTP middleware registered with `app.use()` is adapted for WebSocket routes. If it calls `next()`, the WebSocket route can continue resolving to a session; if it returns a `Response`, the upgrade is blocked before any socket lifecycle callback runs.

---

## SSR-aware responses

Use `ctx.render()` when you want to return bQuery SSR markup directly from the backend layer.

```ts
app.get('/dashboard', (ctx) =>
  ctx.render(
    '<main><h1 bq-text="title"></h1></main>',
    { title: 'Dashboard' },
    {
      includeStoreState: true,
    }
  )
);
```

`ctx.render()` appends serialized store state when `includeStoreState` is enabled, so the response can be sent directly to the client.

`ctx.render()` uses the existing SSR `renderToString()` implementation and inherits its `1.11.0` DOM-free fallback. Plain Node.js ≥ 24, Deno, and Bun can therefore render without installing a DOM shim unless you explicitly force the DOM backend via `configureSSR({ backend: 'dom' })`.

If you need head injection, asset management, caching headers, or ETag handling, pair `createServer()` with `renderToResponse()` directly:

```ts
import { createServer } from '@bquery/bquery/server';
import { createSSRContext, renderToResponse } from '@bquery/bquery/ssr';

const app = createServer();

app.get('/', (ctx) => {
  const ssr = createSSRContext({ request: ctx.request });
  ssr.head.add({ title: 'Home' });
  ssr.assets.module('/client.js');

  return renderToResponse(
    '<html><head></head><body><main><h1 bq-text="title"></h1></main></body></html>',
    { title: 'Home' },
    { context: ssr, etag: true, cacheControl: 'public, max-age=60' }
  );
});
```

---

## Security defaults

- `ctx.html()` sanitizes markup by default using bQuery's HTML sanitizer.
- `ctx.json()` escapes unsafe HTML-significant characters so JSON can be embedded more safely.
- `ctx.render()` trusts `renderToString()` output, preserving SSR HTML and optional serialized store-state script tags.

If you already have trusted HTML and need to skip sanitization, pass `{ trusted: true }` to `ctx.html()`.

Unlike `ctx.render()`, `ctx.html()` sanitization still relies on DOM-compatible globals. If your Node runtime does not provide `document` / `DOMParser`, install and register a compatible implementation before returning sanitized HTML, or pass `{ trusted: true }` only when the HTML is already known to be safe.

Register the DOM shim once during application startup before handling any requests that call `ctx.html()` without `{ trusted: true }`.

For example, install `happy-dom` separately (`bun add happy-dom` / `npm install happy-dom`) and register it like this, or use another compatible DOM implementation.

```ts
import { Window } from 'happy-dom';

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;
```

<!-- uniform-template-footer -->

## Body parsing, cookies, and streaming (1.14.0 deep-dive)

```ts
import { createServer, badRequest } from '@bquery/bquery/server';

const app = createServer({
  limits: {
    json: 5_000_000,
  },
});

// JSON, form, multipart, or text — auto-detected from Content-Type
app.post('/upload', async (ctx) => {
  const body = await ctx.body();
  if (!body || typeof body !== 'object') {
    throw badRequest('Expected a JSON body.');
  }
  return ctx.json({ received: Object.keys(body).length });
});

// Cookies are header-safe; reserved keys are rejected
app.get('/me', (ctx) => {
  const session = ctx.cookies.session;
  ctx.setCookie('seen', '1', { httpOnly: true, sameSite: 'Strict', path: '/' });
  return ctx.json({ session });
});

// Streaming with manual chunks
app.get('/log', (ctx) =>
  ctx.stream(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('start\n'));
        setTimeout(() => {
          controller.enqueue(encoder.encode('mid\n'));
          controller.enqueue(encoder.encode('end\n'));
          controller.close();
        }, 50);
      },
    }),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } }
  )
);

// Server-Sent Events
app.get('/events', (ctx) =>
  ctx.sse(async function* () {
    yield { event: 'ready', data: 'connected' };
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 100));
      yield { event: 'tick', data: String(i) };
    }
  })
);
```

## Listening on a runtime

`app.listen()` (1.14.0) starts a runtime-native listener when available:

```ts
// Node 24+
await app.listen({ port: 3000 });

// Bun
Bun.serve({ port: 3000, fetch: app.handle });

// Deno
Deno.serve({ port: 3000 }, app.handle);
```

When `app.listen()` is unavailable (e.g. edge), use `handle()` / `handleWebSocket()` directly from your runtime's request handler.

## Error handling

- Throw `ServerHttpError` (or `badRequest()`, `notFound()`, `unauthorized()`, `forbidden()`, …) to return a status-aware response.
- Define `onError(error, ctx)` on `createServer()` for a default mapper.
- Route-level middleware can short-circuit by returning a `Response` instead of calling `next()`.

## Pitfalls and gotchas

- `params` and `query` are null-prototype dicts — do not rely on inherited methods (`hasOwnProperty`, etc.).
- Configure `createServer({ limits })` to enforce body size limits *before* JSON / form parsing to defend against billion-laughs-style attacks.
- `ctx.setCookie()` validates header-safe characters and rejects malformed values.
- `ctx.html()` sanitizes by default; pass `{ sanitize: false }` only with fully trusted content.
- WebSocket sessions returned by `handleWebSocket()` are runtime-agnostic — you must adapt them to your runtime's socket via `result.open(socket)` / `result.message(socket, event)` / `result.close(socket, event)`.

## Performance notes

- Reuse one `createServer()` instance per process; route registration is O(1) lookup after a one-time compile.
- For high-throughput endpoints, prefer `ctx.json` over `ctx.render*` and cache server-rendered HTML via `createSSRCache()`.
- Stream large responses with `ctx.stream` rather than buffering.

## Testing this module

- `tests/server.test.ts` covers routing, middleware, body parsing, cookies, SSE, and WebSocket session resolution.
- `app.handle(input)` accepts a `string`, `URL`, or `Request` — ideal for `bun:test` cases.

## Deployment targets

| Runtime  | Recommended entry                                       | Notes                                          |
| -------- | ------------------------------------------------------- | ---------------------------------------------- |
| Node 24+ | `app.listen({ port })`                                  | Native HTTP server via `node:http`.            |
| Bun      | `Bun.serve({ fetch: app.handle })`                      | First-class WebSocket upgrade via `Bun.serve`. |
| Deno     | `Deno.serve(app.handle)`                                | Use `Deno.upgradeWebSocket` to adopt sessions. |
| Edge     | `createEdgeHandler(handler)` from `@bquery/bquery/ssr`  | Streams responses without persistent sockets.  |
| Workers  | `app.handle` from a fetch handler                       | WebSocket support depends on runtime APIs.     |

## Related modules

- [SSR](./ssr) — `ctx.render*` wraps `renderToString*` / `renderToResponse`.
- [Reactive](./reactive) — `useWebSocketChannel` consumes server sessions.
- [Security](./security) — default-sanitized `ctx.html()`.
- [Store](./store) — hydrate server state on the client.

## Version history

- **1.14.0** — `ServerHttpError`, `ctx.body`, `ctx.cookies`, `ctx.setCookie`, `ctx.accepts`, `ctx.stream`, `ctx.sse`, `ctx.renderStream`, `ctx.renderResponse`, `app.listen()`.
- **1.11.0** — `createServer`, runtime-agnostic WebSocket sessions, dependency-free routing.
