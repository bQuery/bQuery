/**
 * Reactive form creation and management.
 *
 * @module bquery/forms
 */

import { computed, signal } from '../reactive/index';
import { isPrototypePollutionKey } from '../core/utils/object';
import { isPromise } from '../core/utils/type-guards';
import type {
  CrossFieldValidator,
  FieldConfig,
  Form,
  FormConfig,
  FormErrors,
  FormField,
  FormFields,
  ValidationResult,
  Validator,
} from './types';

/**
 * Determines whether a validator returned a valid result.
 * @internal
 */
const isValid = (result: ValidationResult): boolean => result === true || result === undefined;

/**
 * Runs a single validator, normalising sync and async results.
 * @internal
 */
const runValidator = async <T>(validator: Validator<T>, value: T): Promise<string | undefined> => {
  const result = validator(value);
  const resolved = isPromise(result) ? await result : result;
  return isValid(resolved) ? undefined : (resolved as string);
};

/**
 * Creates a reactive form field from its configuration.
 * @internal
 */
const createField = <T>(config: FieldConfig<T>): FormField<T> => {
  const initial = config.initialValue;
  const value = signal<T>(initial);
  const error = signal('');
  const isTouched = signal(false);

  const isDirty = computed(() => !Object.is(value.value, initial));
  const isPristine = computed(() => !isDirty.value);

  return {
    value,
    error,
    isDirty,
    isTouched,
    isPristine,
    touch: () => {
      isTouched.value = true;
    },
    reset: () => {
      value.value = initial;
      error.value = '';
      isTouched.value = false;
    },
  };
};

/**
 * Validates a single field against its validators.
 * Sets the field's error signal.
 *
 * @returns The first error message, or an empty string if valid.
 * @internal
 */
const validateSingleField = async <T>(
  field: FormField<T>,
  validators: Validator<T>[] | undefined
): Promise<string> => {
  if (!validators || validators.length === 0) {
    field.error.value = '';
    return '';
  }

  for (const validator of validators) {
    const errorMsg = await runValidator(validator, field.value.value);
    if (errorMsg) {
      field.error.value = errorMsg;
      return errorMsg;
    }
  }

  field.error.value = '';
  return '';
};

/**
 * Creates a fully reactive form with field-level validation,
 * dirty/touched tracking, cross-field validation, and submission handling.
 *
 * Each field's `value`, `error`, `isDirty`, `isTouched`, and `isPristine`
 * are reactive signals/computed values that can be used in effects, computed
 * values, or directly read/written.
 *
 * @template T - Shape of the form values (e.g. `{ name: string; age: number }`)
 * @param config - Form configuration with field definitions, validators, and submit handler
 * @returns A reactive {@link Form} instance
 *
 * @example
 * ```ts
 * import { createForm, required, email, min } from '@bquery/bquery/forms';
 *
 * const form = createForm({
 *   fields: {
 *     name:  { initialValue: '', validators: [required()] },
 *     email: { initialValue: '', validators: [required(), email()] },
 *     age:   { initialValue: 0,  validators: [min(18, 'Must be 18+')] },
 *   },
 *   onSubmit: async (values) => {
 *     await fetch('/api/register', {
 *       method: 'POST',
 *       body: JSON.stringify(values),
 *     });
 *   },
 * });
 *
 * // Read reactive state
 * console.log(form.isValid.value);          // true (initially, before validation runs)
 * console.log(form.fields.name.value.value); // ''
 *
 * // Update a field
 * form.fields.name.value.value = 'Ada';
 *
 * // Validate and submit
 * await form.handleSubmit();
 * ```
 */
