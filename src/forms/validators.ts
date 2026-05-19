/**
 * Built-in validation functions for form fields.
 *
 * Each factory returns a {@link SyncValidator} that can be passed
 * to a field's `validators` array in {@link FormConfig}.
 *
 * @module bquery/forms
 */

import { isPromise } from '../core/utils/type-guards';
import type { AsyncValidator, SyncValidator, ValidationResult, Validator } from './types';

const stringifyValue = (value: unknown): string =>
  typeof value === 'string' ? value : String(value ?? '');

const isEmptyValue = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

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

/**
 * Requires a field's value to match the current value of a reference signal.
 *
 * Typically used for "confirm password" or "confirm email" patterns where
 * one field must have the same value as another.
 *
 * @param ref - A reactive signal whose current value is the comparison target
 * @param message - Custom error message (default: `'Fields do not match'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { signal } from '@bquery/bquery/reactive';
 * import { matchField } from '@bquery/bquery/forms';
 *
 * const password = signal('secret');
 * const confirmPassword = signal('');
 * const validateConfirmPassword = matchField(password, 'Passwords must match');
 *
 * validateConfirmPassword(confirmPassword.value);
 * ```
 */
export const matchField = <T>(
  ref: { readonly value: T },
  message = 'Fields do not match'
): SyncValidator<T> => {
  return (value: T) => (Object.is(value, ref.value) ? true : message);
};

// ---------------------------------------------------------------------------
// Strict numeric validators
// ---------------------------------------------------------------------------

/**
 * Requires the value to be a finite integer.
 *
 * Strings are accepted only when they parse cleanly to an integer (no decimals,
 * no extra whitespace beyond outer trim).
 *
 * @param message - Custom error message (default: `'Must be an integer'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { integer } from '@bquery/bquery/forms';
 * integer()('3.14'); // 'Must be an integer'
 * integer()('42');   // true
 * ```
 */
export const integer = (message = 'Must be an integer'): SyncValidator<unknown> => {
  return (value: unknown) => {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return true;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? true : message;
    }
    const str = stringifyValue(value).trim();
    if (!/^-?\d+$/.test(str)) return message;
    return Number.isInteger(Number(str)) ? true : message;
  };
};

/**
 * Requires the value to be a finite number (integer or decimal).
 *
 * @param message - Custom error message (default: `'Must be a number'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { numeric } from '@bquery/bquery/forms';
 * numeric()('abc'); // 'Must be a number'
 * numeric()('3.5'); // true
 * ```
 */
export const numeric = (message = 'Must be a number'): SyncValidator<unknown> => {
  return (value: unknown) => {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return true;
    if (typeof value === 'number') return Number.isFinite(value) ? true : message;
    const str = stringifyValue(value).trim();
    if (str === '') return true;
    if (!/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(str)) return message;
    return Number.isFinite(Number(str)) ? true : message;
  };
};

/**
 * Requires a numeric value to fall within the inclusive `[minLimit, maxLimit]` range.
 *
 * @param minLimit - Inclusive lower bound
 * @param maxLimit - Inclusive upper bound
 * @param message - Custom error message
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { between } from '@bquery/bquery/forms';
 * between(1, 10)(0);  // 'Must be between 1 and 10'
 * between(1, 10)(5);  // true
 * ```
 */
export const between = (
  minLimit: number,
  maxLimit: number,
  message?: string
): SyncValidator<unknown> => {
  const msg = message ?? `Must be between ${minLimit} and ${maxLimit}`;
  return (value: unknown) => {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return true;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return msg;
    return num >= minLimit && num <= maxLimit ? true : msg;
  };
};

// ---------------------------------------------------------------------------
// Length and membership validators
// ---------------------------------------------------------------------------

/**
 * Requires a string or array to have exactly `exact` items/characters.
 *
 * @param exact - Required length
 * @param message - Custom error message
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { length } from '@bquery/bquery/forms';
 * length(3)('ab');   // 'Must be exactly 3 characters'
 * length(3)('abc');  // true
 * length(2)([1, 2]); // true
 * ```
 */
export const length = (exact: number, message?: string): SyncValidator<unknown> => {
  const msg = message ?? `Must be exactly ${exact} characters`;
  return (value: unknown) => {
    if (Array.isArray(value)) return value.length === exact ? true : msg;
    const str = stringifyValue(value);
    return str.length === exact ? true : msg;
  };
};

