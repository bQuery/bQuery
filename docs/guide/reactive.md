# Reactive

The reactive module provides fine‑grained reactivity with minimal primitives.

```ts
import {
  signal,
  computed,
  effect,
  batch,
  watch,
  readonly,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  useAsyncData,
  useFetch,
  createUseFetch,
  createHttp,
  http,
  HttpError,
  usePolling,
  usePaginatedFetch,
  useInfiniteFetch,
  useWebSocket,
  useWebSocketChannel,
  useEventSource,
  useResource,
  useResourceList,
  useSubmit,
  createRestClient,
  createRequestQueue,
  deduplicateRequest,
  untrack,
  isSignal,
  isComputed,
} from '@bquery/bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log('Count changed', count.value);
});

// Watch with value comparison
watch(count, (newVal, oldVal) => {
  console.log(`Changed from ${oldVal} to ${newVal}`);
});

batch(() => {
  count.value++;
  count.value++;
});
```

## Signal

```ts
const name = signal('World');
name.value = 'bQuery';
```

### Signal API

- `value` (getter/setter) – tracked reads, reactive writes
- `peek()` – read without tracking
- `update(updater)` – update based on current value
- `dispose()` – remove all subscribers, preventing memory leaks

### Disposing a Signal

When a signal is no longer needed, call `dispose()` to clean up all subscribers and prevent memory leaks:

```ts
const count = signal(0);

const stop = effect(() => {
  console.log(count.value);
});

count.dispose(); // All subscribers removed, effect no longer tracks this signal
```

## Computed

Computed values are lazy and cached until dependencies change.

```ts
const total = computed(() => price.value * quantity.value);
```

### Computed API

- `value` (getter) – recomputes when dependencies change

## Effect

Effects run immediately and re-run when any accessed signal/computed changes. They can return a cleanup function.

Errors thrown inside effects are caught and logged via `console.error` — the reactive system remains functional, and subsequent signal updates continue to trigger the effect.

```ts
const stop = effect(() => {
  document.title = `Count: ${count.value}`;
  return () => console.log('cleanup');
});

stop();
```

## Batch

Batch groups multiple updates into one notification pass.

```ts
batch(() => {
  count.value = 1;
  count.value = 2;
});
```

## Persisted signals

`persistedSignal` syncs a signal to `localStorage`.

```ts
import { persistedSignal } from '@bquery/bquery/reactive';

const theme = persistedSignal('theme', 'light');
theme.value = 'dark'; // Automatically saved to localStorage
```

::: tip Environment Compatibility
`persistedSignal` gracefully handles environments without `localStorage`:

- **SSR/Node.js**: Falls back to in-memory signal
- **Safari Private Mode**: Catches `SecurityError` and falls back to in-memory signal
- **JSON parse errors**: Falls back to the provided initial value

:::

## Async data composables

Use `useAsyncData()` when you want a signal-based lifecycle around any async function.

```ts
import { signal, useAsyncData } from '@bquery/bquery/reactive';

const userId = signal(1);
const user = useAsyncData(
  () => fetch(`/api/users/${userId.value}`).then((response) => response.json()),
  {
    watch: [userId],
    defaultValue: null,
    onError: (error) => console.error('Failed to load user', error),
  }
);

await user.refresh();
console.log(user.status.value, user.pending.value, user.data.value);
```

### AsyncDataState API

- `data` – signal containing the last resolved value
- `error` – signal containing the last `Error` or `null`
- `status` – `'idle' | 'pending' | 'success' | 'error'`
- `pending` – computed boolean for loading state
- `execute()` / `refresh()` – trigger the async handler manually
- `abort()` – cancel the current in-flight request (useFetch only)
- `clear()` – reset data, error, and status
- `dispose()` – stop watchers and future executions

## Fetch composables

`useFetch()` builds on `useAsyncData()` and adds request helpers such as `baseUrl`, `query`, `headers`, automatic JSON serialization for plain-object bodies, and response parsing strategies.

```ts
const users = useFetch<Array<{ id: number; name: string }>>('/users', {
  baseUrl: 'https://api.example.com',
  query: { page: 1, include: 'profile' },
  headers: { authorization: 'Bearer token' },
});
```

### `parseAs` options

