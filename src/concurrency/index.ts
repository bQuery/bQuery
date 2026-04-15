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
export { batchTasks, every, filter, find, map, parallel, reduce, some } from './high-level';
export { pipeline } from './pipeline';
export { createRpcPool, createTaskPool } from './pool';
export {
  createReactiveRpcPool,
  createReactiveRpcWorker,
  createReactiveTaskPool,
  createReactiveTaskWorker,
} from './reactive';
export { callWorkerMethod, createRpcWorker } from './rpc';
export { getConcurrencySupport, isConcurrencySupported } from './support';
export { createTaskWorker, runTask } from './task';

export type {
  CallWorkerMethodOptions,
  ConcurrencyPipeline,
  ConcurrencyPipelineOptions,
  ConcurrencySupport,
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
  RunTaskOptions,
  TaskPool,
  TaskRunOptions,
  TaskWorker,
  TaskWorkerErrorCode,
  TaskWorkerState,
  WorkerRpcHandler,
  WorkerRpcHandlers,
  WorkerTaskHandler,
} from './types';
