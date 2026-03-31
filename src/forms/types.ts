/**
 * Form module types and interfaces.
 *
 * @module bquery/forms
 */

import type { Computed, Signal } from '../reactive/index';

/**
 * Result of a single validation rule.
 * A string indicates an error message; `true` or `undefined` means valid.
 */
export type ValidationResult = string | true | undefined;

/**
 * Synchronous validator function.
 *
 * @param value - The current field value
 * @returns A validation result — `true` / `undefined` for valid, or an error string
 */
export type SyncValidator<T = unknown> = (value: T) => ValidationResult;

/**
 * Asynchronous validator function.
 *
 * @param value - The current field value
 * @returns A promise resolving to a validation result
 */
export type AsyncValidator<T = unknown> = (value: T) => Promise<ValidationResult>;

/**
 * Either a sync or async validator.
 */
export type Validator<T = unknown> = SyncValidator<T> | AsyncValidator<T>;

/**
 * Configuration for a single form field.
 *
 * @template T - The type of the field value
 */
export type FieldConfig<T = unknown> = {
  /** Initial value for this field */
  initialValue: T;
  /** Validation rules applied in order; stops at first failure */
  validators?: Validator<T>[];
};

/**
 * Reactive state for a single form field.
 *
 * @template T - The type of the field value
 */
export type FormField<T = unknown> = {
  /** Reactive signal holding the current value */
  value: Signal<T>;
  /** Reactive signal for the first validation error (empty string when valid) */
  error: Signal<string>;
  /** Whether the field value differs from its initial value */
  isDirty: Computed<boolean>;
  /** Whether the field has been interacted with (blur / explicit touch) */
  isTouched: Signal<boolean>;
  /** Whether the field has never been modified */
  isPristine: Computed<boolean>;
  /** Mark the field as touched */
  touch: () => void;
  /** Reset the field to its initial value and clear errors */
  reset: () => void;
};

/**
 * Controls when {@link useFormField} runs validation automatically.
 */
export type FormFieldValidationMode = 'manual' | 'change' | 'blur' | 'both';

/**
 * Configuration for {@link useFormField}.
 *
 * @template T - The type of the field value
 */
export type UseFormFieldOptions<T = unknown> = {
  /** Validation rules applied in order; stops at first failure */
  validators?: Validator<T>[];
  /** When validation should run automatically. Defaults to `'manual'`. */
  validateOn?: FormFieldValidationMode;
  /** Delay automatic validation by the given milliseconds. Defaults to `0`. */
  debounceMs?: number;
  /** Initial error message for the field. Defaults to an empty string. */
  initialError?: string;
};

/**
 * Return value of {@link useFormField}.
 *
 * Extends the standard field state with validation helpers for standalone field usage.
 *
 * @template T - The type of the field value
 */
export type UseFormFieldReturn<T = unknown> = FormField<T> & {
  /** Whether the current field has no validation error */
  isValid: Computed<boolean>;
  /** Reactive signal: `true` while async validation is still running */
  isValidating: Signal<boolean>;
  /** Validate the current field value immediately */
  validate: () => Promise<boolean>;
  /** Cancel pending timers and automatic validation subscriptions */
  destroy: () => void;
};

/**
 * Map of field names to their reactive field state.
 */
export type FormFields<T extends Record<string, unknown>> = {
  [K in keyof T]: FormField<T[K]>;
};

/**
 * Map of field names to their error strings (reactive signals).
 */
export type FormErrors<T extends Record<string, unknown>> = {
  [K in keyof T]: Signal<string>;
};

/**
 * Cross-field validation function.
 * Receives all current field values and returns a map of field name → error message,
 * or an empty object / undefined if all fields are valid.
 */
export type CrossFieldValidator<T extends Record<string, unknown>> = (
  values: T
) =>
  | Partial<Record<keyof T, string>>
  | undefined
  | Promise<Partial<Record<keyof T, string>> | undefined>;

/**
 * Submit handler function.
 *
 * @template T - Shape of the form values
 */
export type SubmitHandler<T extends Record<string, unknown>> = (values: T) => void | Promise<void>;

/**
 * Configuration for `createForm()`.
 *
 * @template T - Shape of the form values
 *
 * @example
 * ```ts
 * const config: FormConfig<{ name: string; age: number }> = {
 *   fields: {
 *     name: { initialValue: '', validators: [required('Name is required')] },
 *     age: { initialValue: 0, validators: [min(1, 'Must be positive')] },
 *   },
 *   onSubmit: (values) => console.log(values),
 * };
 * ```
 */
export type FormConfig<T extends Record<string, unknown>> = {
  /** Per-field configuration with initial values and validators */
  fields: { [K in keyof T]: FieldConfig<T[K]> };
  /** Optional cross-field validators run after per-field validation */
  crossValidators?: CrossFieldValidator<T>[];
  /** Callback invoked on successful form submission */
  onSubmit?: SubmitHandler<T>;
};

/**
 * Return value of `createForm()`.
 *
 * @template T - Shape of the form values
 */
export type Form<T extends Record<string, unknown>> = {
  /** Reactive field objects keyed by field name */
  fields: FormFields<T>;
  /** Shorthand error signals keyed by field name */
  errors: FormErrors<T>;
  /** Computed signal: `true` when all fields pass validation */
  isValid: Computed<boolean>;
  /** Computed signal: `true` when any field value differs from initial */
  isDirty: Computed<boolean>;
  /** Reactive signal: `true` while the submit handler is executing */
  isSubmitting: Signal<boolean>;
  /** Validate all fields and, if valid, call the `onSubmit` handler */
  handleSubmit: () => Promise<void>;
  /** Validate a single field by name */
  validateField: (name: keyof T & string) => Promise<void>;
  /** Validate all fields without submitting */
  validate: () => Promise<boolean>;
  /** Reset the entire form to initial values */
  reset: () => void;
  /** Get a snapshot of all current field values */
  getValues: () => T;
  /**
   * Bulk-set field values from a partial object.
   * Only fields present in the object are updated; missing keys are left unchanged.
   */
  setValues: (values: Partial<T>) => void;
  /**
   * Bulk-set field error messages from a partial object.
   * Useful for applying server-side validation errors.
   */
  setErrors: (errors: Partial<Record<keyof T & string, string>>) => void;
};
