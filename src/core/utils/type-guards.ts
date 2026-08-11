/**
 * Type guard helpers.
 *
 * @module bquery/core/utils/type-guards
 */

/**
 * Checks if a value is a DOM Element.
 *
 * @param value - The value to check
 * @returns True if the value is an Element
 */
export function isElement(value: unknown): value is Element {
  return typeof Element !== 'undefined' && value instanceof Element;
}

/**
 * Checks if a value is a BQueryCollection-like object.
 *
 * @param value - The value to check
 * @returns True if the value has an elements array property
 */
export function isCollection(value: unknown): value is { elements: Element[] } {
  return Boolean(value && typeof value === 'object' && 'elements' in (value as object));
}

/**
 * Checks if a value is a function.
 *
 * @param value - The value to check
 * @returns True if the value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Checks if a value is a string.
 *
 * @param value - The value to check
 * @returns True if the value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Checks if a value is a number (excluding NaN).
 *
 * @param value - The value to check
 * @returns True if the value is a valid number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Checks if a value is a boolean.
 *
 * @param value - The value to check
 * @returns True if the value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Checks if a value is an array.
 *
 * @template T - The type of array elements
 * @param value - The value to check
 * @returns True if the value is an array
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Checks if a value is a Date instance.
 *
 * @param value - The value to check
 * @returns True if the value is a Date
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * Checks if a value is a Promise-like object.
 *
 * @param value - The value to check
 * @returns True if the value is a Promise-like object
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return Boolean(
    value &&
    (value instanceof Promise ||
      (typeof value === 'object' &&
        'then' in (value as object) &&
        typeof (value as { then?: unknown }).then === 'function'))
  );
}

/**
 * Checks if a value is a non-null object.
 *
 * @param value - The value to check
 * @returns True if the value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks if a value is an `Error` instance (or a subclass thereof).
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Checks if a value is a `Map` instance.
 */
export function isMap<K = unknown, V = unknown>(value: unknown): value is Map<K, V> {
  return value instanceof Map;
}

/**
 * Checks if a value is a `Set` instance.
 */
export function isSet<T = unknown>(value: unknown): value is Set<T> {
  return value instanceof Set;
}

/**
 * Checks if a value is a `RegExp` instance.
 */
export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

/**
 * Checks if a value is a `symbol`.
 */
export function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

/**
 * Checks if a value is a `bigint`.
 */
export function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

/**
 * Heuristically checks if a value is an `async function`. Note that
 * functions transpiled to generators may not match exactly; use with care.
 */
export function isAsyncFunction(value: unknown): boolean {
  if (typeof value !== 'function') return false;
  return Object.prototype.toString.call(value) === '[object AsyncFunction]';
}

/**
 * Checks if a value is iterable (i.e. has a `[Symbol.iterator]` method).
 */
export function isIterable<T = unknown>(value: unknown): value is Iterable<T> {
  if (value === null || value === undefined) return false;
  return typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';
}

/**
 * Checks if a value is async-iterable (i.e. has a `[Symbol.asyncIterator]` method).
 */
export function isAsyncIterable<T = unknown>(value: unknown): value is AsyncIterable<T> {
  if (value === null || value === undefined) return false;
  return (
    typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
  );
}

/**
 * Checks if a value is `null` or `undefined`.
 */
export function isNullish(value: unknown): value is null | undefined {
  return value == null;
}

/**
 * Checks if a value is neither `null` nor `undefined`. Type narrows to
 * `NonNullable<T>` for downstream usage.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
