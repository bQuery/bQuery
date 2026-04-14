# Concurrency

The concurrency module adds a small, explicit browser-side worker layer for bQuery's zero-build model.

It is intentionally narrower than `threadts-universal`: the current milestones focus on **safe task execution**, **explicit RPC-style method dispatch**, **bounded pools/queueing**, **lifecycle cleanup**, **timeout/abort handling**, and **support detection** without introducing decorators, implicit proxies, or runtime-specific adapters that would bloat the package.

## Import

```ts
import {
  batchTasks,
  createTaskWorker,
  createTaskPool,
  createRpcWorker,
  createRpcPool,
  callWorkerMethod,
  every,
  filter,
  find,
  getConcurrencySupport,
  isConcurrencySupported,
  map,
  parallel,
  pipeline,
  reduce,
  runTask,
  some,
} from '@bquery/bquery/concurrency';
```

## Current scope

### Included now

- One-off worker execution via `runTask()`
- Reusable single-task workers via `createTaskWorker()`
- Reusable task pools via `createTaskPool()`
- Named request/response dispatch via `createRpcWorker()`
- One-off RPC method execution via `callWorkerMethod()`
- Reusable RPC pools via `createRpcPool()`
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

### Planned for later milestones

- Reactive bindings around worker state

### Intentionally out of scope for bQuery

- Node/Deno/Bun-specific worker adapters in the browser-focused package
- Decorator-heavy APIs
- Implicit bundler glue or code generation that breaks zero-build usage

## ThreadTS parity matrix

| Feature group | `threadts-universal` | bQuery status |
| --- | --- | --- |
| One-off task execution | `run()` | **Supported** via `runTask()` |
| Explicit reusable workers | low-level worker APIs | **Supported** via `createTaskWorker()` |
| Explicit RPC dispatch | named methods / adapters | **Supported** via `createRpcWorker()` and `callWorkerMethod()` |
| Pools + queueing | auto-scaling pools / priority queues | **Adapted** via `createTaskPool()` and `createRpcPool()` with explicit bounded concurrency + FIFO queueing |
| Worker lifecycle | termination / reuse | **Supported** with explicit `terminate()` on workers and pools |
| Timeout + cancellation | supported | **Supported** via `timeout` and `AbortSignal` |
| Support detection | runtime-dependent | **Supported** via `getConcurrencySupport()` / `isConcurrencySupported()` |
| Array / batch / collection helpers | broad high-level surface | **Adapted** via `parallel()`, `batchTasks()`, `map()`, `filter()`, `reduce()`, `some()`, `every()`, and `find()` |
| Fluent pipelines | pipeline builders | **Adapted** via `pipeline()` as an optional fluent layer over the existing collection helpers |
| Decorators / implicit magic | broad decorator suite | **Not adopted**; conflicts with bQuery's explicit, lightweight browser-first design |
| Node / Deno / Bun adapters | universal runtime adapters | **Not adopted** in this browser-focused package |

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
- The current Milestone 2 API still processes **one call at a time per worker**
- Timeout and abort handling reset the worker so the next call starts cleanly

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
  { handler: ({ first, last }: { first: string; last: string }) => `${last}, ${first}`, input: { first: 'Ada', last: 'Lovelace' } },
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

const results = await map(
  [1, 2, 3, 4],
  (value, index) => value + index,
  { batchSize: 2, concurrency: 2 }
);

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

const results = await filter(
  [5, 2, 9, 4],
  (value, index) => value % 2 === 1 && index < 3,
  { batchSize: 2, concurrency: 2 }
);

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

- Task handlers must be **standalone functions**; they cannot rely on outer closures
- The module currently targets **browser worker primitives** (`Worker`, `Blob`, `URL.createObjectURL`)
- CSP setups may need `worker-src blob:` for inline worker creation
- Stricter CSP policies may also require allowing `'unsafe-eval'` because handler
  validation/revival uses `new Function(...)` on the main thread and inside worker scripts
- If your environment forbids dynamic evaluation, avoid the concurrency module in that deployment
- Reactive worker-state bindings remain intentionally deferred to later milestones
