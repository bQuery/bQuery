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
 */
export type SyncValidator<T = unknown> = (value: T) => ValidationResult;

/**
 * Asynchronous validator function.
 */
export type AsyncValidator<T = unknown> = (value: T) => Promise<ValidationResult>;

/**
 * Either a sync or async validator.
 */
export type Validator<T = unknown> = SyncValidator<T> | AsyncValidator<T>;

/**
 * When automatic field validation should run.
 *
 * - `'manual'`: only when explicitly triggered
 * - `'change'`: every value mutation triggers validation
 * - `'blur'`: validation runs when the field is touched
 * - `'both'`: validate on both change and blur
 */
export type FormFieldValidationMode = 'manual' | 'change' | 'blur' | 'both';

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
  /**
   * Per-field automatic validation mode. Overrides the form-level
   * `validationStrategy` for this field only. Defaults to `'manual'`.
   */
  validateOn?: FormFieldValidationMode;
  /** Delay automatic validation by the given milliseconds. */
  debounceMs?: number;
  /** Optional transform applied to values passed through `setValues()` / `restore()`. */
  parse?: (raw: unknown) => T;
  /** Optional transform applied to outgoing values from `getValues()` / submit payloads. */
  format?: (value: T) => T;
  /**
   * When `true`, the field starts disabled. Disabled fields are skipped by
   * `validate()` and `handleSubmit()`.
   */
  disabled?: boolean;
};

/**
 * Options accepted by {@link FormField.setValue}.
 */
export type SetFieldValueOptions = {
  /** Mark the field as touched after writing the value. */
  touch?: boolean;
  /** Trigger validation for this field after writing the value. */
  validate?: boolean;
  /** Skip automatic validation/subscriber side effects for this write. */
  silent?: boolean;
};

/**
 * Options accepted by {@link useFormField().setValue}.
 */
export type UseFormFieldSetValueOptions = SetFieldValueOptions;

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
  /** Reactive signal: `true` while async validation is still running */
  isValidating: Signal<boolean>;
  /** Reactive signal: `true` while the field has focus */
  isFocused: Signal<boolean>;
  /** Reactive signal: `true` while the field is disabled and skipped by validation */
  disabled: Signal<boolean>;
  /** Timestamp (ms since epoch) of the first change since reset, or `null` while pristine */
  dirtySince: Signal<number | null>;
  /** Mark the field as touched */
  touch: () => void;
  /** Reset the field to its initial value and clear errors */
  reset: () => void;
  /** Atomically set the field value with an optional touch flag. */
  setValue: (value: T, options?: SetFieldValueOptions) => void;
  /** Set the field's error message. */
  setError: (message: string) => void;
  /** Clear the field's error message. */
  clearError: () => void;
  /** Mark the field as focused (does not call DOM `focus()`). */
  focus: () => void;
  /** Mark the field as blurred (does not call DOM `blur()`). */
  blur: () => void;
};

/**
 * Configuration for {@link useFormField}.
 */
export type UseFormFieldOptions<T = unknown> = {
  /** Validation rules applied in order; stops at first failure */
  validators?: Validator<T>[];
  /** When validation should run automatically. */
  validateOn?: FormFieldValidationMode;
  /** Delay automatic validation by the given milliseconds. */
  debounceMs?: number;
  /** Initial error message for the field. */
  initialError?: string;
};

/**
 * Return value of {@link useFormField}.
 */
