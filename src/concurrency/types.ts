/**
 * Public types for the concurrency module.
 *
 * @module bquery/concurrency
 */

import type { MaybeSignal, ReadonlySignalHandle } from '../reactive/index';

/**
 * Standalone task handler executed inside a Web Worker.
 *
 * The function must be self-contained because it is stringified and evaluated
 * in the worker context without access to outer closures.
 *
 * The bivariance wrapper is intentional: TypeScript checks plain function
 * parameter types contravariantly under `strictFunctionTypes`, but method
 * signatures remain bivariant. Modeling the public handler as a method-shaped
 * signature keeps object-literal task and RPC handlers ergonomic in strict
 * typechecks, including the repository's dedicated test typecheck. In practice
 * this allows narrower inline handler parameter annotations in object literals;
 * the trade-off is that assignability here is intentionally a little less strict
 * than a plain function-type alias would be.
 *
 * @example
 * ```ts
 * const square = (value: number) => value * value;
 * ```
 */
export type WorkerTaskHandler<TInput = void, TResult = unknown> = {
  bivarianceHack(input: TInput): TResult | Promise<TResult>;
}['bivarianceHack'];

/** Lifecycle state of a reusable task worker. */
export type TaskWorkerState = 'idle' | 'running' | 'terminated';

/** Supported concurrency runtime identifiers. */
export type ConcurrencyRuntime = 'auto' | 'browser' | 'bun' | 'deno' | 'node' | 'unknown';

/** Structured error codes emitted by the concurrency module. */
export type TaskWorkerErrorCode =
  | 'ABORT'
  | 'BUSY'
  | 'CONCURRENT_LIMIT'
  | 'METHOD_NOT_FOUND'
  | 'QUEUE_CLEARED'
  | 'QUEUE_FULL'
  | 'SERIALIZATION'
  | 'TERMINATED'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'WORKER';

/** Per-run options for worker task execution. */
export interface TaskRunOptions {
  /**
   * AbortSignal used to cancel the current run.
   * Cancellation terminates the active worker run so later runs start cleanly.
   */
  signal?: AbortSignal;
  /**
   * Optional timeout in milliseconds.
   * Non-finite or non-positive values disable timeout handling.
   */
  timeout?: number;
  /**
   * Optional queue priority for pool-backed execution.
   * Higher values run sooner; equal priorities stay FIFO.
   */
  priority?: number;
  /**
   * Transferable values passed together with the task payload.
   * Use this for large `ArrayBuffer`-backed payloads when appropriate.
   */
  transfer?: Transferable[];
}

/** Options for creating a reusable task worker. */
export interface CreateTaskWorkerOptions {
  /** Optional worker name shown in browser tooling where supported. */
  name?: string;
  /**
   * Runtime override used for feature-detection and tests.
   * @default 'auto'
   */
  runtime?: ConcurrencyRuntime;
  /**
   * Default timeout applied to `run()` calls when the run itself does not
   * override it.
   */
  timeout?: number;
}

/** Options accepted by the one-off `runTask()` helper. */
export interface RunTaskOptions extends CreateTaskWorkerOptions, TaskRunOptions {}

/** Options for creating a reusable RPC worker. */
export interface CreateRpcWorkerOptions extends CreateTaskWorkerOptions {
  /**
   * Maximum number of in-flight RPC calls allowed on a single worker.
   * @default 1
   */
  maxInFlight?: number;
}

/** Options accepted by the one-off RPC method helper. */
export interface CallWorkerMethodOptions extends CreateRpcWorkerOptions, TaskRunOptions {}

/** Options for creating a reusable task worker pool. */
export interface CreateTaskPoolOptions extends CreateTaskWorkerOptions {
  /** Maximum number of workers executing tasks in parallel (default: 4). */
  concurrency?: number;
  /**
   * Maximum number of not-yet-started tasks kept in the queue.
   * Use `0` to disable queueing or `Infinity` for an unbounded queue.
   */
  maxQueue?: number;
}

/** Options for creating a reusable RPC worker pool. */
export interface CreateRpcPoolOptions extends CreateRpcWorkerOptions {
  /** Maximum number of workers executing calls in parallel (default: 4). */
  concurrency?: number;
  /**
   * Maximum number of not-yet-started calls kept in the queue.
   * Use `0` to disable queueing or `Infinity` for an unbounded queue.
   */
  maxQueue?: number;
}

