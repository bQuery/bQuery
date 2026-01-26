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
  // Check if localStorage is available and accessible
  let hasLocalStorage = false;
  let storage: Storage | null = null;
  
  try {
    // In Safari private mode, accessing localStorage can throw SecurityError
    storage = globalThis.localStorage;
    if (storage) {
      // Test actual access to ensure it's not just present but usable
      storage.getItem('__bquery_test__');
      hasLocalStorage = true;
    }
  } catch {
    // localStorage unavailable or access denied (Safari private mode, sandboxed iframes, etc.)
    hasLocalStorage = false;
  }
  
  let stored: T = initialValue;

  if (hasLocalStorage && storage) {
    try {
      const raw = storage.getItem(key);
      if (raw !== null) {
        stored = JSON.parse(raw) as T;
      }
    } catch {
      // Use initial value on parse error or access denial
    }
  }

  const sig = signal(stored);

  // Only set up persistence effect if localStorage is available
  if (hasLocalStorage && storage) {
    effect(() => {
      try {
        storage!.setItem(key, JSON.stringify(sig.value));
      } catch {
        // Ignore storage errors (quota exceeded, sandboxed iframes, etc.)
      }
    });
  }

  return sig;
};
