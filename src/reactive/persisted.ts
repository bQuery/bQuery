/**
 * LocalStorage-backed signals.
 */

import { signal, Signal } from './core';
import { effect } from './effect';

/**
 * Creates a signal that persists to localStorage.
 *
 * @template T - The type of the signal value
 * @param key - The localStorage key
 * @param initialValue - The initial value if not found in storage
 * @returns A Signal that syncs with localStorage (falls back to in-memory if unavailable)
 */
export const persistedSignal = <T>(key: string, initialValue: T): Signal<T> => {
  // Check if localStorage is available
  const hasLocalStorage = typeof localStorage !== 'undefined';
  
  let stored: T = initialValue;

  if (hasLocalStorage) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        stored = JSON.parse(raw) as T;
      }
    } catch {
      // Use initial value on parse error or access denial
    }
  }

  const sig = signal(stored);

  // Only set up persistence effect if localStorage is available
  if (hasLocalStorage) {
    effect(() => {
      try {
        localStorage.setItem(key, JSON.stringify(sig.value));
      } catch {
        // Ignore storage errors (quota exceeded, sandboxed iframes, etc.)
      }
    });
  }

  return sig;
};
