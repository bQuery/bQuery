/**
 * Optional fluent pipeline helpers layered on top of the explicit collection helpers.
 *
 * @module bquery/concurrency
 */

import { every, filter, find, map, reduce, some } from './high-level';
import type {
  ConcurrencyPipeline,
  ConcurrencyPipelineOptions,
  ParallelCollectionOptions,
  ParallelMapHandler,
  ParallelPredicateHandler,
  ParallelReduceHandler,
  TaskRunOptions,
} from './types';

const mergeCollectionOptions = (
  defaults: ConcurrencyPipelineOptions,
  overrides: ParallelCollectionOptions = {}
): ParallelCollectionOptions => ({
  ...defaults,
  ...overrides,
});

const mergeTaskRunOptions = (
  defaults: ConcurrencyPipelineOptions,
  overrides: TaskRunOptions = {}
): TaskRunOptions => ({
  signal: 'signal' in overrides ? overrides.signal : defaults.signal,
  timeout: 'timeout' in overrides ? overrides.timeout : defaults.timeout,
  transfer: overrides.transfer,
});

class FluentConcurrencyPipeline<TValue> implements ConcurrencyPipeline<TValue> {
  constructor(
    private readonly valuesPromise: Promise<readonly TValue[]>,
    private readonly defaults: ConcurrencyPipelineOptions
  ) {}

  private createNext<TNext>(
    transform: (values: readonly TValue[]) => Promise<readonly TNext[]>
  ): ConcurrencyPipeline<TNext> {
    return new FluentConcurrencyPipeline(
      this.valuesPromise.then((values) => transform(values)),
      this.defaults
    );
  }

  map<TResult>(
    mapper: ParallelMapHandler<TValue, TResult>,
    options?: ParallelCollectionOptions
  ): ConcurrencyPipeline<TResult> {
    const resolvedOptions = mergeCollectionOptions(this.defaults, options);
    return this.createNext((values) => map(values, mapper, resolvedOptions));
  }

  filter(
    predicate: ParallelPredicateHandler<TValue>,
    options?: ParallelCollectionOptions
  ): ConcurrencyPipeline<TValue> {
    const resolvedOptions = mergeCollectionOptions(this.defaults, options);
    return this.createNext((values) => filter(values, predicate, resolvedOptions));
  }

  toArray(): Promise<TValue[]> {
    return this.valuesPromise.then((values) => values.slice());
  }

  some(
    predicate: ParallelPredicateHandler<TValue>,
    options?: ParallelCollectionOptions
  ): Promise<boolean> {
    const resolvedOptions = mergeCollectionOptions(this.defaults, options);
    return this.valuesPromise.then((values) => some(values, predicate, resolvedOptions));
  }

  every(
    predicate: ParallelPredicateHandler<TValue>,
    options?: ParallelCollectionOptions
  ): Promise<boolean> {
    const resolvedOptions = mergeCollectionOptions(this.defaults, options);
    return this.valuesPromise.then((values) => every(values, predicate, resolvedOptions));
  }

  find(
    predicate: ParallelPredicateHandler<TValue>,
    options?: ParallelCollectionOptions
  ): Promise<TValue | undefined> {
    const resolvedOptions = mergeCollectionOptions(this.defaults, options);
    return this.valuesPromise.then((values) => find(values, predicate, resolvedOptions));
  }

  reduce<TAccumulator>(
    reducer: ParallelReduceHandler<TAccumulator, TValue>,
    initialValue: TAccumulator,
    options?: TaskRunOptions
  ): Promise<TAccumulator> {
    const resolvedOptions = mergeTaskRunOptions(this.defaults, options);
    return this.valuesPromise.then((values) => reduce(values, reducer, initialValue, resolvedOptions));
  }
}

/**
 * Creates an optional fluent pipeline over the existing concurrency collection helpers.
 *
 * The pipeline itself does not create hidden global workers or proxies. Each stage
 * delegates to the already explicit `map()`, `filter()`, `some()`, `every()`,
 * `find()`, and `reduce()` helpers when the pipeline is executed.
 *
 * @example
 * ```ts
 * import { pipeline } from '@bquery/bquery/concurrency';
 *
 * const results = await pipeline([1, 2, 3, 4], {
 *   batchSize: 2,
 *   concurrency: 2,
 * })
 *   .map((value) => value * 2)
 *   .filter((value) => value > 4)
 *   .toArray();
 *
 * console.log(results); // [6, 8]
 * ```
 */
export function pipeline<TValue>(
  values: readonly TValue[],
  options: ConcurrencyPipelineOptions = {}
): ConcurrencyPipeline<TValue> {
  return new FluentConcurrencyPipeline(Promise.resolve(values.slice()), options);
}