/**
 * Requires the value to be one of `values` (using `Object.is` for comparison).
 *
 * @param values - Allowed values
 * @param message - Custom error message (default: `'Invalid value'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { oneOf } from '@bquery/bquery/forms';
 * oneOf(['a', 'b'])('c'); // 'Invalid value'
 * oneOf(['a', 'b'])('a'); // true
 * ```
 */
export const oneOf = <T>(values: readonly T[], message = 'Invalid value'): SyncValidator<T> => {
  return (value: T) => {
    for (const allowed of values) {
      if (Object.is(value, allowed)) return true;
    }
    return message;
  };
};

/**
 * Rejects values that match any item in `values` (using `Object.is`).
 *
 * @param values - Disallowed values
 * @param message - Custom error message (default: `'Value is not allowed'`)
 * @returns A sync validator function
 */
export const notOneOf = <T>(
  values: readonly T[],
  message = 'Value is not allowed'
): SyncValidator<T> => {
  return (value: T) => {
    for (const blocked of values) {
      if (Object.is(value, blocked)) return message;
    }
    return true;
  };
};

/**
 * Validates each item in an array against `itemValidator`.
 *
 * Returns the first item error (prefixed with `[index]`) when any item fails.
 * Non-array values pass through unchanged so this validator can be composed
 * with `required()` to enforce presence separately.
 *
 * @param itemValidator - Validator applied to every array element
 * @param message - Optional custom prefix; default reports the failing index
 * @returns A sync or async validator
 *
 * @example
 * ```ts
 * import { arrayOf, required } from '@bquery/bquery/forms';
 * const noEmpty = arrayOf(required('Cannot be empty'));
 * noEmpty(['a', '']); // '[1] Cannot be empty'
 * ```
 */
export const arrayOf = <T>(
  itemValidator: Validator<T>,
  message?: string
): Validator<readonly T[]> => {
  return ((value: readonly T[]) => {
    if (!Array.isArray(value)) return true;
    let index = 0;
    for (const item of value) {
      const result = itemValidator(item);
      const finalize = (resolved: ValidationResult): ValidationResult => {
        if (resolved === true || resolved === undefined) return true;
        const prefix = `[${index}] `;
        return message ?? `${prefix}${resolved}`;
      };
      if (isPromise(result)) {
        // Async path: chain remaining items
        const captured = index;
        const initial = result;
        return (async () => {
          let i = captured;
          const head = await initial;
          const headFinal = finalize(head);
          if (headFinal !== true) return headFinal;
          i += 1;
          for (; i < value.length; i += 1) {
            const next = itemValidator(value[i]);
            const resolved = isPromise(next) ? await next : next;
            if (resolved !== true && resolved !== undefined) {
              const prefix = `[${i}] `;
              return message ?? `${prefix}${resolved}`;
            }
          }
          return true;
        })();
      }
      const final = finalize(result);
      if (final !== true) return final;
      index += 1;
    }
    return true;
  }) as Validator<readonly T[]>;
};

// ---------------------------------------------------------------------------
// Conditional required
// ---------------------------------------------------------------------------

/**
 * Requires a non-empty value only when `predicate` returns truthy.
 *
 * Useful for fields that become mandatory based on other state (e.g. another
 * field's value). The predicate receives the current field value but the
 * decision can be based on any captured state.
 *
 * @param predicate - Function that decides whether the value is required
 * @param message - Custom error message (default: `'This field is required'`)
 * @returns A sync validator function
 *
 * @example
 * ```ts
 * import { requiredIf } from '@bquery/bquery/forms';
 * import { signal } from '@bquery/bquery/reactive';
 *
 * const wantsNewsletter = signal(true);
 * const validate = requiredIf(() => wantsNewsletter.value);
 * ```
 */
export const requiredIf = <T = unknown>(
  predicate: (value: T) => unknown,
  message = 'This field is required'
): SyncValidator<T> => {
  return (value: T) => {
    if (!predicate(value)) return true;
    return isEmptyValue(value) ? message : true;
  };
};

/**
 * Requires a non-empty value unless `predicate` returns truthy.
 *
 * @param predicate - Function that decides whether the value is optional
 * @param message - Custom error message (default: `'This field is required'`)
 * @returns A sync validator function
 */
