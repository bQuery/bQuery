/**
 * Fluent schema-style builder for form field configuration.
 *
 * @module bquery/forms
 */

import type { FieldConfig, FormConfig, Validator } from './types';
import {
  between,
  email,
  integer,
  length,
  matchField,
  max,
  maxLength,
  min,
  minLength,
  notOneOf,
  numeric,
  oneOf,
  pattern,
  required,
  url,
} from './validators';

/**
 * Fluent builder for a single field's validator chain.
 *
 * Builders are immutable: every chain method returns a new builder, so the
 * same starting point can be reused safely.
 */
export type FieldSchema<T = unknown> = {
  /** Underlying validator list (frozen). */
  readonly validators: readonly Validator<T>[];
  /** Append a `required()` validator. */
  required: (message?: string) => FieldSchema<T>;
  /** Append a `min()` validator. */
  min: (limit: number, message?: string) => FieldSchema<T>;
  /** Append a `max()` validator. */
  max: (limit: number, message?: string) => FieldSchema<T>;
  /** Append a `minLength()` validator. */
  minLength: (limit: number, message?: string) => FieldSchema<T>;
  /** Append a `maxLength()` validator. */
  maxLength: (limit: number, message?: string) => FieldSchema<T>;
  /** Append a `length()` validator. */
  length: (exact: number, message?: string) => FieldSchema<T>;
  /** Append an `email()` validator. */
  email: (message?: string) => FieldSchema<T>;
  /** Append a `url()` validator. */
  url: (message?: string) => FieldSchema<T>;
  /** Append a `pattern()` validator. */
  pattern: (regex: RegExp, message?: string) => FieldSchema<T>;
  /** Append an `integer()` validator. */
  integer: (message?: string) => FieldSchema<T>;
  /** Append a `numeric()` validator. */
  numeric: (message?: string) => FieldSchema<T>;
  /** Append a `between()` validator. */
  between: (minLimit: number, maxLimit: number, message?: string) => FieldSchema<T>;
  /** Append a `oneOf()` validator. */
  oneOf: (values: readonly T[], message?: string) => FieldSchema<T>;
  /** Append a `notOneOf()` validator. */
  notOneOf: (values: readonly T[], message?: string) => FieldSchema<T>;
  /** Append a `matchField()` validator. */
  matchField: (ref: { readonly value: T }, message?: string) => FieldSchema<T>;
  /** Append an arbitrary custom validator. */
  custom: (validator: Validator<T>) => FieldSchema<T>;
  /** Finalize as a {@link FieldConfig} with the given initial value. */
  toConfig: (initialValue: T, extras?: Omit<FieldConfig<T>, 'initialValue' | 'validators'>) => FieldConfig<T>;
};

const chain = <T>(validators: readonly Validator<T>[]): FieldSchema<T> => {
  const append = (v: Validator<T>): FieldSchema<T> => chain([...validators, v]);
  return {
    validators: Object.freeze([...validators]),
    required: (m?: string) => append(required(m) as Validator<T>),
    min: (n: number, m?: string) => append(min(n, m) as Validator<T>),
    max: (n: number, m?: string) => append(max(n, m) as Validator<T>),
    minLength: (n: number, m?: string) => append(minLength(n, m) as Validator<T>),
    maxLength: (n: number, m?: string) => append(maxLength(n, m) as Validator<T>),
    length: (n: number, m?: string) => append(length(n, m) as Validator<T>),
    email: (m?: string) => append(email(m) as Validator<T>),
    url: (m?: string) => append(url(m) as Validator<T>),
    pattern: (r: RegExp, m?: string) => append(pattern(r, m) as Validator<T>),
    integer: (m?: string) => append(integer(m) as Validator<T>),
    numeric: (m?: string) => append(numeric(m) as Validator<T>),
    between: (lo: number, hi: number, m?: string) => append(between(lo, hi, m) as Validator<T>),
    oneOf: (values: readonly T[], m?: string) => append(oneOf(values, m) as Validator<T>),
    notOneOf: (values: readonly T[], m?: string) => append(notOneOf(values, m) as Validator<T>),
    matchField: (ref: { readonly value: T }, m?: string) =>
      append(matchField(ref, m) as Validator<T>),
    custom: (validator: Validator<T>) => append(validator),
    toConfig: (initialValue: T, extras = {}) => ({
      initialValue,
      validators: [...validators],
      ...extras,
    }),
  };
};

