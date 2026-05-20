/**
 * Reactive reduced-motion signal integration.
 *
 * @module bquery/motion
 */

import { readonly } from '../reactive/readonly';
import { signal } from '../reactive/core';
import type { ReadonlySignal } from '../reactive/readonly';
import { onReducedMotionChange, prefersReducedMotion } from './reduced-motion';

/** @internal */
let reducedMotionSignalSingleton: ReadonlySignal<boolean> | null = null;

/**
 * Reactive readonly signal that tracks the effective reduced-motion
 * preference. The signal updates automatically when the user's system
 * preference changes or when {@link setReducedMotion} is called.
 *
 * Returns the same singleton signal on every call.
 *
 * @example
 * ```ts
 * import { effect } from '@bquery/bquery/reactive';
 * const reduced = reducedMotionSignal();
 * effect(() => console.log('reduced motion:', reduced.value));
 * ```
 */
export const reducedMotionSignal = (): ReadonlySignal<boolean> => {
  if (reducedMotionSignalSingleton) return reducedMotionSignalSingleton;
  const inner = signal(prefersReducedMotion());
  onReducedMotionChange((value) => {
    inner.value = value;
  });
  reducedMotionSignalSingleton = readonly(inner);
  return reducedMotionSignalSingleton;
};
