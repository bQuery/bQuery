# Concurrency

::: tip What's new in 1.15.0
Concurrency adds **CSP-safe module workers** — `defineWorker()` / `defineRpcWorker()` on the main thread plus `exposeTask()` / `exposeRpc()` inside the worker — so worker offloading no longer requires `'unsafe-eval'`. It also adds client UI-scheduling primitives `suspense()`, `startTransition()`, and `deferred()`. The module is targeting **Stable** in 1.15.0 — see [Stability](#stability-targeting-stable-in-1-15-0).
:::

::: tip What's new in 1.14.0
Concurrency gained `withTransferables`, `createSharedBuffer`, RPC `maxInFlight`, pool priorities, `pause` / `resume` / `onIdle`, and rolling reactive metrics in 1.14.0. See the [1.14.0 release notes](/release-notes/1.14#additive-module-expansions).
:::

The concurrency module adds a small, explicit browser-side worker layer for bQuery's zero-build model.

> **New in 1.10.0:** The module now includes explicit RPC workers, bounded task/RPC pools, opt-in reactive worker state wrappers, and high-level helpers such as `parallel()`, `batchTasks()`, `map()`, `filter()`, `reduce()`, and `pipeline()`.

It is intentionally narrower than `threadts-universal`: the current milestones focus on **safe task execution**, **explicit RPC-style method dispatch**, **bounded pools/queueing**, **lifecycle cleanup**, **timeout/abort handling**, and **support detection** without introducing decorators, implicit proxies, or runtime-specific adapters that would bloat the package.

## Import

```ts
import {
  batchTasks,
  createReactiveRpcPool,
  createReactiveRpcWorker,
  createReactiveTaskPool,
  createReactiveTaskWorker,
  createSharedBuffer,
  createTaskWorker,
  createTaskPool,
  createRpcWorker,
  createRpcPool,
  callWorkerMethod,
  deferred,
  defineRpcWorker,
  defineWorker,
  every,
  exposeRpc,
  exposeTask,
  filter,
  find,
  getConcurrencySupport,
  isConcurrencySupported,
  isModuleWorkerSupported,
  isWorkerModule,
  map,
  parallel,
  pipeline,
  reduce,
  runTask,
  some,
  startTransition,
  suspense,
  withTransferables,
} from '@bquery/bquery/concurrency';
```

## Execution modes: module (CSP-safe) vs dynamic

Worker handlers can be supplied two ways. Every factory — `runTask()`,
`createTaskWorker()`, `createTaskPool()`, `createRpcWorker()`, `createRpcPool()`,
`callWorkerMethod()`, and the reactive wrappers — accepts either form:

- **Module mode (default, CSP-safe):** supply a `defineWorker()` /
  `defineRpcWorker()` URL. The worker is a pre-bundled module loaded by URL, so
  it needs **no `'unsafe-eval'`** — only the usual `worker-src` policy.
- **Dynamic mode (opt-in):** supply an inline standalone function or handler
  map. The body is revived with `new Function(...)`, so it requires
  `'unsafe-eval'` plus `worker-src blob:`.

Module mode is the recommended, CSP-clean default. Dynamic mode stays available
for quick zero-build experiments where a relaxed CSP is acceptable; it revives
the handler with `new Function(...)`, which is why it needs `'unsafe-eval'`.

### `defineWorker()` and `exposeTask()`

Point `defineWorker()` at a pre-bundled worker module and wire the worker side
up with `exposeTask()`. No function body is serialized, so no `'unsafe-eval'` is
required.

```ts
// square.worker.ts
import { exposeTask } from '@bquery/bquery/concurrency';

exposeTask((value: number) => value * value);
```

```ts
// main.ts
import { createTaskWorker, defineWorker } from '@bquery/bquery/concurrency';

const square = defineWorker<number, number>(new URL('./square.worker.ts', import.meta.url));

const worker = createTaskWorker(square);
const result = await worker.run(12); // 144
worker.terminate();
```

`defineWorker()` defaults to `{ type: 'module' }`; pass `{ type: 'classic' }` for
a classic worker script. The descriptor is a frozen `WorkerModule`; check one
with `isWorkerModule()`.

### `defineRpcWorker()` and `exposeRpc()`

The same split applies to named RPC dispatch.

```ts
// calc.worker.ts
import { exposeRpc } from '@bquery/bquery/concurrency';

exposeRpc({
  sum: ({ values }: { values: number[] }) => values.reduce((total, value) => total + value, 0),
});
```

```ts
// main.ts
import { createRpcWorker, defineRpcWorker } from '@bquery/bquery/concurrency';

type Routes = { sum(input: { values: number[] }): number };
const calc = defineRpcWorker<Routes>(new URL('./calc.worker.ts', import.meta.url));

const rpc = createRpcWorker(calc);
const total = await rpc.call('sum', { values: [1, 2, 3] }); // 6
rpc.terminate();
```

`exposeTask()` and `exposeRpc()` default to the ambient worker `self`; pass an
explicit `WorkerHostScope` to host the protocol on a `MessagePort` or a test
double. Use `isModuleWorkerSupported()` to feature-detect module workers (only
the `Worker` constructor is required — no `Blob`/`URL.createObjectURL`).

## Current scope

### Included now

- One-off worker execution via `runTask()`
- Reusable single-task workers via `createTaskWorker()`
- Reusable task pools via `createTaskPool()`
- Named request/response dispatch via `createRpcWorker()`
- One-off RPC method execution via `callWorkerMethod()`
- Reusable RPC pools via `createRpcPool()`
- Reactive worker and pool wrappers via `createReactiveTaskWorker()`, `createReactiveRpcWorker()`, `createReactiveTaskPool()`, and `createReactiveRpcPool()`
- Task-list helpers via `parallel()` and `batchTasks()`
- Array mapping via `map()`
- Collection helpers via `filter()`, `reduce()`, `some()`, `every()`, and `find()`
- Optional fluent pipeline builder via `pipeline()`
- Explicit support detection
- Timeout handling
- Abort handling
- Worker lifecycle cleanup and termination errors
- FIFO queueing with configurable backpressure
- Zero-build browser usage via inline `Blob` workers
- Runtime metadata via `getConcurrencySupport().runtime`
- Optional RPC `maxInFlight` control per reusable worker
- Pool pause/resume, `onIdle()`, and rolling metrics
- Transferable discovery helpers via `withTransferables()`
- Shared-memory helper via `createSharedBuffer()`

### Reactive bindings

The optional reactive wrappers keep the explicit worker and pool APIs intact while
adding readonly signals for UI bindings and dashboards.

- `createReactiveTaskWorker()` / `createReactiveRpcWorker()` add `state$` and `busy$`
- `createReactiveTaskPool()` / `createReactiveRpcPool()` add `state$`, `busy$`, `concurrency$`, `pending$`, and `size$`
- Reactive pools also expose `paused$` and `metrics$`

They are intentionally opt-in so the base worker APIs stay lean when you do not
need reactive state monitoring.

### Intentionally out of scope for bQuery

- Node/Deno/Bun-specific worker adapters in the browser-focused package
- Decorator-heavy APIs
- Implicit bundler glue or code generation that breaks zero-build usage

## ThreadTS parity matrix

| Feature group                      | `threadts-universal`                 | bQuery status                                                                                                    |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| One-off task execution             | `run()`                              | **Supported** via `runTask()`                                                                                    |
| Explicit reusable workers          | low-level worker APIs                | **Supported** via `createTaskWorker()`                                                                           |
| Explicit RPC dispatch              | named methods / adapters             | **Supported** via `createRpcWorker()` and `callWorkerMethod()`                                                   |
| Pools + queueing                   | auto-scaling pools / priority queues | **Adapted** via `createTaskPool()` and `createRpcPool()` with explicit bounded concurrency + FIFO queueing       |
| Worker lifecycle                   | termination / reuse                  | **Supported** with explicit `terminate()` on workers and pools                                                   |
| Timeout + cancellation             | supported                            | **Supported** via `timeout` and `AbortSignal`                                                                    |
| Support detection                  | runtime-dependent                    | **Supported** via `getConcurrencySupport()` / `isConcurrencySupported()`                                         |
| Array / batch / collection helpers | broad high-level surface             | **Adapted** via `parallel()`, `batchTasks()`, `map()`, `filter()`, `reduce()`, `some()`, `every()`, and `find()` |
| Fluent pipelines                   | pipeline builders                    | **Adapted** via `pipeline()` as an optional fluent layer over the existing collection helpers                    |
| Decorators / implicit magic        | broad decorator suite                | **Not adopted**; conflicts with bQuery's explicit, lightweight browser-first design                              |
| Node / Deno / Bun adapters         | universal runtime adapters           | **Not adopted** in this browser-focused package                                                                  |
| Worker execution mode              | eval-based revival                   | **CSP-safe by default** via `defineWorker()` module workers; dynamic eval mode kept as explicit opt-in           |

## Stability: targeting Stable in 1.15.0

`concurrency` was introduced as **Experimental** in 1.10.0 and expanded in
1.14.0. The work to graduate it is tracked in
[#133](https://github.com/bQuery/bQuery/issues/133); its adoption-blocking
prerequisite — a CSP-safe default that needs no `'unsafe-eval'`
([#134](https://github.com/bQuery/bQuery/issues/134)) — is resolved by the
[module workers](#execution-modes-module-csp-safe-vs-dynamic) above. Promotion to
**Stable** then follows one minor cycle with the public surface frozen.

### Exit criteria

- [x] **CSP-safe default worker mode, no `'unsafe-eval'`** ([#134](https://github.com/bQuery/bQuery/issues/134)) — `defineWorker()` / `defineRpcWorker()` module workers; dynamic eval mode is now an explicit opt-in.
- [x] **Serializable-handler constraint documented and enforced** — dynamic-mode handlers fail fast with `TaskWorkerSerializationError`; module-mode handlers are exempt by design.
- [x] **Coverage across task / pool / RPC / shared buffer** plus module mode and the client primitives (`tests/concurrency.test.ts`, `tests/concurrency-stable.test.ts`).
- [x] **Runtime boundary stated** — browser-focused, consistent with the module's non-goals (below).
- [ ] **Public surface frozen for one minor** (no additive breaking changes) — demonstrated across the 1.15 cycle.
- [ ] **A dedicated `bq-suspense` view directive** ([#135](https://github.com/bQuery/bQuery/issues/135)) — the programmatic `suspense()` boundary ships now; the compiler directive is tracked separately and not required for the freeze.

### Frozen surface

The contract that must not break once Stable:

- **Workers/pools:** `runTask`, `createTaskWorker`, `createTaskPool`, `createRpcWorker`, `createRpcPool`, `callWorkerMethod`, and the reactive wrappers — each accepting an inline handler (dynamic) or a `WorkerModule` (module).
- **Module workers:** `defineWorker`, `defineRpcWorker`, `isWorkerModule`, `exposeTask`, `exposeRpc`.
- **High-level helpers:** `parallel`, `batchTasks`, `map`, `filter`, `reduce`, `some`, `every`, `find`, `pipeline`.
- **Client primitives:** `suspense`, `startTransition`, `deferred`.
- **Detection + utilities:** `getConcurrencySupport`, `isConcurrencySupported`, `isModuleWorkerSupported`, `withTransferables`, `createSharedBuffer`.
- **Errors:** `TaskWorkerError`, `TaskWorkerUnsupportedError`, `TaskWorkerSerializationError`, `TaskWorkerTimeoutError`, `TaskWorkerAbortError`, and the `TaskWorkerErrorCode` set.

### Runtime boundary

`concurrency` is **browser-focused** by design. It uses standard Web Worker
primitives and does not ship Node/Deno/Bun worker adapters — an explicit non-goal
that keeps the package lean. `createSharedBuffer()` additionally needs
`crossOriginIsolated` with COOP/COEP headers (inherent to `SharedArrayBuffer`,
not a bQuery choice). The browser focus is a scoping decision and does not block
stability.

### Per-environment support matrix

| Capability                                  | Modern browser | Worker-capable runtime | Strict CSP (no `unsafe-eval`) |
| ------------------------------------------- | -------------- | ---------------------- | ----------------------------- |
| Module workers (`defineWorker`)             | yes            | yes                    | **yes**                       |
| Dynamic workers (inline functions)          | yes            | yes                    | no (needs `'unsafe-eval'`)    |
| Pools / RPC / high-level helpers            | yes            | yes                    | yes (module mode)             |
| Client primitives (`suspense`/`deferred`/…) | yes            | yes                    | yes (no workers involved)     |
| Shared buffers (`createSharedBuffer`)       | COOP/COEP      | COOP/COEP              | COOP/COEP                     |

The client primitives are pure signal scheduling and run anywhere signals do,
including SSR. Worker features require the `Worker` constructor; only dynamic
mode additionally needs `Blob` + `URL.createObjectURL` and a relaxed CSP.

## `runTask()`

Use `runTask()` when you need one isolated computation and do not want to manage worker lifecycle manually.

```ts
import { runTask } from '@bquery/bquery/concurrency';

const result = await runTask(
  ({ values }: { values: number[] }) => values.reduce((sum, value) => sum + value, 0),
  { values: [1, 2, 3, 4] },
  { timeout: 1_000 }
);
```

## `createTaskWorker()`

Use `createTaskWorker()` when you want to reuse the same worker for repeated runs.

```ts
import { createTaskWorker } from '@bquery/bquery/concurrency';

const worker = createTaskWorker(
  async ({ delay, value }: { delay: number; value: number }) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return value * 2;
  },
  { name: 'double-worker', timeout: 2_000 }
);

const first = await worker.run({ delay: 10, value: 21 });
const second = await worker.run({ delay: 0, value: 5 });

console.log(first, second); // 42, 10
worker.terminate();
```

### Behavior

- A reusable task worker runs **one task at a time**
- Calling `run()` while another task is active rejects with a `BUSY` error
- Abort and timeout handling terminate the active worker run so the next run starts cleanly
- Calling `terminate()` permanently disposes the worker handle

## `createRpcWorker()`

Use `createRpcWorker()` when one worker should expose a small set of named methods.

```ts
import { createRpcWorker } from '@bquery/bquery/concurrency';

const rpc = createRpcWorker({
  formatUser: ({ first, last }: { first: string; last: string }) => `${last}, ${first}`,
  sum: ({ values }: { values: number[] }) => values.reduce((total, value) => total + value, 0),
});

console.log(await rpc.call('formatUser', { first: 'Ada', last: 'Lovelace' }));
console.log(await rpc.call('sum', { values: [1, 2, 3, 4] }));

rpc.terminate();
```

### RPC behavior

- Only explicitly provided method names can be called
- Unknown methods reject with `code: 'METHOD_NOT_FOUND'`
- By default, the worker processes **one call at a time per worker**
- Set `maxInFlight` to allow multiple concurrent calls on the same reusable worker
- Timeout and abort handling reset the worker so the next call starts cleanly

```ts
const rpc = createRpcWorker(
  {
    wait: async ({ delay, value }: { delay: number; value: number }) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return value;
    },
  },
  { maxInFlight: 2 }
);
```

## `createTaskPool()`

Use `createTaskPool()` when the same standalone task should run across multiple workers with explicit bounded concurrency and FIFO queueing.

```ts
import { createTaskPool } from '@bquery/bquery/concurrency';

const pool = createTaskPool(
  async ({ delay, value }: { delay: number; value: number }) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return value * 2;
  },
  { concurrency: 4, maxQueue: 16, name: 'double-pool' }
);

const results = await Promise.all([
  pool.run({ delay: 20, value: 1 }),
  pool.run({ delay: 20, value: 2 }),
  pool.run({ delay: 0, value: 3 }),
]);

console.log(results); // [2, 4, 6]
pool.terminate();
```

### Task-pool behavior

- Runs up to `concurrency` tasks in parallel
- Additional runs wait in a **FIFO queue**
- `maxQueue` bounds queued-but-not-started work
- `clear()` rejects queued tasks with `code: 'QUEUE_CLEARED'` without interrupting active tasks
- Calls beyond `maxQueue` reject with `code: 'QUEUE_FULL'`
- Abort signals can cancel queued tasks before they start or active tasks while they run
- `pause()` stops dequeuing new work without interrupting active runs
- `resume()` restarts dequeueing after a pause
- `onIdle()` resolves when both the active and queued work are empty
- `metrics` exposes rolling completion/error counters and runtime summaries

## Transferables and shared memory

Use `withTransferables()` to keep transfer lists explicit while avoiding manual discovery:

```ts
const payload = withTransferables({
  buffer: new Uint8Array([1, 2, 3]).buffer,
});

await runTask((input: { buffer: ArrayBuffer }) => input.buffer.byteLength, payload.value, {
  transfer: payload.transfer,
});
```

For shared-memory workflows, `createSharedBuffer()` wraps `new SharedArrayBuffer(...)` with a runtime check:

```ts
const shared = createSharedBuffer(1024);
```

## `createRpcPool()`

Use `createRpcPool()` when a small set of named methods should run across multiple reusable workers with bounded concurrency and FIFO queueing.

```ts
import { createRpcPool } from '@bquery/bquery/concurrency';

const pool = createRpcPool(
  {
    sum: ({ values }: { values: number[] }) => values.reduce((total, value) => total + value, 0),
  },
  { concurrency: 2, maxQueue: 8 }
);

const totals = await Promise.all([
  pool.call('sum', { values: [1, 2, 3] }),
  pool.call('sum', { values: [4, 5, 6] }),
  pool.call('sum', { values: [7, 8, 9] }),
]);

console.log(totals); // [6, 15, 24]
pool.terminate();
```

### RPC-pool behavior

- Uses the same explicit named-method model as `createRpcWorker()`
- Spreads calls across up to `concurrency` workers
- Queues overflow calls in FIFO order
- `clear()` only affects queued calls
- `terminate()` rejects queued and active calls, then tears down all backing workers

## Reactive worker and pool wrappers

Use the reactive wrappers when a UI should observe worker or queue state through
bQuery signals instead of polling synchronous getters.

```ts
import { createReactiveTaskPool } from '@bquery/bquery/concurrency';
import { effect } from '@bquery/bquery/reactive';

const pool = createReactiveTaskPool(
  async ({ delay, value }: { delay: number; value: number }) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return value * 2;
  },
  { concurrency: 2, maxQueue: 8 }
);

effect(() => {
  console.log(pool.state$.value, pool.pending$.value, pool.size$.value);
});

await Promise.all([
  pool.run({ delay: 20, value: 1 }),
  pool.run({ delay: 20, value: 2 }),
  pool.run({ delay: 0, value: 3 }),
]);

pool.terminate();
```

### Reactive wrapper behavior

- The base sync getters (`state`, `busy`, `pending`, `size`, `concurrency`) still work
- Signal mirrors update immediately after `run()` / `call()`, `clear()`, and `terminate()`
- Settled tasks and calls re-sync the wrapper state after success, timeout, abort, and termination
- One-shot helpers such as `runTask()` and `callWorkerMethod()` intentionally remain non-reactive

## `callWorkerMethod()`

Use `callWorkerMethod()` when you want one RPC call without manually managing a worker handle.

```ts
import { callWorkerMethod } from '@bquery/bquery/concurrency';

const total = await callWorkerMethod(
  {
    sum: ({ values }: { values: number[] }) => values.reduce((result, value) => result + value, 0),
  },
  'sum',
  { values: [2, 4, 6] }
);
```

## `parallel()`

Use `parallel()` when you want to run an explicit list of standalone tasks across a bounded worker pool.

```ts
import { parallel } from '@bquery/bquery/concurrency';

const results = await parallel([
  { handler: (value: number) => value * 2, input: 5 },
  {
    handler: ({ first, last }: { first: string; last: string }) => `${last}, ${first}`,
    input: { first: 'Ada', last: 'Lovelace' },
  },
]);

console.log(results); // [10, 'Lovelace, Ada']
```

### `parallel()` behavior

- Preserves task order in the returned result array
- Reuses the existing task-pool runtime instead of creating hidden long-lived globals
- Each task may provide its own `signal`, `timeout`, and `transfer` options
- Handlers must still be standalone serializable functions

## `batchTasks()`

Use `batchTasks()` when the task list should run in sequential batches while each batch still uses parallel workers.

The name is intentionally adapted from `threadts-universal`'s `batch()` to avoid colliding with bQuery's existing reactive `batch()` export.

```ts
import { batchTasks } from '@bquery/bquery/concurrency';

const results = await batchTasks(
  [
    { handler: (value: number) => value * 2, input: 1 },
    { handler: (value: number) => value * 2, input: 2 },
    { handler: (value: number) => value * 2, input: 3 },
  ],
  2
);

console.log(results); // [2, 4, 6]
```

## `map()`

Use `map()` when one standalone mapper should process an array in parallel with optional chunking.

```ts
import { map } from '@bquery/bquery/concurrency';

const results = await map([1, 2, 3, 4], (value, index) => value + index, {
  batchSize: 2,
  concurrency: 2,
});

console.log(results); // [1, 3, 5, 7]
```

### `map()` behavior

- Preserves original array order
- Uses `batchSize` to group several items into one worker run
- Shares one optional `AbortSignal` across all chunks
- Requires a standalone mapper that can be reconstructed safely in a worker

## `filter()`

Use `filter()` when one standalone predicate should select array items in parallel while preserving the original order.

```ts
import { filter } from '@bquery/bquery/concurrency';

const results = await filter([5, 2, 9, 4], (value, index) => value % 2 === 1 && index < 3, {
  batchSize: 2,
  concurrency: 2,
});

console.log(results); // [5, 9]
```

## `some()`, `every()`, and `find()`

Use these helpers when a standalone predicate should be evaluated in worker chunks and then reduced back to a boolean or first-match result on the main thread.

```ts
import { every, find, some } from '@bquery/bquery/concurrency';

const hasEven = await some([1, 3, 4, 7], (value) => value % 2 === 0, {
  batchSize: 2,
  concurrency: 2,
});

const allEven = await every([2, 4, 6], (value) => value % 2 === 0);
const firstLarge = await find([3, 8, 11, 14], (value) => value > 10);

console.log(hasEven, allEven, firstLarge); // true, true, 11
```

### Predicate-helper behavior

- `filter()` preserves source order in the returned array
- `some()` returns `false` for empty arrays
- `every()` returns `true` for empty arrays
- `find()` returns `undefined` when nothing matches
- Like `map()`, predicate helpers currently evaluate explicit worker chunks and do not rely on hidden speculative cancellation

## `reduce()`

Use `reduce()` when a standard left-to-right accumulator should run off the main thread while keeping familiar reducer semantics.

```ts
import { reduce } from '@bquery/bquery/concurrency';

const total = await reduce(
  [1, 2, 3, 4],
  (accumulator, value, index) => accumulator + value * (index + 1),
  0
);

console.log(total); // 30
```

### `reduce()` behavior

- Preserves standard left-to-right accumulator order
- Executes in one isolated worker run instead of splitting the reducer across multiple workers
- Returns the provided `initialValue` immediately for empty arrays

## `pipeline()`

Use `pipeline()` when you want a fluent, optional wrapper around the existing collection helpers without changing the explicit low-level runtime model.

```ts
import { pipeline } from '@bquery/bquery/concurrency';

const results = await pipeline([1, 2, 3, 4], {
  batchSize: 2,
  concurrency: 2,
})
  .map((value) => value * 2)
  .filter((value) => value > 4)
  .toArray();

console.log(results); // [6, 8]
```

### `pipeline()` behavior

- It is an **optional** fluent layer; low-level workers, pools, and standalone helpers remain first-class
- The pipeline is **immutable**: each transforming stage returns a new pipeline
- It delegates to `map()`, `filter()`, `some()`, `every()`, `find()`, and `reduce()` instead of creating hidden global worker infrastructure
- It keeps the same browser-only serialization boundaries as the underlying helpers
- Like the rest of the module, it relies on serializable standalone functions and inline worker evaluation

## Client async-concurrency primitives

Worker concurrency offloads CPU work; these primitives are about **UI
scheduling** — keeping the interface responsive while async work is in flight.
They build directly on signals, add no dependencies, and are tree-shakeable.
They pair with SSR suspense streaming (`renderToStreamSuspense` / `defer`) so the
same async boundaries can stream on the server and suspend on the client.

### `suspense()`

`suspense()` is a declarative async boundary. Pass one source or an array of
sources — promises, reactive async states from `useAsyncData()` / `useResource()`,
or plain pending getters — and it aggregates them into reactive `pending`,
`settled`, and `error` signals.

```ts
import { suspense } from '@bquery/bquery/concurrency';
import { useAsyncData } from '@bquery/bquery/reactive';

const user = useAsyncData(() => fetchUser(id));
const boundary = suspense(user);

// drive fallback vs content with existing view bindings:
// <div bq-show="boundary.pending">Loading…</div>
// <section bq-show="boundary.settled">…content…</section>

boundary.error.value; // first error surfaced by any tracked source, or null
boundary.dispose();   // detach internal effects + promise listeners
```

- `pending` is `true` while any tracked source is pending
- `settled` becomes `true` once every source has settled at least once
- By default the boundary re-enters `pending` if a source becomes busy again;
  pass `{ retrigger: false }` to latch `settled` after the first resolution

### `startTransition()`

`startTransition()` marks an update as non-urgent so urgent input stays snappy.
`start(scope)` flips `isPending` immediately, then runs `scope` on a low-priority
schedule inside a reactive `batch`, decoupling the expensive update from the
event that triggered it.

```ts
import { startTransition } from '@bquery/bquery/concurrency';

const [isPending, start] = startTransition();

input.addEventListener('input', (event) => {
  query.value = event.target.value;              // urgent: keeps the field responsive
  start(() => (filter.value = event.target.value)); // non-urgent: heavy list re-render
});

// <span bq-show="isPending">Updating…</span>
```

### `deferred()`

`deferred()` returns a readonly signal that lags behind its source, throttling
expensive derived UI. Rapid source changes coalesce into a single trailing
update, so a heavy computed driven by the deferred value does not recompute on
every keystroke.

```ts
import { deferred } from '@bquery/bquery/concurrency';
import { computed } from '@bquery/bquery/reactive';

const deferredQuery = deferred(query);                 // lags `query`
const results = computed(() => expensiveSearch(deferredQuery.value));
```

Pass `{ timeout }` to bound how long the deferred value may lag its source.
`deferred()` accepts a signal, a `readonly()` wrapper, a computed, a getter
function, or a plain value.

## Timeout and abort

```ts
import {
  createTaskWorker,
  TaskWorkerAbortError,
  TaskWorkerTimeoutError,
} from '@bquery/bquery/concurrency';

const worker = createTaskWorker(async ({ delay }: { delay: number }) => {
  await new Promise((resolve) => setTimeout(resolve, delay));
  return 'done';
});

try {
  await worker.run({ delay: 5_000 }, { timeout: 50 });
} catch (error) {
  if (error instanceof TaskWorkerTimeoutError) {
    console.warn('Timed out');
  }
}

const controller = new AbortController();
const pending = worker.run({ delay: 5_000 }, { signal: controller.signal });
controller.abort();

try {
  await pending;
} catch (error) {
  if (error instanceof TaskWorkerAbortError) {
    console.warn('Aborted');
  }
}
```

## Support detection

```ts
import { getConcurrencySupport, isConcurrencySupported } from '@bquery/bquery/concurrency';

const support = getConcurrencySupport();
console.log(support.worker, support.blob, support.objectUrl);

if (!isConcurrencySupported()) {
  console.warn('Inline worker tasks are unavailable in this environment.');
}
```

## Transferables

Pass transferable objects through the `transfer` option when sending large `ArrayBuffer`-backed payloads:

```ts
const buffer = new ArrayBuffer(1024);

await runTask((input: ArrayBuffer) => input.byteLength, buffer, {
  transfer: [buffer],
});
```

## Limitations

- **Dynamic-mode** handlers must be **standalone functions**; they cannot rely on
  outer closures, because they are serialized and revived in the worker. This is
  a permanent design boundary of dynamic mode, enforced with a clear
  `TaskWorkerSerializationError`. **Module mode has no such limit** — a
  `defineWorker()` script is a normal module and may import and close over
  anything it likes.
- The module targets **browser worker primitives**. Module mode needs only the
  `Worker` constructor; dynamic mode also needs `Blob` + `URL.createObjectURL`.
- **Dynamic mode** requires a relaxed CSP (`'unsafe-eval'` plus `worker-src blob:`)
  because it revives handlers with `new Function(...)`. If your environment
  forbids dynamic evaluation, use **module mode** (`defineWorker()` /
  `defineRpcWorker()`), which is CSP-clean.
- Reactive wrappers are opt-in via `createReactiveTaskWorker()`, `createReactiveRpcWorker()`, `createReactiveTaskPool()`, and `createReactiveRpcPool()`

<!-- uniform-template-footer -->

## Pitfalls and gotchas

- **Dynamic-mode** worker bodies are serialized via `new Function(...)` — that CSP must allow `'unsafe-eval'`. Prefer **module mode** (`defineWorker()`) for a CSP-clean default.
- A `defineWorker()` URL must resolve to a real, bundled worker script that calls `exposeTask()` / `exposeRpc()`; pass it through `new URL('./x.worker.ts', import.meta.url)` so your bundler emits it.
- `startTransition()` and `deferred()` schedule on idle/macrotasks, not synchronously — read `isPending` / the deferred signal inside an `effect()` rather than immediately after calling `start()`.
- Transferables (`ArrayBuffer`, `MessagePort`) are detached on send; pass `withTransferables()` to mark them explicitly.
- `maxInFlight` on RPC pools is per worker, not global — multiply by pool size for total concurrency.
- `pause()` / `resume()` drain in-flight tasks first; queued tasks resume only after `resume()`.
- Shared buffers (`createSharedBuffer`) require `crossOriginIsolated` and the right COOP/COEP headers.

## Performance notes

- Use pool priorities to keep interactive work ahead of background batches.
- Reactive metrics (`pool.metrics`) are rolling — read them inside `effect()` to throttle dashboards.
- For one-shot tasks, prefer `runTask()` over spinning up a long-lived worker.

## Testing this module

- `bun:test` runs in a single worker; assert pool behavior with `pool.onIdle()` to await drain.
- `mockFetch()` from testing is unaffected by workers — use the main-thread fetch wrapper.

## Related modules

- [Reactive](./reactive) — wrap pools in reactive metrics.
- [Devtools](./devtools) — surface pool metrics on the timeline.
- [Server](./server) — offload heavy SSR work to a pool when needed.

## Version history

- **1.15.0** — CSP-safe module workers (`defineWorker` / `defineRpcWorker` / `exposeTask` / `exposeRpc` / `isWorkerModule` / `isModuleWorkerSupported`), client UI-scheduling primitives (`suspense` / `startTransition` / `deferred`); module graduates toward **Stable**.
- **1.14.0** — `withTransferables`, `createSharedBuffer`, RPC `maxInFlight`, pool priorities, `pause` / `resume` / `onIdle`, rolling reactive metrics.
- **1.10.0** — zero-build worker tasks, RPC dispatch, reactive wrappers, support detection, timeout/abort.
