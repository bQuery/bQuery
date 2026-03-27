/**
 * Built-in validation functions for form fields.
 *
 * Each factory returns a {@link SyncValidator} that can be passed
 * to a field's `validators` array in {@link FormConfig}.
 *
 * @module bquery/forms
 */

import type { AsyncValidator, SyncValidator } from './types';

/**
 * Requires a non-empty value.
 *
 * Fails for `undefined`, `null`, empty strings (after trim), and empty arrays.
 *
 * @param message - Custom error message (default: `'This field is required'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { required } from '@bquery/bquery/forms';
 * const validate = required('Name is required');
 * validate('');    // 'Name is required'
 * validate('Ada'); // true
 * ```
 */
export const required = (message = 'This field is required'): SyncValidator => {
  return (value: unknown) => {
    if (value == null) return message;
    if (typeof value === 'string' && value.trim() === '') return message;
    if (Array.isArray(value) && value.length === 0) return message;
    return true;
  };
};

/**
 * Requires a string to have at least `len` characters.
 *
 * Non-string values are coerced via `String()` before checking length.
 *
 * @param len - Minimum length
 * @param message - Custom error message
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { minLength } from '@bquery/bquery/forms';
 * const validate = minLength(3);
 * validate('ab');  // 'Must be at least 3 characters'
 * validate('abc'); // true
 * ```
 */
export const minLength = (len: number, message?: string): SyncValidator<unknown> => {
  const msg = message ?? `Must be at least ${len} characters`;
  return (value: unknown) => {
    const str = typeof value === 'string' ? value : String(value ?? '');
    return str.length >= len ? true : msg;
  };
};

/**
 * Requires a string to have at most `len` characters.
 *
 * Non-string values are coerced via `String()` before checking length.
 *
 * @param len - Maximum length
 * @param message - Custom error message
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { maxLength } from '@bquery/bquery/forms';
 * const validate = maxLength(10);
 * validate('hello world!!'); // 'Must be at most 10 characters'
 * validate('hello');         // true
 * ```
 */
export const maxLength = (len: number, message?: string): SyncValidator<unknown> => {
  const msg = message ?? `Must be at most ${len} characters`;
  return (value: unknown) => {
    const str = typeof value === 'string' ? value : String(value ?? '');
    return str.length <= len ? true : msg;
  };
};

/**
 * Requires a string to match a regular expression pattern.
 *
 * Non-string values are coerced via `String()` before testing.
 *
 * @param regex - Pattern to test against
 * @param message - Custom error message (default: `'Invalid format'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { pattern } from '@bquery/bquery/forms';
 * const validate = pattern(/^\d+$/, 'Numbers only');
 * validate('abc'); // 'Numbers only'
 * validate('123'); // true
 * ```
 */
export const pattern = (regex: RegExp, message = 'Invalid format'): SyncValidator<unknown> => {
  const safeRegex =
    regex.global || regex.sticky
      ? new RegExp(regex.source, regex.flags.replace(/[gy]/g, ''))
      : regex;

  return (value: unknown) => {
    const str = typeof value === 'string' ? value : String(value ?? '');
    safeRegex.lastIndex = 0;
    return safeRegex.test(str) ? true : message;
  };
};

/**
 * RFC 5322–simplified email validation.
 *
 * @param message - Custom error message (default: `'Invalid email address'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { email } from '@bquery/bquery/forms';
 * const validate = email();
 * validate('nope');          // 'Invalid email address'
 * validate('ada@lovelace'); // 'Invalid email address'
 * validate('ada@love.co');  // true
 * ```
 */
export const email = (message = 'Invalid email address'): SyncValidator<unknown> => {
  // Intentionally simple — covers the vast majority of valid addresses
  // without re-implementing the full RFC 5322 grammar.
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return (value: unknown) => {
    const str = typeof value === 'string' ? value : String(value ?? '');
    if (str === '') return true; // empty is handled by `required`
    return re.test(str) ? true : message;
  };
};

/**
 * Requires a string to be a valid URL.
 *
 * Uses the native `URL` constructor for validation.
 *
 * @param message - Custom error message (default: `'Invalid URL'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { url } from '@bquery/bquery/forms';
 * const validate = url();
 * validate('not-a-url');                // 'Invalid URL'
 * validate('https://example.com');      // true
 * ```
 */
export const url = (message = 'Invalid URL'): SyncValidator<unknown> => {
  return (value: unknown) => {
    const str = typeof value === 'string' ? value : String(value ?? '');
    if (str === '') return true; // empty is handled by `required`
    try {
      new URL(str);
      return true;
    } catch {
      return message;
    }
  };
};

/**
 * Requires a numeric value to be at least `limit`.
 *
 * @param limit - Minimum allowed value (inclusive)
 * @param message - Custom error message
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { min } from '@bquery/bquery/forms';
 * const validate = min(1, 'Must be positive');
 * validate(0); // 'Must be positive'
 * validate(1); // true
 * ```
 */
export const min = (limit: number, message?: string): SyncValidator<unknown> => {
  const msg = message ?? `Must be at least ${limit}`;
  return (value: unknown) => {
    if (value == null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    const num = typeof value === 'number' ? value : Number(value);
    return num >= limit ? true : msg;
  };
};

/**
 * Requires a numeric value to be at most `limit`.
 *
 * @param limit - Maximum allowed value (inclusive)
 * @param message - Custom error message
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { max } from '@bquery/bquery/forms';
 * const validate = max(100, 'Too high');
 * validate(101); // 'Too high'
 * validate(100); // true
 * ```
 */
export const max = (limit: number, message?: string): SyncValidator<unknown> => {
  const msg = message ?? `Must be at most ${limit}`;
  return (value: unknown) => {
    if (value == null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    const num = typeof value === 'number' ? value : Number(value);
    return num <= limit ? true : msg;
  };
};

/**
 * Creates a custom synchronous validator from any predicate function.
 *
 * @param fn - Predicate that returns `true` when the value is valid
 * @param message - Error message when the predicate returns `false`
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { custom } from '@bquery/bquery/forms';
 * const isEven = custom((v: number) => v % 2 === 0, 'Must be even');
 * isEven(3); // 'Must be even'
 * isEven(4); // true
 * ```
 */
export const custom = <T = unknown>(
  fn: (value: T) => boolean,
  message: string
): SyncValidator<T> => {
  return (value: T) => (fn(value) ? true : message);
};

/**
 * Creates a custom asynchronous validator.
 *
 * @param fn - Async predicate that resolves to `true` when valid
 * @param message - Error message when the predicate resolves to `false`
 * @returns An async validator function
 *
 * @example
 * ```ts
 * import { customAsync } from '@bquery/bquery/forms';
 * const isUnique = customAsync(
 *   async (name: string) => !(await checkExists(name)),
 *   'Already taken',
 * );
 * ```
 */
export const customAsync = <T = unknown>(
  fn: (value: T) => Promise<boolean>,
  message: string
): AsyncValidator<T> => {
  return async (value: T) => ((await fn(value)) ? true : message);
};