- `json` (default)
- `text`
- `blob`
- `arrayBuffer`
- `formData`
- `response`

## Preconfigured fetch factories

`createUseFetch()` is handy when several requests share the same defaults.

```ts
const useApiFetch = createUseFetch({
  baseUrl: 'https://api.example.com',
  headers: { 'x-client': 'bquery-docs' },
});

const profile = useApiFetch<{ id: number; name: string }>('/profile');
```

Factory defaults merge with per-call options, including request headers and query params.

## Timeout, retry and abort

`useFetch()` supports request timeouts, automatic retries, and request
cancellation out of the box.

```ts
const data = useFetch('/api/data', {
  timeout: 5000,
  retry: 3,
});

// Or with full retry configuration
const resilient = useFetch('/api/important', {
  timeout: 10_000,
  retry: {
    count: 3,
    delay: (attempt) => 1000 * 2 ** attempt,
    retryOn: (error) => error.message.includes('500'),
  },
});

// Abort an in-flight request
data.abort();
```

External `AbortSignal` support:

```ts
const controller = new AbortController();
const data = useFetch('/api/data', { signal: controller.signal });
controller.abort(); // cancels the request
```

### `validateStatus`

Override which HTTP status codes are considered successful:

```ts
const data = useFetch('/api/resource', {
  validateStatus: (status) => status < 500,
});
```

## Imperative HTTP client

`createHttp()` returns an Axios-style imperative client with method
shortcuts, interceptors, retry, timeout, and abort support.

```ts
import { createHttp, http } from '@bquery/bquery/reactive';

// Use the default instance
const { data } = await http.get<User[]>('/api/users');
const { data: created } = await http.post('/api/users', { name: 'Ada' });

// Or create a custom instance
const api = createHttp({
  baseUrl: 'https://api.example.com',
  headers: { authorization: 'Bearer token' },
  timeout: 10_000,
});

const { data: users } = await api.get<User[]>('/users');
```

### Method shortcuts

```ts
api.get<T>(url, config?)
api.post<T>(url, body?, config?)
api.put<T>(url, body?, config?)
api.patch<T>(url, body?, config?)
api.delete<T>(url, config?)
api.head<T>(url, config?)
api.options<T>(url, config?)
api.request<T>(config)
```

### Interceptors

```ts
// Request interceptor
api.interceptors.request.use((config) => {
  config.headers = {
    ...Object.fromEntries(new Headers(config.headers)),
    'x-request-id': crypto.randomUUID(),
  };
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error instanceof HttpError && error.response?.status === 401) {
      // handle auth errors
    }
    throw error;
  }
);

// Remove interceptor
const id = api.interceptors.request.use((c) => c);
api.interceptors.request.eject(id);
api.interceptors.request.clear();
```

### Retry and timeout

```ts
const api = createHttp({
  timeout: 5000,
  retry: {
    count: 3,
    delay: 1000,
    retryOn: (error, attempt) => error.code === 'TIMEOUT' || error.code === 'NETWORK',
  },
});
```

### HttpResponse

Every imperative method returns a structured `HttpResponse<T>`:

| Field        | Type               | Description                       |
| ------------ | ------------------ | --------------------------------- |
| `data`       | `T`                | Parsed response body              |
| `status`     | `number`           | HTTP status code                  |
| `statusText` | `string`           | HTTP status text                  |
| `headers`    | `Headers`          | Response headers                  |
| `config`     | `HttpRequestConfig` | Resolved request configuration   |

### HttpError

Failed requests throw `HttpError` with rich metadata:

| Field      | Type               | Description                               |
| ---------- | ------------------ | ----------------------------------------- |
| `message`  | `string`           | Human-readable error message              |
| `code`     | `string`           | `'TIMEOUT'`, `'ABORT'`, `'NETWORK'`, `'ERR_BAD_RESPONSE'` |
| `config`   | `HttpRequestConfig` | Resolved request config                  |
| `response` | `HttpResponse?`    | Response if server replied                |

## Polling

`usePolling()` wraps `useFetch()` and executes it on a fixed interval with
automatic pause/resume support.