/** Standalone task descriptor for `parallel()` / `batchTasks()`. */
export interface ParallelTask<TInput = unknown, TResult = unknown> {
  /** Standalone handler revived inside a worker context. */
  handler: WorkerTaskHandler<TInput, TResult>;
  /** Serializable payload for the handler. */
  input: TInput;
  /** Optional per-task timeout, abort, and transfer options. */
  options?: TaskRunOptions;
}

/** Shared pool options for high-level parallel task helpers. */
export type ParallelOptions = CreateTaskPoolOptions;

/** Shared options for chunked collection helpers such as `map()` and `filter()`. */
export interface ParallelCollectionOptions extends CreateTaskPoolOptions {
  /**
   * Number of array items grouped into each worker run.
   * Defaults to `1`.
   */
  batchSize?: number;
  /** AbortSignal shared across all queued or running chunks. */
  signal?: AbortSignal;
}

/** Callback signature used by `map()` for parallel array processing. */
export type ParallelMapHandler<TInput, TResult> = (
  value: TInput,
  index: number
) => TResult | Promise<TResult>;

/** Callback signature used by predicate-style helpers such as `filter()`. */
export type ParallelPredicateHandler<TInput> = (
  value: TInput,
  index: number
) => boolean | Promise<boolean>;

/** Callback signature used by `reduce()` for sequential accumulation inside a worker. */
export type ParallelReduceHandler<TAccumulator, TInput> = (
  accumulator: TAccumulator,
  value: TInput,
  index: number
) => TAccumulator | Promise<TAccumulator>;

/** Options for `map()` chunking and cancellation behavior. */
export type ParallelMapOptions = ParallelCollectionOptions;

/** Shared defaults for the optional fluent concurrency pipeline. */
export type ConcurrencyPipelineOptions = ParallelCollectionOptions;

/**
 * Optional fluent pipeline over the existing explicit collection helpers.
 *
 * The pipeline is immutable: each transforming stage returns a new pipeline
 * instead of mutating the previous one in place.
 */
export interface ConcurrencyPipeline<TValue> {
  /**
   * Maps the current array value through the existing worker-backed `map()` helper.
   */
  map<TResult>(
    mapper: ParallelMapHandler<TValue, TResult>,
    options?: ParallelCollectionOptions
  ): ConcurrencyPipeline<TResult>;
  /**
   * Filters the current array value through the existing worker-backed `filter()` helper.
   */
  filter(
    predicate: ParallelPredicateHandler<TValue>,
    options?: ParallelCollectionOptions
  ): ConcurrencyPipeline<TValue>;
  /**
   * Resolves the pipeline to a materialized array.
   */
  toArray(): Promise<TValue[]>;
  /**
   * Evaluates whether at least one item matches via the existing `some()` helper.
   */
  some(
    predicate: ParallelPredicateHandler<TValue>,
    options?: ParallelCollectionOptions
  ): Promise<boolean>;
  /**
   * Evaluates whether every item matches via the existing `every()` helper.
   */
  every(
    predicate: ParallelPredicateHandler<TValue>,
    options?: ParallelCollectionOptions
  ): Promise<boolean>;
  /**
   * Finds the first matching item via the existing `find()` helper.
   */
  find(
    predicate: ParallelPredicateHandler<TValue>,
    options?: ParallelCollectionOptions
  ): Promise<TValue | undefined>;
  /**
   * Reduces the current array value via the existing `reduce()` helper.
   */
  reduce<TAccumulator>(
    reducer: ParallelReduceHandler<TAccumulator, TValue>,
    initialValue: TAccumulator,
    options?: TaskRunOptions
  ): Promise<TAccumulator>;
}

/** Result tuple inferred from a `parallel()` or `batchTasks()` task list. */
export type ParallelResults<TTasks extends readonly ParallelTask<unknown, unknown>[]> = {
  [TIndex in keyof TTasks]: TTasks[TIndex] extends ParallelTask<unknown, infer TResult>
    ? Awaited<TResult>
    : never;
};

