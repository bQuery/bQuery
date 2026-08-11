/**
 * Object-focused utility helpers.
 *
 * @module bquery/core/utils/object
 */

/**
 * Checks if a value is a plain object (not null, array, or class instance).
 *
 * @param value - The value to check
 * @returns True if the value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Checks if a key could cause prototype pollution.
 * These keys are dangerous when used in object merging operations.
 *
 * @param key - The key to check
 * @returns True if the key is a prototype pollution vector
 *
 * @internal
 */
export function isPrototypePollutionKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * Creates a deep clone using structuredClone if available, otherwise fallback to JSON.
 *
 * @template T - The type of value being cloned
 * @param value - The value to clone
 * @returns A deep copy of the value
 *
 * @remarks
 * When `structuredClone` is available (modern browsers, Node 17+, Bun), this function
 * provides full deep cloning including circular references, Date, Map, Set, ArrayBuffer, etc.
 *
 * **JSON fallback limitations** (older environments without `structuredClone`):
 * - **Throws** on circular references
 * - **Drops** functions, `undefined`, and Symbol properties
 * - **Transforms** Date → ISO string, Map/Set → empty object, BigInt → throws
 * - **Loses** prototype chains and non-enumerable properties
 *
 * For guaranteed safe cloning of arbitrary data, ensure your environment supports
 * `structuredClone` or pre-validate your data structure.
 *
 * @example
 * ```ts
 * const original = { nested: { value: 1 } };
 * const copy = clone(original);
 * copy.nested.value = 2;
 * console.log(original.nested.value); // 1
 * ```
 */
export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Deep-merges plain objects into a new object.
 * Later sources override earlier ones for primitive values.
 * Objects are recursively merged.
 *
 * @param sources - Objects to merge
 * @returns A new object with all sources merged as an intersection type
 *
 * @remarks
 * This function uses overloads to provide accurate intersection types for up to 5 sources.
 * For more than 5 sources, the return type falls back to `Record<string, unknown>`.
 *
 * Note that deep merging creates a shallow intersection at the type level. Nested objects
 * are merged at runtime, but TypeScript sees them as intersected types which may not
 * perfectly represent the merged structure for deeply nested conflicting types.
 *
 * @example
 * ```ts
 * const result = merge(
 *   { a: 1, nested: { x: 1 } },
 *   { b: 2, nested: { y: 2 } }
 * );
 * // Result: { a: 1, b: 2, nested: { x: 1, y: 2 } }
 * // Type: { a: number; nested: { x: number } } & { b: number; nested: { y: number } }
 * ```
 *
 * @security This method is protected against prototype pollution attacks.
 * Keys like `__proto__`, `constructor`, and `prototype` are ignored.
 */
export function merge<T1 extends Record<string, unknown>>(source1: T1): T1;
export function merge<T1 extends Record<string, unknown>, T2 extends Record<string, unknown>>(
  source1: T1,
  source2: T2
): T1 & T2;
export function merge<
  T1 extends Record<string, unknown>,
  T2 extends Record<string, unknown>,
  T3 extends Record<string, unknown>,
>(source1: T1, source2: T2, source3: T3): T1 & T2 & T3;
export function merge<
  T1 extends Record<string, unknown>,
  T2 extends Record<string, unknown>,
  T3 extends Record<string, unknown>,
  T4 extends Record<string, unknown>,
>(source1: T1, source2: T2, source3: T3, source4: T4): T1 & T2 & T3 & T4;
export function merge<
  T1 extends Record<string, unknown>,
  T2 extends Record<string, unknown>,
  T3 extends Record<string, unknown>,
  T4 extends Record<string, unknown>,
  T5 extends Record<string, unknown>,
