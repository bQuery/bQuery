/**
 * Batched reactive updates.
 */

import { beginBatch, endBatch } from './internals';

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