```ts
import { usePolling } from '@bquery/bquery/reactive';

const notifications = usePolling<Notification[]>('/api/notifications', {
  interval: 30_000,
  pauseOnHidden: true,
  pauseOnOffline: true,
});

// Manual control
notifications.pause();
notifications.resume();
console.log(notifications.isActive.value);

// Cleanup
notifications.dispose();
```

### Options

All `useFetch()` options plus:

| Option           | Type                | Default | Description                        |
| ---------------- | ------------------- | ------- | ---------------------------------- |
| `interval`       | `number`            | —       | Polling interval in milliseconds   |
| `enabled`        | `boolean \| () => boolean` | `true` | Enable/disable polling    |
| `pauseOnHidden`  | `boolean`           | `true`  | Pause when document is hidden      |
| `pauseOnOffline` | `boolean`           | `true`  | Pause when browser is offline      |

## Paginated fetch

`usePaginatedFetch()` adds page navigation helpers on top of `useFetch()`.

```ts
import { usePaginatedFetch } from '@bquery/bquery/reactive';

const users = usePaginatedFetch<User[]>(
  (page) => `/api/users?page=${page}`,
  { baseUrl: 'https://api.example.com' }
);

await users.next();
await users.prev();
await users.goTo(5);
console.log(users.page.value); // 5
```

### Returned state

All `AsyncDataState` fields plus:

| Field  | Type                      | Description                          |
| ------ | ------------------------- | ------------------------------------ |
| `page` | `Signal<number>`          | Current page (writable)              |
| `next`  | `() => Promise`          | Advance to the next page             |
| `prev`  | `() => Promise`          | Go back one page (minimum 1)        |
| `goTo`  | `(page) => Promise`      | Jump to a specific page              |

## Infinite fetch

`useInfiniteFetch()` accumulates pages using a cursor pattern, ideal for
infinite scroll or "load more" UIs.

```ts
import { useInfiniteFetch } from '@bquery/bquery/reactive';

const feed = useInfiniteFetch<Post[], Post[]>(
  (cursor) => `/api/posts?cursor=${cursor ?? ''}`,
  {
    getNextCursor: (page) =>
      page.length > 0 ? page[page.length - 1].id : undefined,
    transform: (pages) => pages.flat(),
  }
);

await feed.fetchNextPage();
console.log(feed.data.value);     // All accumulated posts
console.log(feed.hasMore.value);  // true if more pages available

// Reset and start over
await feed.refresh();
```

### Options

All `useFetch()` options (except `transform`) plus:

| Option           | Type                                     | Description                             |
| ---------------- | ---------------------------------------- | --------------------------------------- |
| `getNextCursor`  | `(page, allPages) => cursor \| undefined` | Extract cursor for the next request    |
| `transform`      | `(pages[]) => TData`                    | Transform accumulated pages             |
| `initialCursor`  | `TCursor`                                | Starting cursor value                   |

### Returned state

| Field           | Type                                    | Description                            |
| --------------- | --------------------------------------- | -------------------------------------- |
| `data`          | `Signal<TData>`                         | Transformed accumulated data           |
| `pages`         | `Signal<TResponse[]>`                   | Raw accumulated pages                  |
| `hasMore`       | `computed boolean`                      | Whether more pages are available       |
| `fetchNextPage` | `() => Promise`                         | Load the next page                     |
| `refresh`       | `() => Promise`                         | Reset and re-fetch from initial cursor |
| `clear`         | `() => void`                            | Clear all accumulated data             |
| `dispose`       | `() => void`                            | Stop and clean up                      |

## Linked signals

`linkedSignal` creates a writable computed value by providing a getter and a setter.

```ts
import { linkedSignal, signal } from '@bquery/bquery/reactive';

const first = signal('Ada');
const last = signal('Lovelace');

const fullName = linkedSignal(
  () => `${first.value} ${last.value}`,
  (next) => {
    const [nextFirst, nextLast] = next.split(' ');
    first.value = nextFirst ?? '';
    last.value = nextLast ?? '';
  }
);

console.log(fullName.value); // "Ada Lovelace"
fullName.value = 'Grace Hopper';
```

## Watch

Watch observes a signal and calls a callback with old and new values:

```ts
import { watch } from '@bquery/bquery/reactive';

const count = signal(0);
const stop = watch(count, (newVal, oldVal) => {
  console.log(`Changed: ${oldVal} → ${newVal}`);
});

count.value = 5; // logs: "Changed: 0 → 5"
stop(); // Stop watching
```

## Readonly

Create a read-only view of a signal:

```ts
import { readonly } from '@bquery/bquery/reactive';

const count = signal(0);
const readOnlyCount = readonly(count);

console.log(readOnlyCount.value); // 0
// readOnlyCount.value = 1; // TypeScript error!
```

## Untrack

Read signals without creating dependencies:

```ts
import { untrack } from '@bquery/bquery/reactive';

effect(() => {
  // This will NOT re-run when `other` changes
  const val = untrack(() => other.value);
  console.log(count.value, val);
});
```

## Type Guards

Check if a value is a signal or computed:

```ts
import { isSignal, isComputed } from '@bquery/bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

isSignal(count); // true
isSignal(doubled); // false
isComputed(doubled); // true
isComputed(count); // false
```

## Effect Scope

`effectScope()` creates a scope that collects all effects, computed values, and watches created inside it. When the scope is stopped, all collected resources are disposed at once.

This is essential for managing cleanup in non-component code such as store plugins, router guards, feature modules, and test setup.

`scope.run()` is synchronous-only. Do not pass an async callback — resources
created after an `await` cannot be collected reliably.

```ts
import { effectScope, signal, effect, computed, onScopeDispose } from '@bquery/bquery/reactive';

const scope = effectScope();

scope.run(() => {
  const count = signal(0);
  const doubled = computed(() => count.value * 2);

  effect(() => {
    console.log('Count:', count.value, 'Doubled:', doubled.value);
  });

  onScopeDispose(() => {
    console.log('Custom cleanup');
  });
});

scope.stop(); // All effects, computed values, and custom cleanup run
```

### Nested scopes

Scopes nest automatically — a child scope created inside a parent's `run()` is collected by the parent:

```ts
const parent = effectScope();

parent.run(() => {
  const child = effectScope();
  child.run(() => {
    effect(() => console.log('inner effect'));
  });
});

parent.stop(); // Stops the child scope and its effects too
```

### getCurrentScope

Check whether code is running inside a scope:

```ts
import { effectScope, getCurrentScope } from '@bquery/bquery/reactive';

const scope = effectScope();
scope.run(() => {
  console.log(getCurrentScope() !== undefined); // true
});

console.log(getCurrentScope()); // undefined
```

### onScopeDispose

Register arbitrary cleanup callbacks on the current scope:

```ts
import { effectScope, onScopeDispose } from '@bquery/bquery/reactive';

const scope = effectScope();

scope.run(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal });

  onScopeDispose(() => controller.abort());
});

scope.stop(); // abort() is called
```

### EffectScope API

- `active` (readonly) — `true` until `stop()` is called
- `run(fn)` — Execute `fn` inside the scope, collecting reactive resources
- `stop()` — Dispose all collected resources; safe to call multiple times

## toValue

`toValue()` extracts the underlying value from a `Signal`, a `readonly()` wrapper, a `Computed`, or returns a plain value as-is. This eliminates repetitive `isSignal(x) ? x.value : x` patterns.

`MaybeSignal<T>` includes readonly wrappers returned by `readonly()`. This matches runtime behavior: `toValue()` intentionally unwraps only bQuery readonly wrappers created by `readonly()`, not arbitrary structural `{ value, peek }` objects.

```ts
import { signal, readonly, computed, toValue } from '@bquery/bquery/reactive';

const count = signal(5);
const publicCount = readonly(count);
const doubled = computed(() => count.value * 2);

toValue(42);      // 42 (plain value returned as-is)
toValue(count);   // 5  (reads signal.value)
toValue(publicCount); // 5  (reads readonly signal.value)
toValue(doubled); // 10 (reads computed.value)
```

### MaybeSignal Type

The `MaybeSignal<T>` type represents a value that may be plain, a `Signal<T>`, a readonly wrapper returned by `readonly()`, or a `Computed<T>`. Use it for APIs that accept both reactive and non-reactive inputs:

```ts
import { computed, signal, type MaybeSignal, toValue } from '@bquery/bquery/reactive';

function useTitle(title: MaybeSignal<string>) {
  document.title = toValue(title);
}

useTitle('Hello');               // plain string
useTitle(signal('Hello'));       // reactive signal
useTitle(computed(() => 'Hi')); // computed value
```

## WebSocket

`useWebSocket()` provides a reactive WebSocket connection with auto-reconnect,
heartbeat, typed messaging, message history, and signal-based state.

```ts
import { useWebSocket } from '@bquery/bquery/reactive';

const ws = useWebSocket<{ type: string; payload: unknown }>('wss://api.example.com/ws', {
  autoReconnect: { maxAttempts: 5, delay: 2000 },
  heartbeat: { interval: 30_000, pongTimeout: 10_000 },
  historySize: 50,
  onMessage: (data) => console.log('Received:', data),
});

// Send typed messages (serialized with JSON.stringify by default)
ws.send({ type: 'subscribe', payload: { channel: 'updates' } });

// Send raw data without serialization
ws.sendRaw('raw text message');

// Reactive state
effect(() => {
  console.log('Connected:', ws.isConnected.value);
  console.log('Last message:', ws.data.value);
  console.log('Status:', ws.status.value);
  console.log('History:', ws.history.value);
});

// Manual control
ws.close();
ws.open();
ws.dispose();
```

### Options

| Option           | Type                                  | Default        | Description                                |
| ---------------- | ------------------------------------- | -------------- | ------------------------------------------ |
| `protocols`      | `string \| string[]`                  | —              | Sub-protocols for the handshake            |
| `immediate`      | `boolean`                             | `true`         | Connect immediately                        |
| `autoReconnect`  | `boolean \| WebSocketReconnectConfig` | `true`         | Auto-reconnect on unexpected close         |
| `heartbeat`      | `boolean \| WebSocketHeartbeatConfig` | `false`        | Keep-alive ping/pong                       |
| `historySize`    | `number`                              | `0` (disabled) | Max messages to keep in history            |
| `serialize`      | `(data) => string \| ...`             | `JSON.stringify`| Outgoing message serializer               |
| `deserialize`    | `(event) => TReceive`                 | `JSON.parse` with raw-string fallback | Incoming message deserializer |

If the built-in deserializer receives a string that fails JSON parsing, it returns the original raw string instead of throwing.

### Reconnect config

| Field              | Type                                     | Default    |
| ------------------ | ---------------------------------------- | ---------- |
| `maxAttempts`      | `number`                                 | `Infinity` |
| `delay`            | `number`                                 | `1000`     |
| `maxDelay`         | `number`                                 | `30000`    |
| `factor`           | `number`                                 | `2`        |
| `shouldReconnect`  | `(event, attempts) => boolean`           | —          |

### Heartbeat config

| Field              | Type                          | Default  |
| ------------------ | ----------------------------- | -------- |
| `message`          | `string \| ArrayBuffer \| ...`| `'ping'` |
| `interval`         | `number`                      | `30000`  |
| `pongTimeout`      | `number`                      | `10000`  |
| `responseMessage`  | `string`                      | —        |

### Returned state

| Field               | Type                         | Description                              |
| ------------------- | ---------------------------- | ---------------------------------------- |
| `status`            | `readonly Signal`            | `'CONNECTING' \| 'OPEN' \| 'CLOSING' \| 'CLOSED'` |
| `data`              | `Signal<TReceive>`           | Last received message (deserialized)     |
| `error`             | `Signal<Event \| null>`      | Last error event                         |
| `history`           | `Signal<TReceive[]>`         | Rolling message history                  |
| `isConnected`       | `computed boolean`           | Whether the socket is `OPEN`             |
| `reconnectAttempts` | `Signal<number>`             | Current reconnect attempt count          |
| `latency`           | `Signal<number>`             | Last measured round-trip time in ms      |
| `lastDisconnectedAt`| `Signal<number>`             | Timestamp of the last unexpected disconnect |
| `send`              | `(data: TSend) => void`      | Send a serialized message                |
| `sendRaw`           | `(data) => void`             | Send raw data without serialization      |
| `open`              | `() => void`                 | Open / reconnect manually                |
| `close`             | `(code?, reason?) => void`   | Gracefully close                         |
| `dispose`           | `() => void`                 | Tear down all resources                  |

