/**
 * Internal utilities for the store module.
 * @internal
 */

/**
 * Check if a value is a plain object (not array, null, Date, etc.).
 * @internal
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return (
    value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
  );
};

/**
 * Deep clones an object. Used for deep reactivity support.
 * @internal
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as T;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Map) {
    return new Map(Array.from(obj.entries()).map(([k, v]) => [k, deepClone(v)])) as T;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map(deepClone)) as T;
  }

  const cloned = {} as T;
  for (const key of Object.keys(obj)) {
    (cloned as Record<string, unknown>)[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned;
};

/**
 * Compares two values for deep equality.
 * @internal
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a.entries()) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a.values()) {
      let found = false;
      for (const candidate of b.values()) {
        if (deepEqual(value, candidate)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
};

/**
 * Detects if nested objects were mutated but the reference stayed the same.
 * Returns the keys where nested mutations were detected.
 * @internal
 */
export const detectNestedMutations = <S extends Record<string, unknown>>(
  before: S,
  after: S,
  signalValues: Map<keyof S, unknown>
): Array<keyof S> => {
  const mutatedKeys: Array<keyof S> = [];

  for (const key of Object.keys(after) as Array<keyof S>) {
    const beforeValue = before[key];
    const afterValue = after[key];
    const signalValue = signalValues.get(key);

    // Check if it's the same reference but content changed
    if (
      signalValue === afterValue &&
      isPlainObject(beforeValue) &&
      isPlainObject(afterValue) &&
      !deepEqual(beforeValue, afterValue)
    ) {
      mutatedKeys.push(key);
    }
  }

  return mutatedKeys;
};

/** @internal Flag to enable/disable development warnings */
export const isDev = (() => {
  try {
    const globalProcess = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
    return typeof globalProcess !== 'undefined' && globalProcess.env?.NODE_ENV !== 'production';
  } catch {
    return true;
  }
})();
