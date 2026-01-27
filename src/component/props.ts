/**
 * Prop coercion utilities.
 *
 * @module bquery/component
 */

import type { PropDefinition } from './types';

/**
 * Coerces a string attribute value into a typed prop value.
 * Supports String, Number, Boolean, Object, Array, and custom converters.
 *
 * @internal
 * @template T - The target type
 * @param rawValue - The raw string value from the attribute
 * @param config - The prop definition with type information
 * @returns The coerced value of type T
 */
export const coercePropValue = <T>(rawValue: string, config: PropDefinition<T>): T => {
  const { type } = config;

  if (type === String) return rawValue as T;

  if (type === Number) {
    return Number(rawValue) as T;
  }

  if (type === Boolean) {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === '' || normalized === 'true' || normalized === '1') {
      return true as T;
    }
    if (normalized === 'false' || normalized === '0') {
      return false as T;
    }
    return Boolean(rawValue) as T;
  }

  if (type === Object || type === Array) {
    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return rawValue as T;
    }
  }

  if (typeof type === 'function') {
    const callable = type as (value: unknown) => T;
    const constructable = type as new (value: unknown) => T;

    // Check if type is constructable (has a prototype with properties beyond constructor)
    const isConstructable =
      type.prototype !== undefined &&
      type.prototype !== null &&
      (Object.getOwnPropertyNames(type.prototype).length > 1 ||
        type.prototype.constructor !== type);

    // For constructable types (e.g. Date, custom classes), prefer `new` to avoid
    // silent wrong-type returns (Date() returns string, new Date() returns Date)
    if (isConstructable) {
      try {
        return Reflect.construct(constructable, [rawValue]) as T;
      } catch {
        // Fall back to calling as function if construction fails
        return callable(rawValue);
      }
    }

    // For non-constructable types (arrow functions, plain functions), call directly
    try {
      return callable(rawValue);
    } catch (error) {
      // Fall back to constructor only if error explicitly indicates 'new' is required
      const isNewRequired =
        error instanceof TypeError &&
        /cannot be invoked without 'new'|is not a function/i.test(error.message);

      if (isNewRequired) {
        return new constructable(rawValue);
      }

      // Rethrow original error for non-constructable converters
      throw error;
    }
  }

  return rawValue as T;
};
