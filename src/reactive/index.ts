/**
 * Reactive module providing fine-grained reactivity primitives.
 *
 * @module bquery/reactive
 */

export { batch, Computed, computed, effect, persistedSignal, Signal, signal } from './signal';

export type { CleanupFn, Observer } from './signal';