>(source1: T1, source2: T2, source3: T3, source4: T4, source5: T5): T1 & T2 & T3 & T4 & T5;
export function merge(...sources: Record<string, unknown>[]): Record<string, unknown>;
export function merge(...sources: Record<string, unknown>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (isPrototypePollutionKey(key)) continue;

      if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = merge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Picks specified keys from an object.
 *
 * @template T - The object type
 * @template K - The key type
 * @param obj - The source object
 * @param keys - Keys to pick
 * @returns A new object with only the specified keys
 *
 * @example
 * ```ts
 * const user = { name: 'John', age: 30, email: 'john@example.com' };
 * pick(user, ['name', 'email']); // { name: 'John', email: 'john@example.com' }
 * ```
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omits specified keys from an object.
 *
 * @template T - The object type
 * @template K - The key type
 * @param obj - The source object
 * @param keys - Keys to omit
 * @returns A new object without the specified keys
 *
 * @example
 * ```ts
 * const user = { name: 'John', age: 30, password: 'secret' };
 * omit(user, ['password']); // { name: 'John', age: 30 }
 * ```
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Checks if an object has a given own property.
 *
 * @template T - The object type
 * @param obj - The object to check
 * @param key - The property key
 * @returns True if the property exists on the object
 *
 * @example
 * ```ts
 * hasOwn({ a: 1 }, 'a'); // true
 * ```
 */
export function hasOwn<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

const parsePath = (path: string | readonly PropertyKey[]): PropertyKey[] => {
  if (Array.isArray(path)) return path as PropertyKey[];

  const str = String(path);
  const keys: PropertyKey[] = [];
  let current = '';

  const pushCurrent = (allowEmpty = false): void => {
    if (allowEmpty || current.length > 0) {
      keys.push(current);
    }
    current = '';
  };

  for (let i = 0; i < str.length; i += 1) {
    const char = str[i];

    if (char === '.') {
      pushCurrent();
      continue;
    }

    if (char !== '[') {
      current += char;
      continue;
    }

    pushCurrent();
    i += 1;

    while (i < str.length && /\s/.test(str[i])) i += 1;
    if (i >= str.length) break;

    const quote = str[i];
    if (quote === '"' || quote === "'") {
      current = '';
      i += 1;

      while (i < str.length) {
        const quotedChar = str[i];
        if (quotedChar === '\\' && i + 1 < str.length) {
          current += str[i + 1];
          i += 2;
          continue;
        }
        if (quotedChar === quote) break;
        current += quotedChar;
        i += 1;
      }

      pushCurrent(true);
      while (i + 1 < str.length && /\s/.test(str[i + 1])) i += 1;
      if (str[i + 1] === ']') i += 1;
      continue;
    }

    current = '';
    while (i < str.length && str[i] !== ']') {
      current += str[i];
      i += 1;
    }
    current = current.trim();
    pushCurrent();
  }

  pushCurrent();
  return keys;
};

const isSafeKey = (key: PropertyKey): boolean => {
  if (typeof key !== 'string') return true;
  return !isPrototypePollutionKey(key);
};

/**
 * Safely reads a deeply nested value from an object/array.
 * Returns `defaultValue` if any intermediate step is `undefined` / `null`.
 *
 * Path supports dot notation (`'a.b.c'`), array indices (`'list[0].name'`),
 * or a pre-split key array.
 *
 * @security Prototype-pollution keys (`__proto__`, `constructor`, `prototype`)
 * are skipped during traversal.
 *
 * @example
 * ```ts
 * get({ a: { b: { c: 42 } } }, 'a.b.c');     // 42
 * get({ list: [{ name: 'x' }] }, 'list[0].name'); // 'x'
 * get({}, 'a.b', 'fallback');                // 'fallback'
 * ```
 */
export function get<T = unknown>(
  obj: unknown,
  path: string | readonly PropertyKey[]
): T | undefined;
export function get<T = unknown>(
  obj: unknown,
  path: string | readonly PropertyKey[],
  defaultValue: T
): T;
export function get<T = unknown>(
  obj: unknown,
  path: string | readonly PropertyKey[],
  defaultValue?: T
): T | undefined {
  const keys = parsePath(path);
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return defaultValue;
    if (!isSafeKey(key)) return defaultValue;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current === undefined ? defaultValue : (current as T);
}

/**
 * Sets a deeply nested value, creating intermediate objects as needed.
 * Returns the original object (mutated). Refuses to walk through
 * prototype-pollution keys.
 *
 * @example
 * ```ts
 * set({}, 'a.b.c', 1); // { a: { b: { c: 1 } } }
 * ```
 */
const safeAssign = (
  target: Record<PropertyKey, unknown>,
  key: PropertyKey,
  value: unknown
): void => {
  // Defensive double-check: callers must already guard via `isSafeKey`.
  if (!isSafeKey(key)) return;
  const existing = Object.getOwnPropertyDescriptor(target, key);
  if (existing) {
    try {
      if ('set' in existing) {
        existing.set?.call(target, value);
        return;
      }
      Object.defineProperty(target, key, {
        ...existing,
        value,
      });
    } catch {
      // Ignore non-writable or otherwise unsupported assignments.
    }
    return;
  }
  const proto = Object.getPrototypeOf(target) as object | null;
  const prototypeDescriptor =
    proto !== null ? Object.getOwnPropertyDescriptor(proto, key) : undefined;
  if (prototypeDescriptor && 'set' in prototypeDescriptor) {
    try {
      prototypeDescriptor.set?.call(target, value);
      return;
    } catch {
      // Ignore setter failures.
    }
  }
  try {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } catch {
    // Ignore non-writable or otherwise unsupported assignments.
  }
};

export function set<T extends object>(
  obj: T,
  path: string | readonly PropertyKey[],
  value: unknown
): T {
  const keys = parsePath(path);
  if (keys.length === 0) return obj;
  let current: Record<PropertyKey, unknown> = obj as unknown as Record<PropertyKey, unknown>;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!isSafeKey(key)) return obj;
    const next = current[key];
    if (next == null || typeof next !== 'object') {
      // Decide between array and object based on the next key being an array index.
      const nextKey = keys[i + 1];
      const isIndex =
        typeof nextKey === 'number' || (typeof nextKey === 'string' && /^\d+$/.test(nextKey));
      safeAssign(current, key, isIndex ? [] : {});
      const assigned = current[key];
      if (assigned == null || typeof assigned !== 'object') return obj;
    }
    current = current[key] as Record<PropertyKey, unknown>;
  }
  const finalKey = keys[keys.length - 1];
  if (isSafeKey(finalKey)) safeAssign(current, finalKey, value);
  return obj;
}