/** Feature-detection snapshot for the browser concurrency runtime. */
export interface ConcurrencySupport {
  /** Detected runtime identifier. */
  runtime: Exclude<ConcurrencyRuntime, 'auto'>;
  /** `Worker` constructor availability. */
  worker: boolean;
  /** `Blob` availability for zero-build inline worker scripts. */
  blob: boolean;
  /** `URL.createObjectURL()` and `URL.revokeObjectURL()` availability. */
  objectUrl: boolean;
  /**
   * Whether CSP-safe module workers can be created.
   *
   * Module workers only require the `Worker` constructor, so they are
   * available under a strict CSP without `'unsafe-eval'` or `blob:` sources.
   */
  moduleWorker: boolean;
  /** `AbortController` availability for cancellation ergonomics. */
  abortController: boolean;
  /** `SharedArrayBuffer` availability for shared-memory workflows. */
  sharedArrayBuffer: boolean;
  /** Whether the page/runtime is cross-origin isolated. */
  crossOriginIsolated: boolean;
  /** Whether the minimum browser primitives for this module are present. */
  supported: boolean;
}

/** Rolling task-pool metrics exposed by reactive wrappers. */
export interface PoolMetrics {
  /** Total completed runs/calls. */
  completed: number;
  /** Total failed or rejected runs/calls. */
  failed: number;
  /** Average observed runtime in milliseconds for completed work. */
  avgRuntimeMs: number;
  /** Approximate p95 observed runtime in milliseconds for completed work. */
  p95RuntimeMs: number;
}

/**
 * Reusable worker-task handle.
 *
 * A task worker runs one task at a time. Queueing and pooling live in the
 * separate `TaskPool` / `RpcPool` APIs so the worker handle itself stays explicit.
 */
export interface TaskWorker<TInput = void, TResult = unknown> {
  /** Current lifecycle state. */
  readonly state: TaskWorkerState;
  /** Whether a task is currently running. */
  readonly busy: boolean;
  /**
   * Execute one task in the backing worker.
   *
   * @param input - Serializable input passed to the task handler
   * @param options - Per-run timeout, abort, and transfer options
   */
  run(input: TInput, options?: TaskRunOptions): Promise<TResult>;
  /**
   * Permanently terminate the backing worker.
   * Any in-flight task is rejected with a termination error.
   */
  terminate(): void;
}

/**
 * Reactive wrapper around a reusable task worker.
 *
 * Extends the standard {@link TaskWorker} API with readonly signals so UI code
 * can observe worker lifecycle changes without polling getters manually.
 */
export interface ReactiveTaskWorker<TInput = void, TResult = unknown> extends TaskWorker<
  TInput,
  TResult
> {
  /** Reactive mirror of {@link TaskWorker.state}. */
  readonly state$: ReadonlySignalHandle<TaskWorkerState>;
  /** Reactive mirror of {@link TaskWorker.busy}. */
  readonly busy$: ReadonlySignalHandle<boolean>;
}

/** Standalone named RPC handler executed inside a Web Worker. */
export type WorkerRpcHandler<TInput = void, TResult = unknown> = WorkerTaskHandler<TInput, TResult>;

/** Explicit map of named worker RPC handlers. */
export type WorkerRpcHandlers = Record<string, WorkerRpcHandler<unknown, unknown>>;

/** Reusable RPC-style worker handle with named method dispatch. */
export interface RpcWorker<TRoutes extends WorkerRpcHandlers = WorkerRpcHandlers> {
  /** Current lifecycle state. */
  readonly state: TaskWorkerState;
  /** Whether the worker is currently at capacity for additional method calls. */
  readonly busy: boolean;
  /**
   * Call one named RPC method in the backing worker.
   *
   * @param method - Method name from the provided RPC handler map
   * @param input - Serializable payload for the selected method
   * @param options - Per-call timeout, abort, and transfer options
   */
  call<TMethod extends keyof TRoutes & string>(
    method: TMethod,
    input: Parameters<TRoutes[TMethod]>[0],
    options?: TaskRunOptions
  ): Promise<Awaited<ReturnType<TRoutes[TMethod]>>>;
  /**
   * Permanently terminate the backing worker.
   * Any in-flight call is rejected with a termination error.
   */
  terminate(): void;
}

/**
 * Reactive wrapper around a reusable RPC worker.
 *
 * Extends the standard {@link RpcWorker} API with readonly signals so UI code
 * can observe worker lifecycle changes without polling getters manually.
 */