export const requiredUnless = <T = unknown>(
  predicate: (value: T) => unknown,
  message = 'This field is required'
): SyncValidator<T> => {
  return (value: T) => {
    if (predicate(value)) return true;
    return isEmptyValue(value) ? message : true;
  };
};

// ---------------------------------------------------------------------------
// Date validators
// ---------------------------------------------------------------------------

const toDate = (value: unknown): Date | undefined => {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

/**
 * Requires the value to be a parseable date.
 *
 * Accepts `Date` instances, ISO date strings, and numeric timestamps. Empty
 * values pass through and should be combined with `required()` when needed.
 *
 * @param message - Custom error message (default: `'Invalid date'`)
 * @returns A sync validator function
 */
export const validDate = (message = 'Invalid date'): SyncValidator<unknown> => {
  return (value: unknown) => {
    if (value == null || value === '') return true;
    return toDate(value) ? true : message;
  };
};

/**
 * Requires a date value to be strictly after `date`.
 *
 * @param date - The reference date (Date, ISO string, or timestamp number)
 * @param message - Custom error message
 * @returns A sync validator function
 */
export const dateAfter = (
  date: Date | string | number,
  message?: string
): SyncValidator<unknown> => {
  const target = toDate(date);
  return (value: unknown) => {
    if (value == null || value === '') return true;
    const parsed = toDate(value);
    if (!parsed || !target) return message ?? 'Invalid date';
    return parsed.getTime() > target.getTime()
      ? true
      : (message ?? `Must be after ${target.toISOString()}`);
  };
};

/**
 * Requires a date value to be strictly before `date`.
 *
 * @param date - The reference date (Date, ISO string, or timestamp number)
 * @param message - Custom error message
 * @returns A sync validator function
 */
export const dateBefore = (
  date: Date | string | number,
  message?: string
): SyncValidator<unknown> => {
  const target = toDate(date);
  return (value: unknown) => {
    if (value == null || value === '') return true;
    const parsed = toDate(value);
    if (!parsed || !target) return message ?? 'Invalid date';
    return parsed.getTime() < target.getTime()
      ? true
      : (message ?? `Must be before ${target.toISOString()}`);
  };
};

// ---------------------------------------------------------------------------
// File validators
// ---------------------------------------------------------------------------

const iterateFiles = (value: unknown): File[] => {
  if (value == null) return [];
  if (typeof File !== 'undefined' && value instanceof File) return [value];
  if (typeof FileList !== 'undefined' && value instanceof FileList) {
    return Array.from(value);
  }
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is File => typeof File !== 'undefined' && item instanceof File
    );
  }
  return [];
};

/**
 * Requires every `File` in the value to be at most `maxBytes` in size.
 *
 * Accepts a single `File`, a `FileList`, or an array of `File`s. Non-file
 * values pass through unchanged.
 *
 * @param maxBytes - Maximum allowed file size in bytes
 * @param message - Custom error message
 * @returns A sync validator function
 */
export const fileSize = (maxBytes: number, message?: string): SyncValidator<unknown> => {
  const msg = message ?? `File must be at most ${maxBytes} bytes`;
  return (value: unknown) => {
    const files = iterateFiles(value);
    if (files.length === 0) return true;
    for (const file of files) {
      if (file.size > maxBytes) return msg;
    }
    return true;
  };
};

/**
 * Requires every `File` in the value to match one of the allowed MIME types.
 *
 * Allowed types support wildcards like `'image/*'`.
 *
 * @param allowedMime - Allowed MIME type list
 * @param message - Custom error message
 * @returns A sync validator function
 */
export const fileType = (
  allowedMime: readonly string[],
  message?: string
): SyncValidator<unknown> => {
  const msg = message ?? `File must be one of: ${allowedMime.join(', ')}`;
  return (value: unknown) => {
    const files = iterateFiles(value);
    if (files.length === 0) return true;
    for (const file of files) {
      const type = (file.type ?? '').toLowerCase();
      let matched = false;
      for (const allowed of allowedMime) {
        const lower = allowed.toLowerCase();
        if (lower === type) {
          matched = true;
          break;
        }
        if (lower.endsWith('/*') && type.startsWith(lower.slice(0, -1))) {
          matched = true;
          break;
        }
      }
      if (!matched) return msg;
    }
    return true;
  };
};

