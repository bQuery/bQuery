/**
 * Optional concurrency helpers built on zero-build Web Workers.
 *
 * The concurrency surface intentionally stays browser-first and explicit:
 * worker tasks, RPC helpers, bounded pools, and thin high-level helpers
 * without decorators, hidden global runtimes, or build-time worker glue.
 *
 * @module bquery/concurrency
 */

export {
  TaskWorkerAbortError,
  TaskWorkerError,
  TaskWorkerSerializationError,
  TaskWorkerTimeoutError,
  TaskWorkerUnsupportedError,
} from './errors';
export { createSharedBuffer, withTransferables } from './helpers';
export { batchTasks, every, filter, find, map, parallel, reduce, some } from './high-level';
export {
  defineRpcWorker,
  defineWorker,
  exposeRpc,
  exposeTask,
  isWorkerModule,
} from './module-worker';
export { pipeline } from './pipeline';
export { createRpcPool, createTaskPool } from './pool';
export {
  createReactiveRpcPool,
  createReactiveRpcWorker,
  createReactiveTaskPool,
  createReactiveTaskWorker,
} from './reactive';
export { callWorkerMethod, createRpcWorker } from './rpc';
export { deferred, startTransition, suspense } from './scheduling';
export { getConcurrencySupport, isConcurrencySupported, isModuleWorkerSupported } from './support';
export { createTaskWorker, runTask } from './task';

export type {
  CallWorkerMethodOptions,
  ConcurrencyRuntime,
  ConcurrencyPipeline,
  ConcurrencyPipelineOptions,
  ConcurrencySupport,
  DefineWorkerOptions,
  DeferredOptions,
  DeferredSource,
  PoolMetrics,
  CreateRpcPoolOptions,
  CreateRpcWorkerOptions,
  CreateTaskPoolOptions,
  CreateTaskWorkerOptions,
  ParallelCollectionOptions,
  ParallelMapHandler,
  ParallelMapOptions,
  ParallelOptions,
  ParallelPredicateHandler,
  ParallelReduceHandler,
  ParallelResults,
  ParallelTask,
  ReactiveRpcPool,
  ReactiveRpcWorker,
  ReactiveTaskPool,
  ReactiveTaskWorker,
  RpcPool,
  RpcWorker,
  RpcWorkerModule,
  RunTaskOptions,
  SuspendableState,
  SuspenseBoundary,
  SuspenseOptions,
  SuspenseSource,
  TaskPool,
  TaskRunOptions,
  TaskWorker,
  TaskWorkerErrorCode,
  TaskWorkerState,
  StartTransitionOptions,
  Transition,
  TransitionStart,
  WorkerExecutionMode,
  WorkerHostScope,
  WorkerModule,
  WorkerRpcHandler,
  WorkerRpcHandlers,
  WorkerRpcSource,
  WorkerTaskHandler,
  WorkerTaskSource,
} from './types';
