/**
 * Dependency tracking control helpers.
 */

import { isTrackingEnabled, setTrackingEnabled } from './internals';

/**
 * Executes a function without tracking any signal dependencies.
 * Useful when reading a signal value without creating a reactive dependency.
 *
 * @template T - The return type of the function
 * @param fn - The function to execute without tracking
 * @returns The result of the function
 */
export const untrack = <T>(fn: () => T): T => {
  const prevTracking = isTrackingEnabled();
  setTrackingEnabled(false);
  try {
    return fn();
  } finally {
    setTrackingEnabled(prevTracking);
  }
};
