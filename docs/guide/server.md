# Server

The server module adds a lightweight, Express-inspired backend layer to bQuery without introducing runtime dependencies. It focuses on the smallest useful primitives for request pipelines: middleware, route params, query parsing, safe response helpers, direct SSR rendering, and runtime-agnostic WebSocket session routing.

```ts
import { createServer } from '@bquery/bquery/server';
```

---

## `createServer()`

Creates an app-like request handler with `use()`, `get()`, `post()`, `put()`, `patch()`, `delete()`, `all()`, `add()`, `ws()`, `handle()`, and `handleWebSocket()`.

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
- `url` / `path` / `method`
- `params` — values captured from `:param` segments
- `query` — parsed query params (`string` or `string[]` for repeated keys)
- `state` — mutable per-request bag for middleware coordination
- `isWebSocketRequest` — `true` for upgrade handshakes

Response helpers:

- `ctx.response(body, init?)`
- `ctx.text(body, init?)`
- `ctx.html(body, init?)` — sanitizes by default
- `ctx.json(data, init?)`
- `ctx.redirect(location, status?)`
- `ctx.render(template, data, options?)` — wraps `renderToString()`

---

## WebSocket routes

Register WebSocket endpoints with `app.ws(path, handlerSetOrFactory, middlewares?)`.

`handleWebSocket()` resolves upgrade requests into a runtime-agnostic session object:

- `null` — request is not a WebSocket handshake or no WebSocket route matched
- `Response` — middleware or error handling short-circuited the upgrade
- `ServerWebSocketSession` — ready to attach to your runtime socket

```ts
import {
  createServer,
  isServerWebSocketSession,
  isWebSocketRequest,
} from '@bquery/bquery/server';

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

---

## SSR-aware responses

Use `ctx.render()` when you want to return bQuery SSR markup directly from the backend layer.

```ts
app.get('/dashboard', (ctx) =>
  ctx.render('<main><h1 bq-text="title"></h1></main>', { title: 'Dashboard' }, {
    includeStoreState: true,
  })
);
```

`ctx.render()` appends serialized store state when `includeStoreState` is enabled, so the response can be sent directly to the client.

`ctx.render()` uses the existing SSR `renderToString()` implementation. If your backend runtime does not provide a global `DOMParser` (for example plain Node.js without a DOM-compatible layer), install and register a compatible implementation such as `happy-dom` before calling SSR helpers.

---

## Security defaults

- `ctx.html()` sanitizes markup by default using bQuery's HTML sanitizer.
- `ctx.json()` escapes unsafe HTML-significant characters so JSON can be embedded more safely.
- `ctx.render()` trusts `renderToString()` output, preserving SSR HTML and optional serialized store-state script tags.

If you already have trusted HTML and need to skip sanitization, pass `{ trusted: true }` to `ctx.html()`.

Like SSR rendering, `ctx.html()` sanitization relies on DOM-compatible globals. If your Node runtime does not provide `document` / `DOMParser`, install and register a compatible implementation before returning sanitized HTML, or pass `{ trusted: true }` only when the HTML is already known to be safe.

Register the DOM shim once during application startup before handling any requests that call `ctx.html()` without `{ trusted: true }` or use `ctx.render()`.

For example, install `happy-dom` separately (`bun add happy-dom` / `npm install happy-dom`) and register it like this, or use another compatible DOM implementation.

```ts
import { Window } from 'happy-dom';

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;
```
