# Server

::: tip What's new in 1.15.0
The server module gained first-party **session**, **CSRF**, **guard**, and **auth** primitives (`session`, `memoryStore`, `csrf`, `csrfToken`, `guard`, `basicAuth`, `bearerAuth`) plus the Web-Crypto signing utilities they build on (`signValue`, `unsignValue`, `timingSafeEqual`, `randomToken`, `randomId`). `app.listen()` now also supports Deno. With these, `server` **graduated to Stable in 1.15.0** — see [Stability](#stability).
:::

::: tip What's new in 1.14.0
The server module gained `ServerHttpError`, expanded `ctx` helpers (`ctx.body`, `ctx.cookies`, `ctx.setCookie`, `ctx.accepts`, `ctx.stream`, `ctx.sse`, `ctx.renderStream`, `ctx.renderResponse`), and `app.listen()` in 1.14.0. Cookies now validate header-safe characters and body parsing enforces size limits by streamed byte count _before_ decoding JSON / form / multipart / text bodies. See the [1.14.0 release notes](/release-notes/1.14#additive-module-expansions).
:::

The server module adds a lightweight, Express-inspired backend layer to bQuery without introducing runtime dependencies. It focuses on the smallest useful primitives for request pipelines: middleware, route params, query parsing, safe response helpers, direct SSR rendering, runtime-agnostic WebSocket session routing, and — as of 1.15.0 — request-scoped sessions, CSRF protection, route guards, and authentication helpers.

```ts
import {
  ServerHttpError,
  badRequest,
  basicAuth,
  bearerAuth,
  createServer,
  csrf,
  csrfToken,
  guard,
  memoryStore,
  session,
} from '@bquery/bquery/server';
```

---

## Stability

`server` was introduced in 1.11.0 and expanded materially in 1.14.0; the work to graduate it is tracked in [#131](https://github.com/bQuery/bQuery/issues/131), and its session/middleware prerequisite [#132](https://github.com/bQuery/bQuery/issues/132) is resolved (see [Sessions, CSRF, guards, and auth](#sessions-csrf-guards-and-auth)). It **graduated to Stable in 1.15.0**, with the `ctx`/`app` surface frozen under the no-breaking-changes-between-minors contract.

### Exit criteria

- [x] `ctx`/`app` contract frozen and documented (below). The 1.15.0 session work is additive (`ctx.session` is optional).
- [x] Session + middleware primitives ([#132](https://github.com/bQuery/bQuery/issues/132)) — `session`, `memoryStore`, `csrf`, `guard`, `basicAuth`, `bearerAuth`.
- [x] Test coverage across routing, streaming, SSE, cookies, content negotiation, sessions, CSRF, and auth (`tests/server.test.ts`, `tests/server-stable.test.ts`).
- [x] Per-runtime support matrix published (below).
- [x] File-based routing bridge ([#149](https://github.com/bQuery/bQuery/issues/149)) — shipped in 1.15.0 (`createFileRoutes` + `mountFileRoutes`).
- [x] Public surface frozen (no additive breaking changes) — committed under the Stable contract from 1.15.0.

### Frozen surface

The contract that must not break once Stable:

- **App:** `createServer`, `app.use`, `app.add`, `app.get/post/put/patch/delete/all`, `app.ws`, `app.handle`, `app.handleWebSocket`, `app.listen`.
- **Context:** `ctx.{request,url,method,path,params,query,cookies,state,session,body,response,text,html,json,stream,sse,accepts,setCookie,redirect,render,renderStream,renderResponse,runTask,callWorker,isWebSocketRequest}`.
- **Primitives:** `session`/`memoryStore`, `csrf`/`csrfToken`, `guard`, `basicAuth`/`bearerAuth`, and the signing utilities `signValue`/`unsignValue`/`timingSafeEqual`/`randomToken`/`randomId`.
- **Errors:** `ServerHttpError`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`.

### Per-runtime support matrix

| Capability                          | Node ≥ 24 | Bun | Deno    | Edge    |
| ----------------------------------- | --------- | --- | ------- | ------- |
| `app.handle` (fetch-style request)  | yes       | yes | yes     | yes     |
| `app.listen` (native HTTP listener) | yes       | yes | yes     | n/a     |
| `app.handleWebSocket` sessions      | adapter   | yes | adapter | runtime |
| Signed sessions / CSRF (Web Crypto) | yes       | yes | yes     | yes     |
| SSR responses (`ctx.render*`)       | yes       | yes | yes     | yes     |

Sessions and CSRF rely on the standard `globalThis.crypto.subtle`, available on every targeted runtime. The cross-runtime CI smoke (`tests/cross-runtime/run.mjs`) exercises signing, sessions, and CSRF on Node, Bun, and Deno. On edge runtimes without persistent sockets, use `app.handle` from a fetch handler; WebSocket adoption depends on runtime APIs.

---

## Public surface

Runtime helpers:

| Export                                    | Purpose                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `createServer()`                          | Create an app-like server handle with middleware, HTTP routes, SSR responses, and WebSocket routing. |
| `ServerHttpError` / `badRequest()` etc.   | Structured HTTP errors for reusable status-aware failures.                                           |
| `isWebSocketRequest(request)`             | Check whether a `Request` is a valid WebSocket upgrade handshake.                                    |
| `isServerWebSocketSession(value)`         | Narrow the result of `handleWebSocket()` to a runtime-agnostic session descriptor.                   |
| `session()` / `memoryStore()`             | Signed cookie sessions backed by a pluggable store (1.15.0).                                         |
| `csrf()` / `csrfToken()`                  | Double-submit CSRF protection and per-request token accessor (1.15.0).                               |
| `guard()`                                 | Predicate-based route guard middleware (1.15.0).                                                     |
| `basicAuth()` / `bearerAuth()`            | `Authorization`-header auth helpers with a `verify` hook (1.15.0).                                   |
| `rateLimit()`                             | Fixed-window request throttling with `RateLimit-*` headers and a pluggable store.                    |
| `serveStatic()`                           | Serve files from disk, with ETag/`304`, `Range`, and precompressed sidecars.                         |
| `signValue()` / `unsignValue()`           | HMAC-SHA-256 sign/verify with secret rotation (1.15.0).                                              |
| `timingSafeEqual()`                       | Constant-time string comparison (1.15.0).                                                            |
| `randomToken()` / `randomId()`            | CSPRNG-backed token and id generation (1.15.0).                                                      |
| `base64UrlEncode()` / `base64UrlDecode()` | URL-safe base64 codecs used by the signing helpers (1.15.0).                                         |

Commonly used types:

| Type                                                              | Purpose                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ServerApp`                                                       | The app handle returned by `createServer()`.                                            |
| `ServerContext`                                                   | Per-request context passed to handlers and middleware.                                  |
| `ServerRoute`                                                     | Route definition accepted by `app.add()`.                                               |
| `ServerRequestInit`                                               | Lightweight request input accepted by `handle()` and `handleWebSocket()`.               |
| `ServerResult`                                                    | Result union for WebSocket resolution: `Response`, `ServerWebSocketSession`, or `null`. |
| `ServerWebSocketSession`                                          | Runtime-agnostic session object returned for matched WebSocket upgrades.                |
| `ServerWebSocketPeer`                                             | Minimal runtime socket shape consumed by a session.                                     |
| `ServerWebSocketConnection`                                       | Wrapped peer passed to WebSocket handlers, including `sendJson()`.                      |
| `ServerWebSocketHandlerSet`                                       | WebSocket lifecycle callbacks and handshake metadata.                                   |
| `ServerWebSocketMiddleware`                                       | Middleware shape for WebSocket route pipelines.                                         |
| `ServerWebSocketData`                                             | Raw payload union accepted by `socket.send(...)`.                                       |
| `ServerSession`                                                   | Request-scoped session surface attached to `ctx.session`.                               |
| `SessionStore` / `SessionData`                                    | Pluggable session store contract and its payload shape.                                 |
| `SessionOptions` / `MemoryStoreOptions`                           | Configuration for `session()` and `memoryStore()`.                                      |
| `CsrfOptions`                                                     | Configuration for the `csrf()` middleware.                                              |
| `GuardOptions`                                                    | Configuration for the `guard()` middleware.                                             |
| `BasicAuthOptions` / `BasicAuthCredentials` / `BearerAuthOptions` | Configuration and parsed credentials for the auth helpers.                              |

```ts
import type { ServerContext, ServerSession, ServerWebSocketSession } from '@bquery/bquery/server';
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

## Sessions, CSRF, guards, and auth

As of 1.15.0 the server module ships first-party, secure-by-default primitives for the things every non-trivial service needs. Each is independently importable and tree-shakeable, and none pull a runtime dependency — signing is built on the standard `globalThis.crypto.subtle`.

### Sessions

`session(options)` returns middleware that loads, exposes, and persists a request-scoped session. The session id lives in an **HMAC-signed cookie** (tampered cookies are ignored); the payload lives in a **pluggable store** (default: process-local `memoryStore()`), so the cookie never carries session data.

```ts
import { createServer, session, memoryStore } from '@bquery/bquery/server';

const app = createServer();
app.use(session({ secret: process.env.SECRET!, store: memoryStore() }));

app.post('/login', (ctx) => {
  ctx.session!.userId = 'u_123'; // marks the session dirty → persisted + cookie set
  return ctx.json({ ok: true });
});

app.get('/me', (ctx) => ctx.json({ userId: ctx.session?.userId ?? null }));
```

Read and write payload as plain properties. Lifecycle operations use `$`-prefixed members so they never collide with data keys:

| Member                      | Description                                                 |
| --------------------------- | ----------------------------------------------------------- |
| `ctx.session.$id`           | Current session id, or `null` until first write.            |
| `ctx.session.$isNew`        | `true` when no existing session was loaded.                 |
| `ctx.session.$data`         | Shallow snapshot of the payload.                            |
| `ctx.session.$regenerate()` | Rotate the id, keep the payload (session-fixation defense). |
| `ctx.session.$destroy()`    | Clear the payload and expire the cookie.                    |
| `ctx.session.$clear()`      | Remove every key without destroying the session.            |

Options: `secret` (string or array for rotation), `store`, `cookieName` (`'bq.sid'`), `cookie` (attributes; defaults to `httpOnly`, `sameSite: 'lax'`, `path: '/'` — set `secure: true` in production), `ttlMs` (1 day), `rolling`, and `genId`.

Session changes are persisted (and the cookie issued) when the handler **resolves a response**. If a handler throws, the changes are not persisted — keep session writes on the success path, or write before any operation that may throw.

**Bring your own store** by implementing `SessionStore` — no client is bundled:

```ts
import type { SessionStore } from '@bquery/bquery/server';

const redisStore = (client): SessionStore => ({
  async get(id) {
    const raw = await client.get(`sess:${id}`);
    return raw ? JSON.parse(raw) : null;
  },
  async set(id, data, ttlMs) {
    const payload = JSON.stringify(data);
    if (ttlMs && ttlMs > 0) await client.set(`sess:${id}`, payload, 'PX', ttlMs);
    else await client.set(`sess:${id}`, payload);
  },
  async destroy(id) {
    await client.del(`sess:${id}`);
  },
});
```

### CSRF

`csrf(options)` enforces the OWASP double-submit-cookie pattern. Safe requests (GET/HEAD/OPTIONS) mint a per-client secret cookie and expose the matching token via `csrfToken(ctx)`; state-changing requests must echo that token back in the `x-csrf-token` header (or a `_csrf` body field) or are rejected with `403`. Provide a `secret` to upgrade to **signed** double-submit (defends against sibling-subdomain cookie injection).

```ts
import { createServer, csrf, csrfToken } from '@bquery/bquery/server';

const app = createServer();
app.use(csrf({ secret: process.env.SECRET! }));

app.get('/form', (ctx) =>
  ctx.html(
    `<form method="post"><input type="hidden" name="_csrf" value="${csrfToken(ctx)}"></form>`,
    {
      trusted: true,
    }
  )
);
```

CSRF guards request _integrity_; it composes with the [security module](./security) (`sanitizeHtml()`, Trusted Types), which guards _output_ — use both for defense in depth.

### Guards and auth

`guard(predicate, options?)` allows a request only when `predicate(ctx)` resolves truthy, otherwise it denies with `onDeny` or a `ServerHttpError` (default `403`). `basicAuth` and `bearerAuth` parse the `Authorization` header and delegate the credential check to your `verify` callback, storing the resolved user on `ctx.state.user`.

```ts
import { createServer, guard, bearerAuth } from '@bquery/bquery/server';

const app = createServer();
app.use(bearerAuth({ verify: (token) => verifyJwt(token) }));

const requireUser = guard((ctx) => Boolean(ctx.state.user), { status: 401 });
app.get('/me', (ctx) => ctx.json({ user: ctx.state.user }), [requireUser]);
```

### Rate limiting

`rateLimit()` caps how many requests one key may make per window. Pair it with
the auth helpers above: an unprotected login route is a brute-force target, and
that is exactly where a limit belongs.

```ts
import { createServer, rateLimit, session } from '@bquery/bquery/server';

const app = createServer();
app.use(session({ secret: process.env.SECRET! }));

app.post('/login', handleLogin, [
  rateLimit({
    window: 15 * 60_000,
    max: 5,
    // Behind a proxy, key on the address it reports. A session id is `null`
    // for the cookie-less request a brute-force script sends — and a `null`
    // key skips the limit, so it would protect nothing here.
    trustProxy: true,
    skipSuccessfulRequests: true, // a valid login should not use up the budget
  }),
]);
```

Under the limit, responses carry `RateLimit-Limit`, `RateLimit-Remaining` and
`RateLimit-Reset`. Over it, the request is answered `429 Too Many Requests`
with `Retry-After` — and `Retry-After` is sent even with `headers: false`,
since a client needs something to back off on.

#### Choosing `keyBy`

**`keyBy` is required**, and that is deliberate. The obvious default — the
client's address from `X-Forwarded-For` — is a header the _client_ sets unless
a proxy you control overwrites it. Keying on it without that proxy gives a
limiter an attacker bypasses by sending a different header per request: worse
than no limiter, because it looks like protection.

So pick the identity that is actually meaningful for the route:

| `keyBy`                                                   | Good for                                     |
| --------------------------------------------------------- | -------------------------------------------- |
| `(ctx) => ctx.session?.$id ?? 'anon'`                     | Per-browser limits on session-bearing routes |
| `(ctx) => (ctx.state.user as User)?.id ?? 'anon'`         | Per-account limits after auth                |
| `(ctx) => ctx.request.headers.get('x-api-key') ?? 'anon'` | Per-API-key quotas                           |
| `trustProxy: true` (instead of `keyBy`)                   | Behind a proxy (see below)                   |

::: warning A `null` key fails open
Returning `null` skips the limit **entirely** for that request. Every value in
the table above is `null` for exactly the caller you most want to throttle —
`ctx.session?.$id` before a session exists, `ctx.state.user?.id` before
authentication, a missing `x-api-key` header. Written as
`?? null`, a cookie-less brute-force script gets unlimited attempts.

The `?? 'anon'` fallbacks keep those requests in one counted bucket instead.
That bucket is shared, so size `max` for it accordingly, or use `trustProxy`
behind a proxy to separate callers by address.
:::

#### `trustProxy` and which header it reads

`trustProxy: true` reads the **rightmost** `X-Forwarded-For` entry, and that
header only. The list grows left to right as a request is forwarded, so the
rightmost entry is the address the proxy closest to you observed — and it is
there whether that proxy appends (Cloudflare, and nginx's stock
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`) or overwrites.
Everything further left is whatever the client sent, so keying on the leftmost
entry would leave the limit bypassable by rotating one header.

```ts
rateLimit({ window: 60_000, max: 10, trustProxy: true }); // rightmost XFF hop
rateLimit({ window: 60_000, max: 10, trustProxy: 'cf-connecting-ip' }); // that header, whole
```

`CF-Connecting-IP`, `True-Client-IP` and `X-Real-IP` are **not** read unless
you name one. Reading whichever of them happened to be present would reopen
the same bypass from the other side: a proxy that sets `CF-Connecting-IP` does
not necessarily strip `X-Real-IP`, so a client could pick its own bucket by
sending a header the proxy never writes.

::: warning Name a header only if your proxy sets it on every request
`trustProxy: 'x-real-ip'` is safe when your proxy writes `X-Real-IP` itself,
overwriting whatever arrived. If it merely passes the header through, the
value is client-controlled and the limiter is bypassable. When in doubt,
`trustProxy: true` is the safe choice: the rightmost `X-Forwarded-For` entry
is proxy-written by construction.
:::

Behind a **chain** of proxies the rightmost entry is the inner proxy rather
than the client, so those requests share a bucket. That over-limits rather
than under-limits; a deployment that needs per-client buckets behind a chain
should name the header its edge sets, or pass its own `keyBy`.

A request that reaches the origin without the header — an internal hop, a
proxy misconfigured after a deploy — is counted in a single shared bucket
rather than skipped, so it cannot slip past the limit unnoticed.

::: danger The origin must be reachable only through the proxy
That shared bucket catches requests arriving with **no** forwarding header. It
does nothing about a client that reaches the origin directly and sends one: the
rightmost hop is then the client's own invention, no proxy having appended
anything, so rotating it mints a fresh counter per request and the limit stops
applying.

`trustProxy` is a statement about the network path, not just about the header.
Firewall the origin to the proxy's addresses. An origin port left listening
alongside the CDN is the usual way this is lost — and from the outside the app
still looks protected.
:::

#### Options

| Option                   | Default                 | Notes                                                                                                  |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `window`                 | _(required)_            | Window length in milliseconds.                                                                         |
| `max`                    | _(required)_            | Requests allowed per key per window.                                                                   |
| `keyBy`                  | _(required\*)_          | Identity to count against. `null` skips — see the warning above. \*Or set `trustProxy`.                |
| `trustProxy`             | `false`                 | `true` keys on the rightmost `X-Forwarded-For` hop; a header name keys on that header. See above.      |
| `store`                  | bounded `memoryStore()` | Any `SessionStore`. The default is per process, capped at 10 000 keys.                                 |
| `prefix`                 | `'rl:'`                 | Store-key prefix, so counters cannot collide with sessions.                                            |
| `headers`                | `true`                  | Emit the `RateLimit-*` headers. `Retry-After` is sent either way.                                      |
| `status` / `message`     | `429` / text            | The default rejection response.                                                                        |
| `skip`                   | —                       | Skip a request entirely, without consuming budget.                                                     |
| `onLimit`                | —                       | Handle rejection yourself; the headers are still applied.                                              |
| `skipSuccessfulRequests` | `false`                 | Refund requests that ended 2xx. A 3xx still counts, so a redirect-on-failure login form stays limited. |

::: warning The default store only limits one process
`memoryStore()` is process-local, so with several instances behind a load
balancer each enforces its own count. Pass a shared `SessionStore` — the same
interface sessions use — to make the limit hold across all of them.

The default is bounded at 10 000 keys, because rate-limit keys are
attacker-chosen and usually seen once: an unbounded store would turn the
limiter into a memory-exhaustion vector. For the same reason, do not pass
your _session_ store here — counter churn would evict live sessions.

Within one process the counter is serialized per key, so concurrent requests
cannot all read the same value and slip past the limit. Across processes that
guarantee needs a store with an atomic increment.
:::

The window is **fixed**, not sliding: the first request starts it and the
counter resets wholesale when it ends. That allows a burst of up to `2 × max`
across a window boundary, which is the standard trade-off — a sliding window
needs per-request timestamps in the store, a much larger write cost for a
limiter whose job is to be cheap.

### Signing utilities

The primitives above build on small, cross-runtime Web-Crypto helpers that are also exported for custom token logic: `signValue` / `unsignValue` (HMAC-SHA-256 sign/verify with secret rotation), `timingSafeEqual` (constant-time compare), `randomToken` / `randomId` (CSPRNG ids), and the `base64UrlEncode` / `base64UrlDecode` codecs they use.

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

## Static assets

`serveStatic()` sends files from disk, so an app can deliver its own
`client.js` without a reverse proxy in front of it.

```ts
import { createServer, serveStatic } from '@bquery/bquery/server';

const app = createServer();

app.use(
  serveStatic({
    root: './dist/client',
    prefix: '/assets',
    maxAge: 31_536_000,
    immutable: true, // content-hashed filenames only
    precompressed: true,
  })
);

app.get('/', (ctx) => ctx.render('<div bq-text="title"></div>', { title: 'Home' }));
```

It is middleware, not a route: it answers `GET` and `HEAD` for paths that
resolve to a file under `root`, and calls `next()` for everything else — a
missing file, another method, a path outside `prefix` — so your routes still
see those requests.

### Options

| Option               | Default                      | Notes                                                                                           |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `root`               | _(required)_                 | Directory to serve. Nothing outside it is reachable, symlinks included.                         |
| `prefix`             | `'/'`                        | URL mount point; stripped before resolving against `root`.                                      |
| `maxAge`             | `0`                          | `Cache-Control` max-age in seconds. `0` emits `no-cache`.                                       |
| `immutable`          | `false`                      | Adds `immutable`. Only correct for content-hashed filenames.                                    |
| `index`              | `'index.html'`               | File served for a directory. `false` disables directory indexes.                                |
| `precompressed`      | `false`                      | Serve a `.br`/`.gz` sidecar when the client accepts that encoding (`q=0` is honoured).          |
| `dotfiles`           | `false`                      | Serve dotfiles. Off by default so `.env` is not exposed; a dotted path is skipped, not refused. |
| `contentTypes`       | —                            | Extra or overriding extension → MIME mappings.                                                  |
| `defaultContentType` | `'application/octet-stream'` | Fallback MIME type.                                                                             |

### What it handles for you

- **Caching.** A weak `ETag` from size and mtime, plus `Last-Modified`.
  `If-None-Match` and `If-Modified-Since` are answered with `304`. With
  `precompressed`, every response carries `Vary: Accept-Encoding` and each
  encoding gets its own `ETag`, so a cache cannot hand compressed bytes to a
  client that asked for identity.
- **Ranges.** Single byte ranges — closed, open-ended and suffix — answered
  with `206` and `Content-Range`; out-of-range requests get `416`. Multi-range
  requests fall back to the whole body. Ranges are not offered over a
  precompressed body, since those bytes are not the identity representation
  the client asked to slice.
- **Directory redirects.** `/dir` redirects to `/dir/` with `308`, so relative
  links inside the index resolve.
- **Path traversal.** Rejected with `403`. Paths are decoded and checked
  segment by segment, and the resolved path is re-checked against `root`.
  Encoded traversal (`%2e%2e`), backslash separators and NUL bytes are all
  covered. Symlinks are resolved before serving, so a link inside `root`
  pointing outside it is refused too — build outputs are a realistic place
  for those to appear.
- **Dotfiles and undecodable paths are _not_ traversal.** They are skipped
  with `next()`, not answered `403`, so a root-mounted `serveStatic()` does
  not veto them for the whole app. That keeps `/.well-known/...` — ACME
  HTTP-01 renewal, `security.txt` — answerable by a route, and a URL with a
  stray `%` reaches your catch-all.

::: warning `immutable` is a promise about your filenames
`immutable` tells caches never to revalidate for the whole `maxAge`. That is
only true when the URL changes whenever the content does — content-hashed
build output. On a stable filename like `/assets/app.js`, clients can be stuck
with a stale copy for as long as `maxAge`.
:::

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
- Configure `createServer({ limits })` to enforce body size limits _before_ JSON / form parsing to defend against billion-laughs-style attacks.
- `ctx.setCookie()` validates header-safe characters and rejects malformed values.
- `ctx.html()` sanitizes by default; pass `{ sanitize: false }` only with fully trusted content.
- WebSocket sessions returned by `handleWebSocket()` are runtime-agnostic — you must adapt them to your runtime's socket via `result.open(socket)` / `result.message(socket, event)` / `result.close(socket, event)`.

## Performance notes

- Reuse one `createServer()` instance per process; route registration is O(1) lookup after a one-time compile.
- For high-throughput endpoints, prefer `ctx.json` over `ctx.render*` and cache server-rendered HTML via `createSSRCache()`.
- Stream large responses with `ctx.stream` rather than buffering.

## Testing this module

- `tests/server.test.ts` covers routing, middleware, body parsing, cookies, SSE, and WebSocket session resolution.
- `tests/server-stable.test.ts` covers sessions, CSRF, guards, auth helpers, and the signing utilities.
- `app.handle(input)` accepts a `string`, `URL`, or `Request` — ideal for `bun:test` cases.

## Deployment targets

| Runtime  | Recommended entry                                            | Notes                                                                                 |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Node 24+ | `app.listen({ port })`                                       | Native HTTP server via `node:http`.                                                   |
| Bun      | `app.listen({ port })` or `Bun.serve({ fetch: app.handle })` | First-class WebSocket upgrade via `Bun.serve`.                                        |
| Deno     | `app.listen({ port })` or `Deno.serve(app.handle)`           | `listen()` uses `Deno.serve` (1.15.0). Use `Deno.upgradeWebSocket` to adopt sessions. |
| Edge     | `createEdgeHandler(handler)` from `@bquery/bquery/ssr`       | Streams responses without persistent sockets.                                         |
| Workers  | `app.handle` from a fetch handler                            | WebSocket support depends on runtime APIs.                                            |

## File-route actions

When you adopt the opt-in [file-route convention](./file-routing), the `action`
functions on your `+page` modules become reachable server routes. Pass the
`entries` from `createFileRoutes()` to `mountFileRoutes(app, entries, options?)`
(or `createFileRouteServerRoutes(entries, options?)` for the raw `ServerRoute[]`):

```ts
import { createServer, csrf, mountFileRoutes } from '@bquery/bquery/server';
import { createFileRoutes } from '@bquery/bquery/router';

const { entries } = createFileRoutes(import.meta.glob('./routes/**/+page.ts'));

const app = createServer();
mountFileRoutes(app, entries, {
  middlewares: [csrf()], // mutations are CSRF-guarded
  dataPath: '/__data', // optional: also serve each route's `load` as JSON
});
```

Routes whose module statically exports no `action` are skipped; lazily-imported
routes reply `405` when no `action` is present. The `FileRouteServerOptions`
type documents `actionMethod`, `dataPath`, `basePath`, and the middleware hooks.

## Related modules

- [File-based Routing](./file-routing) — defines the `action` / `load` these endpoints serve.
- [SSR](./ssr) — `ctx.render*` wraps `renderToString*` / `renderToResponse`.
- [Reactive](./reactive) — `useWebSocketChannel` consumes server sessions.
- [Security](./security) — default-sanitized `ctx.html()`.
- [Store](./store) — hydrate server state on the client.

## Version history

- **1.15.0** — first-party `session` / `memoryStore`, `csrf` / `csrfToken`, `guard`, `basicAuth` / `bearerAuth`, and Web-Crypto signing utilities (`signValue`, `unsignValue`, `timingSafeEqual`, `randomToken`, `randomId`, `base64UrlEncode`, `base64UrlDecode`); `ctx.session`; `app.listen()` on Deno; `mountFileRoutes` / `createFileRouteServerRoutes` for file-route actions. `server` targets Stable.
- **1.14.0** — `ServerHttpError`, `ctx.body`, `ctx.cookies`, `ctx.setCookie`, `ctx.accepts`, `ctx.stream`, `ctx.sse`, `ctx.renderStream`, `ctx.renderResponse`, `app.listen()`.
- **1.11.0** — `createServer`, runtime-agnostic WebSocket sessions, dependency-free routing.