export type UseFormFieldReturn<T = unknown> = FormField<T> & {
  /** Standalone fields support immediate validation via `setValue(..., { validate: true })`. */
  setValue: (value: T, options?: UseFormFieldSetValueOptions) => void;
  /** Whether the current field has no validation error */
  isValid: Computed<boolean>;
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
 */
export type CrossFieldValidator<T extends Record<string, unknown>> = (
  values: T
) =>
  | Partial<Record<keyof T, string>>
  | undefined
  | Promise<Partial<Record<keyof T, string>> | undefined>;

/**
 * Submit handler function.
 */
export type SubmitHandler<T extends Record<string, unknown>> = (values: T) => void | Promise<void>;

/**
 * Form-wide automatic validation strategy applied to fields that do not
 * declare their own `validateOn`.
 */
export type FormValidationStrategy = 'onChange' | 'onBlur' | 'onSubmit' | 'manual';

/**
 * Determines whether `form.validate()` stops at the first failing per-field
 * validator (`'first'`) or runs all of them (`'all'`).
 */
export type FormValidationMode = 'first' | 'all';

/**
 * A coarse change listener subscribed via {@link Form.subscribe}.
 */
export type FormChangeListener<T extends Record<string, unknown>> = (values: T) => void;

/**
 * Configuration for `createForm()`.
 */
export type FormConfig<T extends Record<string, unknown>> = {
  /** Per-field configuration */
  fields: { [K in keyof T]: FieldConfig<T[K]> };
  /** Optional cross-field validators */
  crossValidators?: CrossFieldValidator<T>[];
  /** Successful-submit callback */
  onSubmit?: SubmitHandler<T>;
  /** Error callback when the submit handler throws or rejects. */
  onSubmitError?: (error: unknown, values: T) => void | Promise<void>;
  /** Callback invoked after a successful submit. */
  onSubmitSuccess?: (values: T) => void | Promise<void>;
  /** Form-wide validation strategy. Defaults to `'manual'`. */
  validationStrategy?: FormValidationStrategy;
  /** Per-field validation mode. Defaults to `'first'`. */
  mode?: FormValidationMode;
};

/**
 * Plain snapshot of form values + errors + touched flags.
 */
export type FormSnapshot<T extends Record<string, unknown>> = {
  values: T;
  errors: Partial<Record<keyof T & string, string>>;
  touched: Partial<Record<keyof T & string, boolean>>;
};

/**
 * Return value of `createForm()`.
 */
export type Form<T extends Record<string, unknown>> = {
  fields: FormFields<T>;
  errors: FormErrors<T>;
  isValid: Computed<boolean>;
  isDirty: Computed<boolean>;
  isPristine: Computed<boolean>;
  isValidating: Computed<boolean>;
  isSubmitting: Signal<boolean>;
  submitCount: Signal<number>;
  lastSubmittedAt: Signal<number | null>;
  submitError: Signal<unknown>;
  handleSubmit: () => Promise<void>;
  validateField: (name: keyof T & string) => Promise<void>;
  validate: () => Promise<boolean>;
  reset: () => void;
  resetField: (name: keyof T & string) => void;
  resetErrors: () => void;
  touchAll: () => void;
  untouchAll: () => void;
  getValues: () => T;
  getDirtyValues: () => Partial<T>;
  setValues: (values: Partial<T>) => void;
  setErrors: (errors: Partial<Record<keyof T & string, string>>) => void;
  subscribe: (listener: FormChangeListener<T>) => () => void;
  snapshot: () => FormSnapshot<T>;
  restore: (snapshot: FormSnapshot<T>) => void;
  toFormData: () => FormData;
  toJSON: () => T;
  destroy: () => void;
};

// ---------------------------------------------------------------------------
// Field arrays
// ---------------------------------------------------------------------------

/**
 * Configuration for {@link createFieldArray}.
 */
export type FieldArrayConfig<T> = {
  /** Initial items. */
  initial?: readonly T[];
  /** Factory that creates a {@link FormField} for each array item. */
  factory: (value: T) => FormField<T>;
  /** Validators applied to the entire array. */
  validators?: Validator<readonly T[]>[];
};

/**
 * Reactive array of fields with mutation helpers.
 */
export type FormFieldArray<T = unknown> = {
  items: Signal<readonly FormField<T>[]>;
  length: Computed<number>;
  error: Signal<string>;
  add: (value?: T) => FormField<T>;
  insert: (index: number, value: T) => FormField<T>;
  remove: (index: number) => boolean;
  move: (from: number, to: number) => void;
  clear: () => void;
  validate: () => Promise<boolean>;
  reset: () => void;
  getValues: () => T[];
};

// ---------------------------------------------------------------------------
// Form-DOM bridge
// ---------------------------------------------------------------------------

/**
 * Options for {@link bindField}.
 */
export type BindFieldOptions = {
  /** Override the field's `debounceMs` for this binding. */
  debounceMs?: number;
  /** Custom DOM-event → field-value extractor. */
  getValue?: (element: Element) => unknown;
};

/**
 * Options for {@link bindForm}.
 */
export type BindFormOptions = {
  /** Lookup function for the DOM element that should display a field's error. */
  errorSlot?: (name: string, formElement: HTMLElement) => HTMLElement | null;
  /** Override the input `name` → form field-key mapping. */
  fieldMap?: Record<string, string>;
};