/**
 * Returns true if the object has a value at the given path. Refuses to
 * follow prototype-pollution keys.
 */
export function has(obj: unknown, path: string | readonly PropertyKey[]): boolean {
  const keys = parsePath(path);
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return false;
    if (!isSafeKey(key)) return false;
    if (!Object.prototype.hasOwnProperty.call(current, key)) return false;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return true;
}

/**
 * Maps the values of an object using a transform function. Keys are
 * preserved. Iteration follows `Object.entries()` order.
 */
export function mapValues<T extends Record<string, unknown>, R>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T, object: T) => R
): { [K in keyof T]: R } {
  const result: Record<string, R> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fn(value as T[keyof T], key as keyof T, obj);
  }
  return result as { [K in keyof T]: R };
}

/**
 * Maps the keys of an object using a transform function. Values are
 * preserved. Later collisions override earlier ones.
 */
export function mapKeys<T extends Record<string, unknown>>(
  obj: T,
  fn: (key: keyof T, value: T[keyof T], object: T) => string
): Record<string, T[keyof T]> {
  const result: Record<string, T[keyof T]> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[fn(key as keyof T, value as T[keyof T], obj)] = value as T[keyof T];
  }
  return result;
}

/**
 * Returns a new object whose keys and values have been swapped.
 *
 * @example
 * ```ts
 * invert({ a: 1, b: 2 }); // { '1': 'a', '2': 'b' }
 * ```
 */
export function invert<T extends Record<string, PropertyKey>>(obj: T): Record<string, keyof T> {
  const result: Record<string, keyof T> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[String(value)] = key as keyof T;
  }
  return result;
}