export interface ReactiveRpcWorker<
  TRoutes extends WorkerRpcHandlers = WorkerRpcHandlers,
> extends RpcWorker<TRoutes> {
  /** Reactive mirror of {@link RpcWorker.state}. */
  readonly state$: ReadonlySignalHandle<TaskWorkerState>;
  /** Reactive mirror of {@link RpcWorker.busy}. */
  readonly busy$: ReadonlySignalHandle<boolean>;
}

/** Reusable pool of task workers with bounded concurrency and queueing. */
export interface TaskPool<TInput = void, TResult = unknown> {
  /** Current lifecycle state. */
  readonly state: TaskWorkerState;
  /** Whether the pool has active or queued tasks. */
  readonly busy: boolean;
  /** Maximum number of parallel worker runs. */
  readonly concurrency: number;
  /** Number of tasks currently running. */
  readonly pending: number;
  /** Number of tasks currently waiting in the queue. */
  readonly size: number;
  /** Whether queue dispatch is paused. */
  readonly paused: boolean;
  /** Rolling runtime metrics for finished work. */
  readonly metrics: PoolMetrics;
  /**
   * Queue or immediately execute one task in the pool.
   *
   * @param input - Serializable task input
   * @param options - Per-run timeout, abort, and transfer options
   */
  run(input: TInput, options?: TaskRunOptions): Promise<TResult>;
  /**
   * Remove queued tasks that have not started yet.
   * Active tasks continue running.
   */
  clear(): void;
  /** Pause queued work dispatch without interrupting active tasks. */
  pause(): void;
  /** Resume queued work dispatch after a previous `pause()`. */
  resume(): void;
  /** Resolves once there are no running or queued tasks left. */
  onIdle(): Promise<void>;
  /**
   * Permanently terminate the pool and all backing workers.
   * Active and queued tasks reject with termination errors.
   */
  terminate(): void;
}

/**
 * Reactive wrapper around a reusable task pool.
 *
 * Extends the standard {@link TaskPool} API with readonly signals for pool
 * state, queue pressure, and configured concurrency.
 */
export interface ReactiveTaskPool<TInput = void, TResult = unknown> extends TaskPool<
  TInput,
  TResult
> {
  /** Reactive mirror of {@link TaskPool.state}. */
  readonly state$: ReadonlySignalHandle<TaskWorkerState>;
  /** Reactive mirror of {@link TaskPool.busy}. */
  readonly busy$: ReadonlySignalHandle<boolean>;
  /** Reactive mirror of {@link TaskPool.concurrency}. */
  readonly concurrency$: ReadonlySignalHandle<number>;
  /** Reactive mirror of {@link TaskPool.pending}. */
  readonly pending$: ReadonlySignalHandle<number>;
  /** Reactive mirror of {@link TaskPool.size}. */
  readonly size$: ReadonlySignalHandle<number>;
  /** Reactive mirror of {@link TaskPool.paused}. */
  readonly paused$: ReadonlySignalHandle<boolean>;
  /** Reactive mirror of {@link TaskPool.metrics}. */
  readonly metrics$: ReadonlySignalHandle<PoolMetrics>;
}

/** Reusable pool of RPC workers with bounded concurrency and queueing. */
export interface RpcPool<TRoutes extends WorkerRpcHandlers = WorkerRpcHandlers> {
  /** Current lifecycle state. */
  readonly state: TaskWorkerState;
  /** Whether the pool has active or queued calls. */
  readonly busy: boolean;
  /** Maximum number of parallel worker calls. */
  readonly concurrency: number;
  /** Number of calls currently running. */
  readonly pending: number;
  /** Number of calls currently waiting in the queue. */
  readonly size: number;
  /** Whether queue dispatch is paused. */
  readonly paused: boolean;
  /** Rolling runtime metrics for finished work. */
  readonly metrics: PoolMetrics;
  /**
   * Queue or immediately execute one RPC call in the pool.
   *
   * @param method - Method name from the provided RPC handler map
   * @param input - Serializable payload for the selected method
   * @param options - Per-call timeout, abort, and transfer options
   */
  call<TMethod extends keyof TRoutes & string>(
    method: TMethod,
    input: Parameters<TRoutes[TMethod]>[0],
    options?: TaskRunOptions
  ): Promise<Awaited<ReturnType<TRoutes[TMethod]>>>;
  /**
   * Remove queued calls that have not started yet.
   * Active calls continue running.
   */
  clear(): void;
  /** Pause queued work dispatch without interrupting active calls. */
  pause(): void;
  /** Resume queued work dispatch after a previous `pause()`. */
  resume(): void;
  /** Resolves once there are no running or queued calls left. */
  onIdle(): Promise<void>;
  /**
   * Permanently terminate the pool and all backing workers.
   * Active and queued calls reject with termination errors.
   */
  terminate(): void;
}

