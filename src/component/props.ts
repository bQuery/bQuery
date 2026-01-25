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
    const parsed = Number(rawValue);
    return (Number.isNaN(parsed) ? rawValue : parsed) as T;
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
    try {
      return callable(rawValue);
    } catch {
      return new constructable(rawValue);
    }
  }

  return rawValue as T;
};
