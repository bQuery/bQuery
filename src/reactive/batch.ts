/**
 * Batched reactive updates.
 */

import { beginBatch, endBatch, flushSyncInternal, isFlushingNow } from './internals';

/**
 * Batches multiple signal updates into a single notification cycle.
 *
 * Updates made inside the batch function are deferred until the batch
 * completes, preventing intermediate re-renders and improving performance.
 *
 * @param fn - Function containing multiple signal updates
 */
export const batch = (fn: () => void): void => {
  beginBatch();
  try {
    fn();
  } finally {
    endBatch();
  }
};

/**
 * Run any pending reactive updates now instead of waiting for the microtask.
 *
 * Only meaningful under the `'batched'` scheduler, where a signal write is
 * flushed on a microtask: this is the escape hatch for tests and for code that
 * needs the synchronous timing `'sync'` gives. Under `'sync'` there is nothing
 * queued, so it does nothing.
 *
 * Inside a `batch()` the work stays with the enclosing batch, so calling it
 * there cannot break the batch open. The same is true **inside an observer**
 * — an effect, a `watch` callback, or a component hook running within one:
 * a flush is already in progress, so there is nothing this call can drain
 * and the pending work lands when that flush reaches it. That case warns,
 * because the call otherwise looks like it worked.
 *
 * @example
 * ```ts
 * configureReactive({ scheduler: 'batched' });
 *
 * count.value = 1;
 * flushSync();
 * expect(rendered).toBe('1'); // no `await` needed
 * ```
 */
export const flushSync = (): void => {
  // Warned unconditionally, like the other diagnostics in this module: the
  // call reads as though it worked, and the failure is otherwise invisible.
  if (isFlushingNow()) {
    console.warn(
      'bQuery reactive: flushSync() was called from inside an observer, where a flush is ' +
        'already running. It cannot drain anything there; the pending work runs as part of ' +
        'the flush already in progress.'
    );
    return;
  }
  flushSyncInternal();
};