/**
 * Reactive wrapper around a reusable RPC pool.
 *
 * Extends the standard {@link RpcPool} API with readonly signals for pool
 * state, queue pressure, and configured concurrency.
 */
export interface ReactiveRpcPool<
  TRoutes extends WorkerRpcHandlers = WorkerRpcHandlers,
> extends RpcPool<TRoutes> {
  /** Reactive mirror of {@link RpcPool.state}. */
  readonly state$: ReadonlySignalHandle<TaskWorkerState>;
  /** Reactive mirror of {@link RpcPool.busy}. */
  readonly busy$: ReadonlySignalHandle<boolean>;
  /** Reactive mirror of {@link RpcPool.concurrency}. */
  readonly concurrency$: ReadonlySignalHandle<number>;
  /** Reactive mirror of {@link RpcPool.pending}. */
  readonly pending$: ReadonlySignalHandle<number>;
  /** Reactive mirror of {@link RpcPool.size}. */
  readonly size$: ReadonlySignalHandle<number>;
  /** Reactive mirror of {@link RpcPool.paused}. */
  readonly paused$: ReadonlySignalHandle<boolean>;
  /** Reactive mirror of {@link RpcPool.metrics}. */
  readonly metrics$: ReadonlySignalHandle<PoolMetrics>;
}

// ============================================================================
// CSP-safe module workers (#134)
// ============================================================================

/**
 * Worker script type passed to the `Worker` constructor.
 *
 * Mirrors the DOM `WorkerType`. `'module'` is the CSP-safe default: it loads a
 * pre-bundled worker script by URL instead of reviving a serialized function
 * body with `new Function(...)`, so it needs neither `'unsafe-eval'` nor a
 * `blob:` worker source.
 */
export type WorkerExecutionMode = 'classic' | 'module';

/** Options accepted by {@link WorkerModule} factories. */
export interface DefineWorkerOptions {
  /**
   * Worker script type.
   * @default 'module'
   */
  type?: WorkerExecutionMode;
}

declare const WORKER_TASK_PHANTOM: unique symbol;
declare const WORKER_RPC_PHANTOM: unique symbol;

/**
 * CSP-safe reference to a pre-registered task worker module addressed by URL.
 *
 * Produced by `defineWorker(new URL('./x.worker.ts', import.meta.url))`. Unlike
 * function handlers, a module worker is never stringified or revived with
 * `new Function(...)`, so it runs under a strict Content-Security-Policy without
 * `'unsafe-eval'`. The worker script wires itself up with `exposeTask()`.
 *
 * @template TInput - Serializable input passed to the worker handler
 * @template TResult - Result resolved by the worker handler
 */
export interface WorkerModule<TInput = unknown, TResult = unknown> {
  /** Resolved worker script URL. */
  readonly url: string | URL;
  /** Worker script type passed to the `Worker` constructor. */
  readonly type: WorkerExecutionMode;
  /** Phantom signature used purely for input/result inference. @internal */
  readonly [WORKER_TASK_PHANTOM]?: (input: TInput) => TResult;
}

/**
 * CSP-safe reference to a pre-registered RPC worker module addressed by URL.
 *
 * Produced by `defineRpcWorker(...)`. The worker script wires its named methods
 * up with `exposeRpc()`.
 *
 * @template TRoutes - Map of named RPC handlers implemented by the worker module
 */
export interface RpcWorkerModule<TRoutes extends WorkerRpcHandlers = WorkerRpcHandlers> {
  /** Resolved worker script URL. */
  readonly url: string | URL;
  /** Worker script type passed to the `Worker` constructor. */
  readonly type: WorkerExecutionMode;
  /** Phantom routes used purely for method inference. @internal */
  readonly [WORKER_RPC_PHANTOM]?: TRoutes;
}

