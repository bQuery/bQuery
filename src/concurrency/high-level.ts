/**
 * Thin high-level helpers layered on top of the explicit worker primitives.
 *
 * @module bquery/concurrency
 */

import { createTaskPool } from './pool';
import { runTask } from './task';
import { validateTaskHandler } from './internal';
import type {
  ParallelCollectionOptions,
  ParallelMapHandler,
  ParallelMapOptions,
  ParallelOptions,
  ParallelPredicateHandler,
  ParallelReduceHandler,
  ParallelResults,
  ParallelTask,
  TaskPool,
  TaskRunOptions,
  WorkerTaskHandler,
} from './types';

interface SerializedParallelTask {
  handlerSource: string;
  input: unknown;
}

interface SerializedChunk<TInput = unknown> {
  items: Array<{
    index: number;
    value: TInput;
  }>;
  handlerSource: string;
}

interface IndexedMapResult<TResult> {
  index: number;
  value: TResult;
}

const executeSerializedTask = async (job: SerializedParallelTask): Promise<unknown> => {
  const revive = new Function(`return (${job.handlerSource});`);
  const handler = revive() as ((input: unknown) => unknown | Promise<unknown>) | undefined;

  if (typeof handler !== 'function') {
    throw new TypeError('The serialized task handler did not revive as a function.');
  }

  return await handler(job.input);
};

interface SerializedReduceJob<TInput = unknown, TAccumulator = unknown> {
  initialValue: TAccumulator;
  reducerSource: string;
  values: readonly TInput[];
}

const executeSerializedChunk = async (
  job: SerializedChunk
): Promise<Array<IndexedMapResult<unknown>>> => {
  const revive = new Function(`return (${job.handlerSource});`);
  const handler = revive() as ((value: unknown, index: number) => unknown | Promise<unknown>) | undefined;

  if (typeof handler !== 'function') {
    throw new TypeError('The serialized collection handler did not revive as a function.');
  }

  const results: Array<IndexedMapResult<unknown>> = [];
  for (const item of job.items) {
    results.push({
      index: item.index,
      value: await handler(item.value, item.index),
    });
  }

  return results;
};

const executeSerializedReduce = async (job: SerializedReduceJob): Promise<unknown> => {
  const revive = new Function(`return (${job.reducerSource});`);
  const reducer = revive() as
    | ((accumulator: unknown, value: unknown, index: number) => unknown | Promise<unknown>)
    | undefined;

  if (typeof reducer !== 'function') {
    throw new TypeError('The serialized reducer did not revive as a function.');
  }

  let accumulator = job.initialValue;
  for (let index = 0; index < job.values.length; index++) {
    accumulator = await reducer(accumulator, job.values[index], index);
  }

  return accumulator;
};

const normalizeBatchSize = (batchSize: number | undefined, label: string): number => {
  if (batchSize === undefined) {
    return 1;
  }

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`${label} batchSize must be a positive integer.`);
  }

  return batchSize;
};

const createSerializedTaskPool = (options: ParallelOptions): TaskPool<SerializedParallelTask, unknown> => {
  return createTaskPool(executeSerializedTask, options);
};

const serializeTask = <TInput, TResult>(task: ParallelTask<TInput, TResult>): SerializedParallelTask => ({
  handlerSource: validateTaskHandler(task.handler),
  input: task.input,
});

const runChunkedHandler = async <TInput, TResult>(
  values: readonly TInput[],
  handler: (value: TInput, index: number) => TResult | Promise<TResult>,
  options: ParallelCollectionOptions = {},
  label: string
): Promise<TResult[]> => {
  if (values.length === 0) {
    return [];
  }

  const handlerSource = validateTaskHandler(handler as unknown as WorkerTaskHandler<TInput, TResult>);
  const normalizedBatchSize = normalizeBatchSize(options.batchSize, label);
  const { batchSize: _batchSize, signal, ...poolOptions } = options;
  const pool = createTaskPool(executeSerializedChunk, poolOptions);
  const chunks: Array<SerializedChunk<TInput>> = [];

  for (let index = 0; index < values.length; index += normalizedBatchSize) {
    const items = values.slice(index, index + normalizedBatchSize).map((value, offset) => ({
      index: index + offset,
      value,
    }));
    chunks.push({ items, handlerSource });
  }

  try {
    const chunkResults = await Promise.all(
      chunks.map((chunk) => pool.run(chunk, signal ? { signal } : undefined))
    );
    const mapped = new Array<TResult>(values.length);

    for (const chunk of chunkResults) {
      for (const item of chunk) {
        mapped[item.index] = item.value as TResult;
      }
    }

    return mapped;
  } finally {
    pool.terminate();
  }
};

/**
 * Executes multiple standalone tasks in parallel using a bounded worker pool.
 *
 * @example
 * ```ts
 * import { parallel } from '@bquery/bquery/concurrency';
 *
 * const results = await parallel([
 *   { handler: (value: number) => value * 2, input: 5 },
 *   { handler: ({ a, b }: { a: number; b: number }) => a + b, input: { a: 1, b: 2 } },
 * ]);
 * ```
 */
