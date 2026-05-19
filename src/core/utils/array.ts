/**
 * Array-focused utility helpers.
 *
 * @module bquery/core/utils/array
 */

/**
 * Ensures the input is always returned as an array.
 *
 * @template T - The item type
 * @param value - A single value, array, or nullish value
 * @returns An array (empty if nullish)
 *
 * @example
 * ```ts
 * ensureArray('a'); // ['a']
 * ensureArray(['a', 'b']); // ['a', 'b']
 * ensureArray(null); // []
 * ```
 */
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Removes duplicate entries from an array.
 *
 * @template T - The item type
 * @param items - The array to deduplicate
 * @returns A new array with unique items
 *
 * @example
 * ```ts
 * unique([1, 2, 2, 3]); // [1, 2, 3]
 * ```
 */
export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Splits an array into chunks of a given size.
 *
 * @template T - The item type
 * @param items - The array to chunk
 * @param size - The maximum size of each chunk
 * @returns An array of chunks
 *
 * @example
 * ```ts
 * chunk([1, 2, 3, 4, 5], 2); // [[1,2],[3,4],[5]]
 * ```
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * Removes falsy values from an array.
 *
 * @template T - The item type
 * @param items - The array to compact
 * @returns A new array without falsy values
 *
 * @example
 * ```ts
 * compact([0, 1, '', 'ok', null]); // [1, 'ok']
 * ```
 */
export function compact<T>(items: Array<T | null | undefined | false | 0 | ''>): T[] {
  return items.filter(Boolean) as T[];
}

/**
 * Flattens a single level of nested arrays.
 *
 * @template T - The item type
 * @param items - The array to flatten
 * @returns A new flattened array
 *
 * @example
 * ```ts
 * flatten([1, [2, 3], 4]); // [1, 2, 3, 4]
 * ```
 */
export function flatten<T>(items: Array<T | T[]>): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (Array.isArray(item)) {
      result.push(...item);
    } else {
      result.push(item);
    }
  }
  return result;
}

/** Iteratee that resolves a string key or function selector. */
// (internal alias retained for type signatures)

/**
 * Groups items by a key derived from either a property name or a selector function.
 *
 * @example
 * ```ts
 * groupBy([{ k: 'a' }, { k: 'b' }, { k: 'a' }], 'k');
 * // { a: [{k:'a'},{k:'a'}], b: [{k:'b'}] }
 * groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'));
 * // { odd: [1, 3], even: [2, 4] }
 * ```
 */