## Server-Sent Events (SSE)

`useEventSource()` wraps the native `EventSource` API with reactive signals,
auto-reconnect, and typed deserialization.

```ts
import { useEventSource } from '@bquery/bquery/reactive';

const sse = useEventSource<{ type: string; message: string }>('/api/events', {
  events: ['notification', 'update'],
  autoReconnect: true,
  onMessage: (data, event) => console.log(`[${event.type}]`, data),
});

effect(() => {
  if (sse.data.value) {
    console.log(`Event [${sse.eventName.value}]:`, sse.data.value);
  }
});

sse.dispose();
```

### Options

| Option            | Type                                  | Default        | Description                          |
| ----------------- | ------------------------------------- | -------------- | ------------------------------------ |
| `immediate`       | `boolean`                             | `true`         | Connect immediately                  |
| `autoReconnect`   | `boolean \| EventSourceReconnectConfig` | `true`       | Auto-reconnect on error with configurable delay and attempt limits |
| `events`          | `string[]`                            | `[]`           | Named events to listen for           |
| `deserialize`     | `(data: string) => TData`            | `JSON.parse`   | Custom deserializer                  |
| `eventSourceInit` | `EventSourceInit`                     | —              | Native EventSource init (e.g. `withCredentials`) |

### Returned state

| Field         | Type                    | Description                       |
| ------------- | ----------------------- | --------------------------------- |
| `status`      | `readonly Signal`       | Connection status                 |
| `data`        | `Signal<TData>`         | Last received data                |
| `eventName`   | `Signal<string>`        | Last event name                   |
| `error`       | `Signal<Event \| null>` | Last error event                  |
| `isConnected` | `computed boolean`      | Whether the EventSource is open   |
| `open`        | `() => void`            | Open / reconnect                  |
| `close`       | `() => void`            | Close the connection              |
| `dispose`     | `() => void`            | Tear down all resources           |

## REST resource composable

`useResource()` provides a full CRUD lifecycle for a REST endpoint with
reactive state, optimistic updates, and mutation tracking.

```ts
import { useResource } from '@bquery/bquery/reactive';

const user = useResource<User>('/api/users/1', {
  baseUrl: 'https://api.example.com',
  optimistic: true,
});

// CRUD operations
await user.actions.fetch();
await user.actions.create({ name: 'Ada' });
await user.actions.update({ name: 'Ada', email: 'ada@example.com' });
await user.actions.patch({ email: 'new@example.com' });
await user.actions.remove();

// Reactive state
effect(() => {
  console.log('Data:', user.data.value);
  console.log('Mutating:', user.isMutating.value);
  console.log('Status:', user.status.value);
});
```

### Options

All `useFetch()` options (except `method` and `body`) plus:

| Option              | Type                          | Default | Description                               |
| ------------------- | ----------------------------- | ------- | ----------------------------------------- |
| `optimistic`        | `boolean`                     | `false` | Apply updates optimistically with rollback |
| `onMutationSuccess` | `(data, action) => void`      | —       | Called after successful mutations          |
| `onMutationError`   | `(error, action) => void`     | —       | Called after failed mutations              |

### Returned state

| Field        | Type                      | Description                          |
| ------------ | ------------------------- | ------------------------------------ |
| `data`       | `Signal<T>`               | Resource data                        |
| `error`      | `Signal<Error \| null>`   | Last error                           |
| `status`     | `Signal<AsyncDataStatus>` | Lifecycle status                     |
| `pending`    | `computed boolean`        | Whether the initial fetch is pending |
| `isMutating` | `computed boolean`        | Whether any mutation is in progress  |
| `actions`    | `ResourceActions<T>`      | CRUD methods (fetch/create/update/patch/remove) |
| `refresh`    | `() => Promise`           | Re-fetch the resource                |
| `clear`      | `() => void`              | Clear data and status                |
| `dispose`    | `() => void`              | Stop all reactive state              |

## Form submission

`useSubmit()` provides a simple reactive wrapper for form submissions.