export const createForm = <T extends Record<string, unknown>>(config: FormConfig<T>): Form<T> => {
  // Build reactive field objects
  const fieldEntries = Object.entries(config.fields) as [
    keyof T & string,
    FieldConfig<T[keyof T]>,
  ][];

  const fields = {} as FormFields<T>;
  const errors = {} as FormErrors<T>;

  for (const [name, fieldConfig] of fieldEntries) {
    const field = createField(fieldConfig as FieldConfig<T[typeof name]>);
    (fields as Record<string, FormField>)[name] = field;
    (errors as Record<string, typeof field.error>)[name] = field.error;
  }

  const isSubmitting = signal(false);

  // Computed: form is valid when all error signals are empty
  const isFormValid = computed(() => {
    for (const name of Object.keys(fields)) {
      if ((fields as Record<string, FormField>)[name].error.value !== '') {
        return false;
      }
    }
    return true;
  });

  // Computed: form is dirty when any field is dirty
  const isFormDirty = computed(() => {
    for (const name of Object.keys(fields)) {
      if ((fields as Record<string, FormField>)[name].isDirty.value) {
        return true;
      }
    }
    return false;
  });

  /**
   * Validate a single field by name.
   */
  const validateField = async (name: keyof T & string): Promise<void> => {
    const field = (fields as Record<string, FormField>)[name];
    const fieldConfig = (config.fields as Record<string, FieldConfig>)[name];
    if (!field || !fieldConfig) return;
    await validateSingleField(field, fieldConfig.validators);
  };

  /**
   * Validate all fields (per-field + cross-field).
   * Returns `true` if the entire form is valid.
   */
  const validate = async (): Promise<boolean> => {
    let hasError = false;

    // Per-field validation
    for (const [name, fieldConfig] of fieldEntries) {
      const field = (fields as Record<string, FormField>)[name];
      const error = await validateSingleField(field, (fieldConfig as FieldConfig).validators);
      if (error) hasError = true;
    }

    // Cross-field validation
    if (config.crossValidators && config.crossValidators.length > 0) {
      const values = getValues();
      for (const crossValidator of config.crossValidators as CrossFieldValidator<T>[]) {
        const crossErrors = await crossValidator(values);
        if (crossErrors) {
          for (const [fieldName, errorMsg] of Object.entries(crossErrors) as [
            string,
            string | undefined,
          ][]) {
            if (errorMsg) {
              const field = (fields as Record<string, FormField>)[fieldName];
              if (field) {
                // Only set cross-field error if no per-field error exists
                if (field.error.value === '') {
                  field.error.value = errorMsg;
                }
                hasError = true;
              }
            }
          }
        }
      }
    }

    return !hasError;
  };

  /**
   * Validate all fields and, if valid, invoke the onSubmit handler.
   * Prevents concurrent submissions by setting isSubmitting before validation.
   */
  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;

    try {
      const valid = await validate();
      if (!valid) return;

      if (config.onSubmit) {
        await config.onSubmit(getValues());
      }
    } finally {
      isSubmitting.value = false;
    }
  };

  /**
   * Reset every field to its initial value and clear all errors.
   */
  const reset = (): void => {
    for (const name of Object.keys(fields)) {
      (fields as Record<string, FormField>)[name].reset();
    }
  };

  /**
   * Return a plain object snapshot of all current field values.
   */
  const getValues = (): T => {
    const values = {} as Record<string, unknown>;
    for (const name of Object.keys(fields)) {
      values[name] = (fields as Record<string, FormField>)[name].value.value;
    }
    return values as T;
  };

  /**
   * Bulk-set field values from a partial object.
   * Only fields present in the object are updated; missing keys are left unchanged.
   */
  const setValues = (values: Partial<T>): void => {
    for (const [name, val] of Object.entries(values)) {
      // Ignore inherited keys and prototype-pollution vectors before mutating field state.
      if (
        isPrototypePollutionKey(name) ||
        !Object.prototype.hasOwnProperty.call(fields, name)
      ) {
        continue;
      }

      const field = (fields as Record<string, FormField>)[name];
      if (!field) {
        continue;
      }
      field.value.value = val;
    }
  };

  /**
   * Bulk-set field error messages from a partial object.
   * Useful for applying server-side validation errors.
   * Only fields present in the object are updated; missing keys are left unchanged.
   */
  const setErrors = (errorMap: Partial<Record<keyof T & string, string>>): void => {
    for (const [name, msg] of Object.entries(errorMap)) {
      // Ignore inherited keys and prototype-pollution vectors before mutating field state.
      if (
        isPrototypePollutionKey(name) ||
        !Object.prototype.hasOwnProperty.call(fields, name)
      ) {
        continue;
      }

      const field = (fields as Record<string, FormField>)[name];
      if (!field) {
        continue;
      }
      field.error.value = (msg as string) ?? '';
    }
  };

  return {
    fields,
    errors,
    isValid: isFormValid,
    isDirty: isFormDirty,
    isSubmitting,
    handleSubmit,
    validateField,
    validate,
    reset,
    getValues,
    setValues,
    setErrors,
  };
};