export function groupBy<T, K extends keyof T>(
  items: readonly T[],
  key: K
): Record<string, T[]>;
export function groupBy<T, R extends PropertyKey>(
  items: readonly T[],
  key: (item: T) => R
): Record<R, T[]>;
export function groupBy<T>(
  items: readonly T[],
  key: PropertyKey | ((item: T) => PropertyKey)
): Record<string, T[]> {
  const result: Record<string, T[]> = Object.create(null);
  const selector = typeof key === 'function' ? key : (item: T) => (item as Record<PropertyKey, unknown>)[key];
  for (const item of items) {
    const k = String(selector(item));
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

/**
 * Indexes items by a key derived from either a property name or a selector
 * function. Later items with the same key override earlier ones.
 *
 * @example
 * ```ts
 * keyBy([{ id: 1 }, { id: 2 }], 'id'); // { 1: { id: 1 }, 2: { id: 2 } }
 * ```
 */
export function keyBy<T, K extends keyof T>(items: readonly T[], key: K): Record<string, T>;
export function keyBy<T, R extends PropertyKey>(
  items: readonly T[],
  key: (item: T) => R
): Record<R, T>;
export function keyBy<T>(
  items: readonly T[],
  key: PropertyKey | ((item: T) => PropertyKey)
): Record<string, T> {
  const result: Record<string, T> = Object.create(null);
  const selector = typeof key === 'function' ? key : (item: T) => (item as Record<PropertyKey, unknown>)[key];
  for (const item of items) result[String(selector(item))] = item;
  return result;
}

/**
 * Partitions items into `[matching, nonMatching]` based on a predicate.
 */
export function partition<T>(
  items: readonly T[],
  predicate: (item: T, index: number) => boolean
): [T[], T[]] {
  const yes: T[] = [];
  const no: T[] = [];
  items.forEach((item, i) => {
    (predicate(item, i) ? yes : no).push(item);
  });
  return [yes, no];
}

/**
 * Combines parallel arrays into tuples (truncated to the shortest input).
 *
 * @example
 * ```ts
 * zip([1, 2, 3], ['a', 'b', 'c']); // [[1, 'a'], [2, 'b'], [3, 'c']]
 * ```
 */
export function zip<T extends unknown[][]>(
  ...arrays: T
): Array<{ [K in keyof T]: T[K] extends Array<infer U> ? U : never }> {
  if (arrays.length === 0) return [];
  const min = Math.min(...arrays.map((a) => a.length));
  const result = new Array(min) as Array<{
    [K in keyof T]: T[K] extends Array<infer U> ? U : never;
  }>;
  for (let i = 0; i < min; i += 1) {
    result[i] = arrays.map((a) => a[i]) as unknown as {
      [K in keyof T]: T[K] extends Array<infer U> ? U : never;
    };
  }
  return result;
}

/**
 * Generates a numeric range `[start, end)` with the given step.
 *
 * @example
 * ```ts
 * range(0, 5);        // [0, 1, 2, 3, 4]
 * range(2, 10, 2);    // [2, 4, 6, 8]
 * range(5, 0, -1);    // [5, 4, 3, 2, 1]
 * ```
 */
export function range(start: number, end: number, step = 1): number[] {
  if (step === 0) return [];
  const result: number[] = [];
  if (step > 0) {
    for (let i = start; i < end; i += step) result.push(i);
  } else {
    for (let i = start; i > end; i += step) result.push(i);
  }
  return result;
}

/** Returns the first element of an array, or `undefined` if empty. */
export function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

/** Returns the last element of an array, or `undefined` if empty. */
export function last<T>(items: readonly T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

/** Returns a new array containing the first `n` elements. */
export function take<T>(items: readonly T[], n: number): T[] {
  if (n <= 0) return [];
  return items.slice(0, n);
}

/** Returns a new array with the first `n` elements removed. */
export function drop<T>(items: readonly T[], n: number): T[] {
  if (n <= 0) return [...items];
  return items.slice(n);
}

/**
 * Returns a single random element from the array, or `undefined` if empty.
 * Uses `Math.random()` — not suitable for cryptographic randomness.
 */
export function sample<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Returns a new array with the items shuffled using the Fisher–Yates
 * algorithm. Uses `Math.random()` — not suitable for cryptographic use.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Returns a new array with duplicates removed based on a selector. Preserves
 * the first occurrence of each key.
 */
export function uniqueBy<T, K>(items: readonly T[], selector: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of items) {
    const key = selector(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Returns a stably-sorted copy ordered by one or more selectors. Each
 * selector should return a comparable primitive (number, string, boolean,
 * Date).
 *
 * @example
 * ```ts
 * sortBy(users, (u) => u.lastName);
 * sortBy(users, [(u) => u.lastName, (u) => u.firstName]);
 * ```
 */
export function sortBy<T, K extends string | number | boolean | bigint | Date>(
  items: readonly T[],
  selector: ((item: T) => K) | Array<(item: T) => K>
): T[] {
  const selectors = Array.isArray(selector) ? selector : [selector];
  return items.slice().sort((a, b) => {
    for (const sel of selectors) {
      const av = sel(a);
      const bv = sel(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  });
}

/**
 * Returns the intersection of two arrays. Element order follows `a`.
 * Uses strict equality via `Set` membership.
 */
export function intersection<T>(a: readonly T[], b: readonly T[]): T[] {
  const set = new Set(b);
  return a.filter((item) => set.has(item));
}

/**
 * Returns the items in `a` that are not in `b`.
 */
export function difference<T>(a: readonly T[], b: readonly T[]): T[] {
  const set = new Set(b);
  return a.filter((item) => !set.has(item));
}

/**
 * Recursively flattens nested arrays of arbitrary depth.
 */
export function flattenDeep<T>(items: ReadonlyArray<T | readonly unknown[]>): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (Array.isArray(item)) {
      result.push(...flattenDeep(item as readonly unknown[]) as T[]);
    } else {
      result.push(item as T);
    }
  }
  return result;
}

/**
 * Returns a new array with the element at `from` moved to `to`. Out-of-range
 * indices are clamped to `[0, items.length - 1]`.
 */
export function move<T>(items: readonly T[], from: number, to: number): T[] {
  const result = items.slice();
  if (result.length === 0) return result;
  const f = Math.max(0, Math.min(result.length - 1, from));
  const t = Math.max(0, Math.min(result.length - 1, to));
  const [item] = result.splice(f, 1);
  result.splice(t, 0, item);
  return result;
}

/**
 * Splits an array into consecutive chunks at each point where the predicate
 * returns true for an item relative to the previous one in the chunk.
 *
 * @example
 * ```ts
 * chunkBy([1, 1, 2, 2, 3], (a, b) => a === b);
 * // [[1, 1], [2, 2], [3]]
 * ```
 */
export function chunkBy<T>(
  items: readonly T[],
  predicate: (current: T, previous: T) => boolean
): T[][] {
  const result: T[][] = [];
  let current: T[] = [];
  for (const item of items) {
    if (current.length === 0) {
      current.push(item);
      continue;
    }
    if (predicate(item, current[current.length - 1])) {
      current.push(item);
    } else {
      result.push(current);
      current = [item];
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

// Internal sentinel intentionally left blank.
