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
 * @returns A Signal that syncs with localStorage
 */
export const persistedSignal = <T>(key: string, initialValue: T): Signal<T> => {
  let stored: T = initialValue;

  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      stored = JSON.parse(raw) as T;
    }
  } catch {
    // Use initial value on parse error
  }

  const sig = signal(stored);

  effect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(sig.value));
    } catch {
      // Ignore storage errors
    }
  });

  return sig;
};