/**
 * Accepted task source: either an inline standalone handler (dynamic mode,
 * needs `'unsafe-eval'`) or a CSP-safe {@link WorkerModule} (module mode).
 */
export type WorkerTaskSource<TInput = void, TResult = unknown> =
  WorkerTaskHandler<TInput, TResult> | WorkerModule<TInput, TResult>;

/**
 * Accepted RPC source: either an inline map of standalone handlers (dynamic
 * mode) or a CSP-safe {@link RpcWorkerModule} (module mode).
 */
export type WorkerRpcSource<TRoutes extends WorkerRpcHandlers = WorkerRpcHandlers> =
  TRoutes | RpcWorkerModule<TRoutes>;

/**
 * Minimal worker global-scope surface used by `exposeTask()` / `exposeRpc()`.
 *
 * Defaults to the ambient worker `self`; pass one explicitly to host the worker
 * protocol on a `MessagePort`, a `SharedWorker` connection, or a test double.
 */
export interface WorkerHostScope {
  /** Incoming-message handler installed by the host helper. */
  onmessage: ((event: { data: unknown }) => void) | null;
  /** Posts a serializable response back to the controlling thread. */
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

// ============================================================================
// Client async-concurrency primitives (#135)
// ============================================================================

/** A reactive or plain value readable by {@link deferred}. */
export type DeferredSource<T> = MaybeSignal<T> | (() => T);

/**
 * Options for {@link startTransition}.
 *
 * Named `StartTransitionOptions` (not `TransitionOptions`) to avoid colliding
 * with the `motion` module's `TransitionOptions` in the flat `/full` bundle.
 */
export interface StartTransitionOptions {
  /**
   * Delay in milliseconds before the non-urgent scope runs. `0` schedules the
   * work on the next idle callback (or macrotask) without an explicit delay.
   * @default 0
   */
  timeout?: number;
}

/** Schedules a non-urgent update produced by {@link startTransition}. */
export type TransitionStart = (scope: () => void) => void;

/**
 * Tuple returned by {@link startTransition}: a readonly `isPending` signal and
 * a `start` function that marks an update as non-urgent.
 */
export type Transition = readonly [ReadonlySignalHandle<boolean>, TransitionStart];

/** Options for {@link deferred}. */
export interface DeferredOptions {
  /**
   * Maximum time in milliseconds the deferred value may lag behind its source.
   * When omitted, the deferred value updates on the next idle callback (or
   * macrotask). Rapid source changes coalesce into a single trailing update.
   */
  timeout?: number;
}

/**
 * A reactive source that {@link suspense} can treat as pending work: a
 * `Promise`, an `AsyncDataState`-style object exposing a reactive `pending`
 * (and optional `error`) signal, or a plain pending getter.
 */
export interface SuspendableState {
  /** Reactive `pending` flag (e.g. from `useAsyncData()` / `useResource()`). */
  readonly pending: { readonly value: boolean };
  /** Optional reactive error mirror surfaced through the boundary. */
  readonly error?: { readonly value: Error | null };
}

/** Anything {@link suspense} can await: a promise, a reactive state, or a getter. */
export type SuspenseSource = Promise<unknown> | SuspendableState | (() => boolean);

/** Options for {@link suspense}. */
export interface SuspenseOptions {
  /**
   * When `true` (default) a settled boundary that later becomes pending again
   * re-enters the pending state. Set `false` to latch `settled` after the first
   * resolution.
   */
  retrigger?: boolean;
}

/**
 * Declarative async boundary handle produced by {@link suspense}.
 *
 * Aggregates one or more async sources into reactive `pending` / `settled` /
 * `error` signals so the view layer can swap fallback and content without
 * bespoke loading flags.
 */
export interface SuspenseBoundary {
  /** `true` while any tracked source is still pending. */
  readonly pending: ReadonlySignalHandle<boolean>;
  /** `true` once every tracked source has settled at least once. */
  readonly settled: ReadonlySignalHandle<boolean>;
  /** First error surfaced by a tracked source, or `null`. */
  readonly error: ReadonlySignalHandle<Error | null>;
  /** Detach internal effects and promise listeners. */
  dispose(): void;
}