/**
 * Recursively compares two values for structural equality. Handles plain
 * objects, arrays, Dates, RegExps, Maps, Sets, and primitive equality
 * (including `NaN === NaN`).
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  const seen = new WeakMap<object, WeakSet<object>>();

  const hasSeenPair = (left: object, right: object): boolean => seen.get(left)?.has(right) ?? false;

  const markSeenPair = (left: object, right: object): void => {
    let leftSeen = seen.get(left);
    if (!leftSeen) {
      leftSeen = new WeakSet<object>();
      seen.set(left, leftSeen);
    }
    leftSeen.add(right);

    let rightSeen = seen.get(right);
    if (!rightSeen) {
      rightSeen = new WeakSet<object>();
      seen.set(right, rightSeen);
    }
    rightSeen.add(left);
  };

  const compare = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true;
    if (typeof left !== typeof right) return false;
    if (left === null || right === null) return false;
    if (typeof left !== 'object') return false;

    const leftObject = left as object;
    const rightObject = right as object;
    if (hasSeenPair(leftObject, rightObject)) return true;
    markSeenPair(leftObject, rightObject);

    if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
    if (left instanceof RegExp && right instanceof RegExp)
      return left.source === right.source && left.flags === right.flags;
    if (Array.isArray(left)) {
      if (!Array.isArray(right)) return false;
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i += 1) {
        if (!compare(left[i], right[i])) return false;
      }
      return true;
    }
    if (left instanceof Map && right instanceof Map) {
      if (left.size !== right.size) return false;
      const rightEntries = Array.from(right.entries());
      const used = new Set<number>();
      for (const [leftKey, leftValue] of left) {
        let matched = false;
        for (let i = 0; i < rightEntries.length; i += 1) {
          if (used.has(i)) continue;
          const [rightKey, rightValue] = rightEntries[i];
          if (compare(leftKey, rightKey) && compare(leftValue, rightValue)) {
            used.add(i);
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }
    if (left instanceof Set && right instanceof Set) {
      if (left.size !== right.size) return false;
      const rightValues = Array.from(right.values());
      const used = new Set<number>();
      for (const leftValue of left) {
        let matched = false;
        for (let i = 0; i < rightValues.length; i += 1) {
          if (used.has(i)) continue;
          if (compare(leftValue, rightValues[i])) {
            used.add(i);
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }

    const leftKeys = Object.keys(leftObject);
    const rightKeys = Object.keys(rightObject);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
      if (!compare((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]))
        return false;
    }
    return true;
  };

  return compare(a, b);
}

/**
 * Convenience alias for {@link deepEqual}.
 */
export const isEqual = deepEqual;

/**
 * Recursively freezes an object and all nested object values. Returns the
 * same reference. Functions and primitives are returned unchanged.
 */
export function freeze<T>(value: T): Readonly<T> {
  const seen = new WeakSet<object>();

  const freezeValue = (current: unknown): void => {
    if (current === null || typeof current !== 'object') return;
    if (seen.has(current)) return;
    seen.add(current);
    if (!Object.isFrozen(current)) Object.freeze(current);
    for (const nested of Object.values(current as Record<string, unknown>)) {
      if (nested !== null && (typeof nested === 'object' || typeof nested === 'function')) {
        freezeValue(nested);
      }
    }
  };

  freezeValue(value);
  return value;
}

/**
 * Fills in `target` keys that are `undefined` with values from `sources`
 * (first source wins). Mutates `target` and also returns it.
 *
 * @security Prototype-pollution keys are ignored.
 */
export function defaults<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Record<string, unknown>>
): T {
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (isPrototypePollutionKey(key)) continue;
      if ((target as Record<string, unknown>)[key] === undefined) {
        safeAssign(target as Record<PropertyKey, unknown>, key, value);
      }
    }
  }
  return target;
}

/**
 * Typed wrapper around `Object.entries()` preserving key types.
 */
export function entriesTyped<T extends Record<string, unknown>>(
  obj: T
): Array<[keyof T & string, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T & string, T[keyof T]]>;
}

/**
 * Typed wrapper around `Object.keys()` preserving key types.
 */
export function keysTyped<T extends Record<string, unknown>>(obj: T): Array<keyof T & string> {
  return Object.keys(obj) as Array<keyof T & string>;
}
