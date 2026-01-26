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
