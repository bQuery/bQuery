/**
 * Reactive module providing fine-grained reactivity primitives.
 *
 * @module bquery/reactive
 */

export {
  Computed,
  Signal,
  batch,
  computed,
  effect,
  isComputed,
  isSignal,
  linkedSignal,
  persistedSignal,
  readonly,
  signal,
  untrack,
  watch,
} from './signal';

export type { CleanupFn, LinkedSignal, Observer, ReadonlySignal } from './signal';