export async function parallel<TTasks extends readonly ParallelTask[]>(
  tasks: TTasks,
  options: ParallelOptions = {}
): Promise<ParallelResults<TTasks>> {
  if (tasks.length === 0) {
    return [] as unknown as ParallelResults<TTasks>;
  }

  const pool = createSerializedTaskPool(options);

  try {
    const results = await Promise.all(
      tasks.map((task) => pool.run(serializeTask(task), task.options))
    );
    return results as ParallelResults<TTasks>;
  } finally {
    pool.terminate();
  }
}

/**
 * Executes tasks in sequential batches while each batch still uses parallel workers.
 *
 * This adapts `threadts-universal`'s batch helper to bQuery without colliding
 * with the reactive module's existing `batch()` export.
 *
 * @example
 * ```ts
 * import { batchTasks } from '@bquery/bquery/concurrency';
 *
 * const results = await batchTasks(
 *   [
 *     { handler: (value: number) => value * 2, input: 1 },
 *     { handler: (value: number) => value * 2, input: 2 },
 *     { handler: (value: number) => value * 2, input: 3 },
 *   ],
 *   2
 * );
 * ```
 */
export async function batchTasks<TTasks extends readonly ParallelTask[]>(
  tasks: TTasks,
  batchSize?: number,
  options: ParallelOptions = {}
): Promise<ParallelResults<TTasks>> {
  if (tasks.length === 0) {
    return [] as unknown as ParallelResults<TTasks>;
  }

  const normalizedBatchSize = normalizeBatchSize(batchSize, 'batchTasks');
  const pool = createSerializedTaskPool(options);
  const results: unknown[] = [];

  try {
    for (let index = 0; index < tasks.length; index += normalizedBatchSize) {
      const batch = tasks.slice(index, index + normalizedBatchSize);
      const batchResults = await Promise.all(
        batch.map((task) => pool.run(serializeTask(task), task.options))
      );
      results.push(...batchResults);
    }

    return results as ParallelResults<TTasks>;
  } finally {
    pool.terminate();
  }
}

/**
 * Maps an array in parallel using optional chunking on top of `createTaskPool()`.
 *
 * @example
 * ```ts
 * import { map } from '@bquery/bquery/concurrency';
 *
 * const results = await map([1, 2, 3], (value, index) => value + index, {
 *   batchSize: 2,
 *   concurrency: 2,
 * });
 * ```
 */
export async function map<TInput, TResult>(
  values: readonly TInput[],
  mapper: ParallelMapHandler<TInput, TResult>,
  options: ParallelMapOptions = {}
): Promise<TResult[]> {
  return runChunkedHandler(values, mapper, options, 'map');
}

/**
 * Filters an array in parallel using a standalone predicate with optional chunking.
 */
export async function filter<TInput>(
  values: readonly TInput[],
  predicate: ParallelPredicateHandler<TInput>,
  options: ParallelCollectionOptions = {}
): Promise<TInput[]> {
  const matches = await runChunkedHandler(values, predicate, options, 'filter');
  return values.filter((_, index) => matches[index]);
}

/**
 * Returns whether at least one array item matches a standalone predicate.
 *
 * The current implementation evaluates predicate chunks explicitly and reduces
 * the final boolean result on the main thread instead of using hidden globals
 * or speculative worker cancellation.
 */
export async function some<TInput>(
  values: readonly TInput[],
  predicate: ParallelPredicateHandler<TInput>,
  options: ParallelCollectionOptions = {}
): Promise<boolean> {
  if (values.length === 0) {
    return false;
  }

  const matches = await runChunkedHandler(values, predicate, options, 'some');
  return matches.some(Boolean);
}

/**
 * Returns whether every array item matches a standalone predicate.
 *
 * The current implementation evaluates predicate chunks explicitly and reduces
 * the final boolean result on the main thread instead of using hidden globals
 * or speculative worker cancellation.
 */
export async function every<TInput>(
  values: readonly TInput[],
  predicate: ParallelPredicateHandler<TInput>,
  options: ParallelCollectionOptions = {}
): Promise<boolean> {
  if (values.length === 0) {
    return true;
  }

  const matches = await runChunkedHandler(values, predicate, options, 'every');
  return matches.every(Boolean);
}

/**
 * Finds the first array item that matches a standalone predicate.
 */
export async function find<TInput>(
  values: readonly TInput[],
  predicate: ParallelPredicateHandler<TInput>,
  options: ParallelCollectionOptions = {}
): Promise<TInput | undefined> {
  if (values.length === 0) {
    return undefined;
  }

  const matches = await runChunkedHandler(values, predicate, options, 'find');
  const index = matches.findIndex(Boolean);
  return index === -1 ? undefined : values[index];
}

/**
 * Reduces an array inside one isolated worker while preserving standard
 * left-to-right accumulator semantics.
 */
export async function reduce<TInput, TAccumulator>(
  values: readonly TInput[],
  reducer: ParallelReduceHandler<TAccumulator, TInput>,
  initialValue: TAccumulator,
  options: TaskRunOptions = {}
): Promise<TAccumulator> {
  if (values.length === 0) {
    return initialValue;
  }

  const reducerSource = validateTaskHandler(
    reducer as unknown as WorkerTaskHandler<unknown, unknown>
  );

  return runTask(
    executeSerializedReduce,
    {
      initialValue,
      reducerSource,
      values,
    },
    options
  ) as Promise<TAccumulator>;
}