// ---------------------------------------------------------------------------
// Composition combinators
// ---------------------------------------------------------------------------

const resolveResult = (result: ValidationResult): string | undefined =>
  result === true || result === undefined ? undefined : (result as string);

/**
 * Combines multiple validators; returns on the first failure (logical AND).
 *
 * Equivalent to passing the validators in order to a field's `validators`
 * array, but useful when you want to expose a single composed validator.
 *
 * @example
 * ```ts
 * import { compose, required, minLength } from '@bquery/bquery/forms';
 * const usernameRule = compose(required(), minLength(3));
 * ```
 */
export const compose = <T = unknown>(...validators: Validator<T>[]): Validator<T> => {
  return ((value: T) => {
    for (let i = 0; i < validators.length; i += 1) {
      const result = validators[i](value);
      if (isPromise(result)) {
        const captured = i;
        const initial = result;
        return (async () => {
          const head = resolveResult(await initial);
          if (head !== undefined) return head;
          for (let j = captured + 1; j < validators.length; j += 1) {
            const next = validators[j](value);
            const resolved = resolveResult(isPromise(next) ? await next : next);
            if (resolved !== undefined) return resolved;
          }
          return true;
        })();
      }
      const resolved = resolveResult(result);
      if (resolved !== undefined) return resolved;
    }
    return true;
  }) as Validator<T>;
};

/**
 * Runs all validators and joins their error messages with `separator`.
 *
 * Unlike `compose`, this does not short-circuit; it collects every failure
 * and reports them together, useful for "show all issues at once" UX.
 *
 * @param validators - Validators to run
 * @param separator - String used to join messages (default: `'; '`)
 * @returns A validator function
 */
export const all = <T = unknown>(
  validators: Validator<T>[],
  separator = '; '
): Validator<T> => {
  return ((value: T) => {
    const results: (ValidationResult | Promise<ValidationResult>)[] = [];
    let anyAsync = false;
    for (const v of validators) {
      const r = v(value);
      results.push(r);
      if (isPromise(r)) anyAsync = true;
    }
    if (!anyAsync) {
      const errors: string[] = [];
      for (const r of results as ValidationResult[]) {
        const resolved = resolveResult(r);
        if (resolved !== undefined) errors.push(resolved);
      }
      return errors.length === 0 ? true : errors.join(separator);
    }
    return (async () => {
      const errors: string[] = [];
      for (const r of results) {
        const resolved = resolveResult(isPromise(r) ? await r : r);
        if (resolved !== undefined) errors.push(resolved);
      }
      return errors.length === 0 ? true : errors.join(separator);
    })();
  }) as Validator<T>;
};

/**
 * Inverts a validator's result.
 *
 * If the inner validator returns valid, this validator fails with `message`;
 * if the inner validator fails, this one passes.
 *
 * @example
 * ```ts
 * import { not, oneOf } from '@bquery/bquery/forms';
 * const notReserved = not(oneOf(['admin', 'root']), 'Username is reserved');
 * ```
 */
export const not = <T = unknown>(validator: Validator<T>, message = 'Invalid value'): Validator<T> => {
  return ((value: T) => {
    const result = validator(value);
    if (isPromise(result)) {
      return (async () => {
        const resolved = await result;
        return resolved === true || resolved === undefined ? message : true;
      })();
    }
    return result === true || result === undefined ? message : true;
  }) as Validator<T>;
};

/**
 * Wraps a validator, replacing its error message with `message`.
 *
 * Useful for adapting library validators to your i18n strings without
 * re-writing the rules.
 *
 * @example
 * ```ts
 * import { withMessage, email } from '@bquery/bquery/forms';
 * const v = withMessage(email(), 'Please enter a valid email');
 * ```
 */
export const withMessage = <T = unknown>(
  validator: Validator<T>,
  message: string
): Validator<T> => {
  return ((value: T) => {
    const result = validator(value);
    if (isPromise(result)) {
      return (async () => {
        const resolved = await result;
        return resolved === true || resolved === undefined ? true : message;
      })();
    }
    return result === true || result === undefined ? true : message;
  }) as Validator<T>;
};

// (Type re-exports happen through src/forms/index.ts barrel.)
