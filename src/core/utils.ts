/**
 * Utility helpers used across the framework.
 * These are intentionally small and framework-agnostic to keep the core tiny.
 *
 * @module bquery/core/utils
 */

/**
 * Utility object containing common helper functions.
 * All utilities are designed to be tree-shakeable and have zero dependencies.
 */
export const utils = {
  /**
   * Creates a deep clone using structuredClone if available, otherwise fallback to JSON.
   *
   * @template T - The type of value being cloned
   * @param value - The value to clone
   * @returns A deep copy of the value
   *
   * @example
   * ```ts
   * const original = { nested: { value: 1 } };
   * const copy = utils.clone(original);
   * copy.nested.value = 2;
   * console.log(original.nested.value); // 1
   * ```
   */
  clone<T>(value: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
  },

  /**
   * Deep-merges plain objects into a new object.
   * Later sources override earlier ones for primitive values.
   * Objects are recursively merged.
   *
   * @template T - The type of the merged object
   * @param sources - Objects to merge
   * @returns A new object with all sources merged
   *
   * @example
   * ```ts
   * const result = utils.merge(
   *   { a: 1, nested: { x: 1 } },
   *   { b: 2, nested: { y: 2 } }
   * );
   * // Result: { a: 1, b: 2, nested: { x: 1, y: 2 } }
   * ```
   */
  merge<T extends Record<string, unknown>>(...sources: T[]): T {
    const result: Record<string, unknown> = {};
    for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
        if (utils.isPlainObject(value) && utils.isPlainObject(result[key])) {
          result[key] = utils.merge(
            result[key] as Record<string, unknown>,
            value as Record<string, unknown>
          );
        } else {
          result[key] = value;
        }
      }
    }
    return result as T;
  },

  /**
   * Creates a debounced function that delays execution until after
   * the specified delay has elapsed since the last call.
   *
   * @template TArgs - The argument types of the function
   * @param fn - The function to debounce
   * @param delayMs - Delay in milliseconds
   * @returns A debounced version of the function
   *
   * @example
   * ```ts
   * const search = utils.debounce((query: string) => {
   *   console.log('Searching:', query);
   * }, 300);
   *
   * search('h');
   * search('he');
   * search('hello'); // Only this call executes after 300ms
   * ```
   */
  debounce<TArgs extends unknown[]>(
    fn: (...args: TArgs) => void,
    delayMs: number
  ): (...args: TArgs) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    return (...args: TArgs) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => fn(...args), delayMs);
    };
  },

  /**
   * Creates a throttled function that runs at most once per interval.
   *
   * @template TArgs - The argument types of the function
   * @param fn - The function to throttle
   * @param intervalMs - Minimum interval between calls in milliseconds
   * @returns A throttled version of the function
   *
   * @example
   * ```ts
   * const handleScroll = utils.throttle(() => {
   *   console.log('Scroll position:', window.scrollY);
   * }, 100);
   *
   * window.addEventListener('scroll', handleScroll);
   * ```
   */
  throttle<TArgs extends unknown[]>(
    fn: (...args: TArgs) => void,
    intervalMs: number
  ): (...args: TArgs) => void {
    let lastRun = 0;
    return (...args: TArgs) => {
      const now = Date.now();
      if (now - lastRun >= intervalMs) {
        lastRun = now;
        fn(...args);
      }
    };
  },

  /**
   * Creates a stable unique ID for DOM usage.
   *
   * @param prefix - Optional prefix for the ID (default: 'bQuery')
   * @returns A unique identifier string
   *
   * @example
   * ```ts
   * const id = utils.uid('modal'); // 'modal_x7k2m9p'
   * ```
   */
  uid(prefix = 'bQuery'): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  },

  /**
   * Checks if a value is a DOM Element.
   *
   * @param value - The value to check
   * @returns True if the value is an Element
   */
  isElement(value: unknown): value is Element {
    return value instanceof Element;
  },

  /**
   * Checks if a value is a BQueryCollection-like object.
   *
   * @param value - The value to check
   * @returns True if the value has an elements array property
   */
  isCollection(value: unknown): value is { elements: Element[] } {
    return Boolean(value && typeof value === 'object' && 'elements' in (value as object));
  },

  /**
   * Checks for emptiness across common value types.
   *
   * @param value - The value to check
   * @returns True if the value is empty (null, undefined, empty string, empty array, or empty object)
   *
   * @example
   * ```ts
   * utils.isEmpty('');       // true
   * utils.isEmpty([]);       // true
   * utils.isEmpty({});       // true
   * utils.isEmpty(null);     // true
   * utils.isEmpty('hello');  // false
   * utils.isEmpty([1, 2]);   // false
   * ```
   */
  isEmpty(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value as object).length === 0;
    return false;
  },

  /**
   * Checks if a value is a plain object (not null, array, or class instance).
   *
   * @param value - The value to check
   * @returns True if the value is a plain object
   */
  isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === '[object Object]';
  },

  /**
   * Checks if a value is a function.
   *
   * @param value - The value to check
   * @returns True if the value is a function
   */
  isFunction(value: unknown): value is (...args: unknown[]) => unknown {
    return typeof value === 'function';
  },

  /**
   * Checks if a value is a string.
   *
   * @param value - The value to check
   * @returns True if the value is a string
   */
  isString(value: unknown): value is string {
    return typeof value === 'string';
  },

  /**
   * Checks if a value is a number (excluding NaN).
   *
   * @param value - The value to check
   * @returns True if the value is a valid number
   */
  isNumber(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value);
  },

  /**
   * Checks if a value is a boolean.
   *
   * @param value - The value to check
   * @returns True if the value is a boolean
   */
  isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  },

  /**
   * Checks if a value is an array.
   *
   * @template T - The type of array elements
   * @param value - The value to check
   * @returns True if the value is an array
   */
  isArray<T = unknown>(value: unknown): value is T[] {
    return Array.isArray(value);
  },

  /**
   * Safely parses a JSON string, returning a default value on error.
   *
   * @template T - The expected type of the parsed value
   * @param json - The JSON string to parse
   * @param fallback - The default value if parsing fails
   * @returns The parsed value or the fallback
   *
   * @example
   * ```ts
   * utils.parseJson('{"name":"bQuery"}', {}); // { name: 'bQuery' }
   * utils.parseJson('invalid', {}); // {}
   * ```
   */
  parseJson<T>(json: string, fallback: T): T {
    try {
      return JSON.parse(json) as T;
    } catch {
      return fallback;
    }
  },

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
   * utils.pick(user, ['name', 'email']); // { name: 'John', email: 'john@example.com' }
   * ```
   */
  pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  },

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
   * utils.omit(user, ['password']); // { name: 'John', age: 30 }
   * ```
   */
  omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result as Omit<T, K>;
  },

  /**
   * Delays execution for a specified number of milliseconds.
   *
   * @param ms - Milliseconds to delay
   * @returns A promise that resolves after the delay
   *
   * @example
   * ```ts
   * await utils.sleep(1000); // Wait 1 second
   * console.log('Done!');
   * ```
   */
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Generates a random integer between min and max (inclusive).
   *
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns A random integer in the range [min, max]
   *
   * @example
   * ```ts
   * const roll = utils.randomInt(1, 6); // Random dice roll
   * ```
   */
  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Clamps a number between a minimum and maximum value.
   *
   * @param value - The value to clamp
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns The clamped value
   *
   * @example
   * ```ts
   * utils.clamp(150, 0, 100); // 100
   * utils.clamp(-10, 0, 100); // 0
   * utils.clamp(50, 0, 100);  // 50
   * ```
   */
  clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  },

  /**
   * Capitalizes the first letter of a string.
   *
   * @param str - The string to capitalize
   * @returns The capitalized string
   *
   * @example
   * ```ts
   * utils.capitalize('hello'); // 'Hello'
   * ```
   */
  capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Converts a string to kebab-case.
   *
   * @param str - The string to convert
   * @returns The kebab-cased string
   *
   * @example
   * ```ts
   * utils.toKebabCase('myVariableName'); // 'my-variable-name'
   * ```
   */
  toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  },

  /**
   * Converts a string to camelCase.
   *
   * @param str - The string to convert
   * @returns The camelCased string
   *
   * @example
   * ```ts
   * utils.toCamelCase('my-variable-name'); // 'myVariableName'
   * ```
   */
  toCamelCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
      .replace(/^[A-Z]/, (char) => char.toLowerCase());
  },
};
