/**
 * Public types for the concurrency module.
 *
 * @module bquery/concurrency
 */

/**
 * Standalone task handler executed inside a Web Worker.
 *
 * The function must be self-contained because it is stringified and evaluated
 * in the worker context without access to outer closures.
 *
 * @example
 * ```ts
 * const square = (value: number) => value * value;
 * ```
 */
export type WorkerTaskHandler<TInput = void, TResult = unknown> = (
  input: TInput
) => TResult | Promise<TResult>;

/** Lifecycle state of a reusable task worker. */
export type TaskWorkerState = 'idle' | 'running' | 'terminated';

/** Structured error codes emitted by the concurrency module. */
export type TaskWorkerErrorCode =
  | 'ABORT'
  | 'BUSY'
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
   * Default timeout applied to `run()` calls when the run itself does not
   * override it.
   */
  timeout?: number;
}

/** Options accepted by the one-off `runTask()` helper. */
export interface RunTaskOptions extends CreateTaskWorkerOptions, TaskRunOptions {}

/** Options for creating a reusable RPC worker. */
export type CreateRpcWorkerOptions = CreateTaskWorkerOptions;

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
  /** `Worker` constructor availability. */
  worker: boolean;
  /** `Blob` availability for zero-build inline worker scripts. */
  blob: boolean;
  /** `URL.createObjectURL()` availability. */
  objectUrl: boolean;
  /** `AbortController` availability for cancellation ergonomics. */
  abortController: boolean;
  /** Whether the minimum browser primitives for this module are present. */
  supported: boolean;
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

/** Standalone named RPC handler executed inside a Web Worker. */
export type WorkerRpcHandler<TInput = void, TResult = unknown> = WorkerTaskHandler<TInput, TResult>;

/** Explicit map of named worker RPC handlers. */
export type WorkerRpcHandlers = Record<string, WorkerRpcHandler<unknown, unknown>>;

/** Reusable RPC-style worker handle with named method dispatch. */
export interface RpcWorker<TRoutes extends WorkerRpcHandlers = WorkerRpcHandlers> {
  /** Current lifecycle state. */
  readonly state: TaskWorkerState;
  /** Whether a method call is currently in progress. */
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
  /**
   * Permanently terminate the pool and all backing workers.
   * Active and queued tasks reject with termination errors.
   */
  terminate(): void;
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
  /**
   * Permanently terminate the pool and all backing workers.
   * Active and queued calls reject with termination errors.
   */
  terminate(): void;
}