```ts
import { useSubmit } from '@bquery/bquery/reactive';

const form = useSubmit<{ id: number }>('/api/users', {
  baseUrl: 'https://api.example.com',
  headers: { 'x-csrf': token },
});

const result = await form.submit({ name: 'Ada', email: 'ada@example.com' });
console.log(form.status.value); // 'success'
console.log(form.data.value);   // { id: 42 }

form.clear(); // Reset state
```

### Returned state

| Field     | Type                      | Description               |
| --------- | ------------------------- | ------------------------- |
| `data`    | `Signal<TResponse>`       | Last response data        |
| `error`   | `Signal<Error \| null>`   | Last error                |
| `status`  | `Signal<AsyncDataStatus>` | Current status            |
| `pending` | `computed boolean`        | Whether submission is pending |
| `submit`  | `(body) => Promise`       | Submit data               |
| `clear`   | `() => void`              | Reset state               |

## Imperative REST client

`createRestClient()` creates a typed REST client for a specific API resource
with conventional CRUD endpoints.

```ts
import { createRestClient } from '@bquery/bquery/reactive';

interface User {
  id: number;
  name: string;
  email: string;
}

const users = createRestClient<User>('https://api.example.com/users', {
  headers: { authorization: '******' },
  timeout: 10_000,
});

const { data: allUsers } = await users.list();
const { data: user } = await users.get(1);
const { data: created } = await users.create({ name: 'Ada' });
await users.update(1, { name: 'Ada', email: 'ada@example.com' });
await users.patch(1, { email: 'new@example.com' });
await users.remove(1);

// Access interceptors via the underlying http client
users.http.interceptors.request.use((config) => {
  config.headers = { ...Object.fromEntries(new Headers(config.headers)), 'x-request-id': crypto.randomUUID() };
  return config;
});
```

### Methods

| Method     | HTTP    | URL Pattern      | Description         |
| ---------- | ------- | ---------------- | ------------------- |
| `list()`   | `GET`   | `{baseUrl}`      | Fetch all items     |
| `get(id)`  | `GET`   | `{baseUrl}/{id}` | Fetch a single item |
| `create(body)` | `POST` | `{baseUrl}`  | Create a new item   |
| `update(id, body)` | `PUT` | `{baseUrl}/{id}` | Full replace |
| `patch(id, body)` | `PATCH` | `{baseUrl}/{id}` | Partial update |
| `remove(id)` | `DELETE` | `{baseUrl}/{id}` | Delete an item  |

## WebSocket channels

`useWebSocketChannel()` multiplexes a single WebSocket connection into
topic-based channels. Incoming messages are routed to per-channel
reactive signals based on a configurable channel extractor.

```ts
import { useWebSocketChannel } from '@bquery/bquery/reactive';

const chat = useWebSocketChannel('wss://chat.example.com/ws');

const general = chat.subscribe('general');
const updates = chat.subscribe('updates');

effect(() => console.log('General:', general.data.value));

chat.publish('general', { text: 'Hello!' });

// Unsubscribe from a channel
updates.unsubscribe();

// Access underlying WebSocket
chat.ws.dispose();
```

### Channel options

| Option        | Type                              | Default                     | Description                     |
| ------------- | --------------------------------- | --------------------------- | ------------------------------- |
| `getChannel`  | `(msg: TReceive) => string?`     | reads `msg.channel`         | Extract channel from message    |
| `wrap`        | `(ch, data) => TReceive`         | `{ channel: ch, data }`    | Wrap payload for sending        |

### Default message format

```ts
interface ChannelMessage<T = unknown> {
  channel: string;
  data: T;
}
```

## WebSocket latency & reconnect events

`useWebSocket()` now includes additional reactive signals and callbacks:

```ts
const ws = useWebSocket('wss://api.example.com/ws', {
  heartbeat: { interval: 30_000, responseMessage: 'pong' },
  onReconnect: (attempts) => console.log(`Reconnected after ${attempts} attempts`),
});

effect(() => {
  console.log('Latency:', ws.latency.value, 'ms');
  console.log('Last disconnect:', ws.lastDisconnectedAt.value);
});
```

| Signal                | Type            | Description                                                    |
| --------------------- | --------------- | -------------------------------------------------------------- |
| `latency`             | `Signal<number>`| Round-trip time in ms measured from heartbeat ping/pong         |
| `lastDisconnectedAt`  | `Signal<number>`| Timestamp of last unexpected disconnection (0 if never)        |