/**
 * Start a fluent field schema chain.
 *
 * @example
 * ```ts
 * import { field, schema } from '@bquery/bquery/forms';
 *
 * const form = createForm(schema({
 *   name:  field<string>().required().minLength(2),
 *   email: field<string>().required().email(),
 *   age:   field<number>().integer().between(0, 150),
 * }));
 * ```
 */
export const field = <T = unknown>(): FieldSchema<T> => chain<T>([]);

/**
 * A schema entry can be either a fluent builder (with optional initial value),
 * a fully-formed {@link FieldConfig}, or just a plain initial value (no validators).
 */
export type SchemaEntry<T = unknown> = FieldSchema<T> | FieldConfig<T> | T;

const isFieldSchema = <T>(value: unknown): value is FieldSchema<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toConfig?: unknown }).toConfig === 'function' &&
    Array.isArray((value as { validators?: unknown }).validators)
  );
};

const isFieldConfig = <T>(value: unknown): value is FieldConfig<T> => {
  if (typeof value !== 'object' || value === null) return false;
  if (!Object.prototype.hasOwnProperty.call(value, 'initialValue')) return false;
  const ownKeys = Object.keys(value as Record<string, unknown>);
  if (ownKeys.length === 1) return true;

  return (
    Object.prototype.hasOwnProperty.call(value, 'validators') ||
    Object.prototype.hasOwnProperty.call(value, 'validateOn') ||
    Object.prototype.hasOwnProperty.call(value, 'debounceMs') ||
    Object.prototype.hasOwnProperty.call(value, 'parse') ||
    Object.prototype.hasOwnProperty.call(value, 'format') ||
    Object.prototype.hasOwnProperty.call(value, 'disabled')
  );
};

/**
 * Schema-style declaration helper that converts a map of fluent field
 * builders, raw {@link FieldConfig}s, or plain initial values into a
 * `FormConfig['fields']` object ready for {@link createForm}.
 *
 * @param shape - Map of field name → {@link SchemaEntry}
 * @param defaults - Optional initial values, used when an entry is a `FieldSchema` without an initial value
 * @returns Partial form config containing `fields`; merge with `onSubmit`, `crossValidators`, etc.
 *
 * @example
 * ```ts
 * import { createForm, schema, field } from '@bquery/bquery/forms';
 *
 * const form = createForm({
 *   ...schema({
 *     name:  field<string>().required(),
 *     email: field<string>().required().email(),
 *   }, { name: '', email: '' }),
 *   onSubmit: async (values) => { ... },
 * });
 * ```
 */
export const schema = <T extends Record<string, unknown>>(
  shape: { [K in keyof T]: SchemaEntry<T[K]> },
  defaults?: Partial<T>
): Pick<FormConfig<T>, 'fields'> => {
  const fields = {} as { [K in keyof T]: FieldConfig<T[K]> };
  for (const key of Object.keys(shape) as (keyof T & string)[]) {
    const entry = shape[key];
    if (isFieldSchema<T[typeof key]>(entry)) {
      if (!defaults || !Object.prototype.hasOwnProperty.call(defaults, key)) {
        throw new Error(
          `bQuery forms: schema() requires a default value for fluent field "${key}"`
        );
      }
      const initial = defaults[key] as T[typeof key];
      fields[key] = entry.toConfig(initial);
    } else if (isFieldConfig<T[typeof key]>(entry)) {
      fields[key] = entry;
    } else {
      fields[key] = { initialValue: entry as T[typeof key] };
    }
  }
  return { fields };
};