| Callback     | Signature                      | Description                                  |
| ------------ | ------------------------------ | -------------------------------------------- |
| `onReconnect`| `(attempts: number) => void`   | Called after a successful auto-reconnection   |

## Resource list composable

`useResourceList()` provides collection-level CRUD with optimistic array mutations.

```ts
import { useResourceList } from '@bquery/bquery/reactive';

interface Todo { id: number; title: string; done: boolean }

const todos = useResourceList<Todo>('/api/todos', {
  baseUrl: 'https://api.example.com',
  optimistic: true,
  getId: (t) => t.id,
});

await todos.actions.add({ title: 'Buy milk', done: false });
await todos.actions.patch(1, { done: true });
await todos.actions.remove(2);

effect(() => console.log('Todos:', todos.data.value));
```

### Options

All `useFetch()` options (except `method` and `body`) plus:

| Option              | Type                             | Default           | Description                           |
| ------------------- | -------------------------------- | ----------------- | ------------------------------------- |
| `getId`             | `(item: T) => string \| number` | `item.id`         | Extract unique ID from each item      |
| `optimistic`        | `boolean`                        | `false`           | Apply list mutations optimistically   |
| `onMutationSuccess` | `(action: string) => void`       | —                 | Called after successful mutations      |
| `onMutationError`   | `(error, action) => void`        | —                 | Called after failed mutations          |

### Returned state

| Field        | Type                       | Description                          |
| ------------ | -------------------------- | ------------------------------------ |
| `data`       | `Signal<T[]>`              | Reactive list data                   |
| `error`      | `Signal<Error \| null>`    | Last error                           |
| `status`     | `Signal<AsyncDataStatus>`  | Lifecycle status                     |
| `pending`    | `computed boolean`         | Whether the list fetch is pending    |
| `isMutating` | `computed boolean`         | Whether any mutation is in progress  |
| `actions`    | `ResourceListActions<T>`   | CRUD methods (fetch/add/update/patch/remove) |
| `refresh`    | `() => Promise`            | Re-fetch the list                    |
| `clear`      | `() => void`               | Clear data and status                |
| `dispose`    | `() => void`               | Stop all reactive state              |

## Request deduplication

`deduplicateRequest()` coalesces identical in-flight operations so that
concurrent callers sharing the same key reuse a single promise.

```ts
import { deduplicateRequest, createHttp } from '@bquery/bquery/reactive';

const api = createHttp({ baseUrl: 'https://api.example.com' });

// Both calls share one in-flight operation
const [a, b] = await Promise.all([
  deduplicateRequest('/users', () => api.get('/users')),
  deduplicateRequest('/users', () => api.get('/users')),
]);
```

## Request queue

`createRequestQueue()` limits the number of concurrent HTTP requests.

```ts
import { createRequestQueue, createHttp } from '@bquery/bquery/reactive';

const api = createHttp({ baseUrl: 'https://api.example.com' });
const queue = createRequestQueue({ concurrency: 3 });

// At most 3 requests run in parallel
const results = await Promise.all(
  ids.map(id => queue.add(() => api.get(`/items/${id}`)))
);
```

### Options

| Option        | Type     | Default | Description                          |
| ------------- | -------- | ------- | ------------------------------------ |
| `concurrency` | `number` | `6`     | Maximum concurrent in-flight requests |

### Returned API

| Member    | Type                                          | Description                        |
| --------- | --------------------------------------------- | ---------------------------------- |
| `add`     | `(fn: () => Promise) => Promise`              | Enqueue a request                  |
| `pending` | `number` (getter)                             | Currently running requests         |
| `size`    | `number` (getter)                             | Requests waiting in queue          |
| `clear`   | `() => void`                                  | Reject all pending (queued) items  |

## onRetry callback

The `RetryConfig` now accepts an optional `onRetry` callback invoked
before each retry attempt:

```ts
import { createHttp } from '@bquery/bquery/reactive';

const api = createHttp({
  retry: {
    count: 3,
    delay: 1000,
    onRetry: (error, attempt) => {
      console.log(`Retry #${attempt}:`, error.message);
    },
  },
});
```
