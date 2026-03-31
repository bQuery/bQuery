/**
 * Standalone reactive field composable.
 *
 * @module bquery/forms
 */

import { debounce } from '../core/utils/function';
import { isPromise } from '../core/utils/type-guards';
import { Computed } from '../reactive/computed';
import { Signal } from '../reactive/core';
import { computed, effect, signal } from '../reactive/index';
import type { MaybeSignal } from '../reactive/index';
import { isReadonlySignal } from '../reactive/readonly';
import type {
  UseFormFieldOptions,
  UseFormFieldReturn,
  ValidationResult,
  Validator,
} from './types';

/**
 * Determines whether a validator returned a valid result.
 * @internal
 */
const isValidationSuccess = (result: ValidationResult): boolean =>
  result === true || result === undefined;

/**
 * Runs a single validator, normalising sync and async results.
 * @internal
 */
const runValidator = async <T>(validator: Validator<T>, value: T): Promise<string | undefined> => {
  const result = validator(value);
  const resolved = isPromise(result) ? await result : result;
  return isValidationSuccess(resolved) ? undefined : (resolved as string);
};

/**
 * Creates a standalone reactive form field with optional automatic validation.
 *
 * This helper is useful when you want field-level state without creating a full form,
 * or when you want to bind an existing signal to the forms validation model.
 *
 * @template T - The type of the field value
 * @param initialValue - Plain initial value, an existing writable signal to reuse, or a
 * computed / readonly reactive source to snapshot
 * @param options - Validation mode, validators, debounce, and initial error configuration
 * @returns A reactive field handle with validation helpers
 *
 * @example
 * ```ts
 * import { useFormField, required } from '@bquery/bquery/forms';
 *
 * const email = useFormField('', {
 *   validators: [required()],
 *   validateOn: 'blur',
 * });
 *
 * email.value.value = 'ada@example.com';
 * email.touch();
 * ```
 */
export const useFormField = <T>(
  initialValue: MaybeSignal<T>,
  options: UseFormFieldOptions<T> = {}
): UseFormFieldReturn<T> => {
  let value: Signal<T>;

  if (isSignal(initialValue)) {
    value = initialValue as Signal<T>;
  } else {
    const startingValue: T =
      isReadonlySignal<T>(initialValue) || isComputedValue<T>(initialValue)
        ? initialValue.peek()
        : (initialValue as T);
    value = signal(startingValue);
  }

  const initial = value.peek();
  const error = signal(options.initialError ?? '');
  const isTouched = signal(false);
  const isValidating = signal(false);
  const isDirty = computed(() => !Object.is(value.value, initial));
  const isPristine = computed(() => !isDirty.value);
  const isValid = computed(() => error.value === '');
  const validateOn = options.validateOn ?? 'manual';
  const debounceMs = Math.max(0, options.debounceMs ?? 0);

  let validationId = 0;
  let changeInitialized = false;
  let suppressNextChangeValidation = false;
  let isDestroyed = false;
  let stopChangeValidationEffect: (() => void) | undefined;

  const logValidationError = (validationError: unknown): void => {
    console.error('bQuery forms: Error in scheduled field validation', validationError);
  };

  const runValidation = async (): Promise<boolean> => {
    const currentValidationId = ++validationId;
    const validators = options.validators;

    if (!validators || validators.length === 0) {
      error.value = '';
      isValidating.value = false;
      return true;
    }

    isValidating.value = true;

    try {
      const currentValue = value.peek();

      for (const validator of validators) {
        const nextError = await runValidator(validator, currentValue);

        if (currentValidationId !== validationId) {
          return error.peek() === '';
        }

        if (nextError) {
          error.value = nextError;
          return false;
        }
      }

      if (currentValidationId === validationId) {
        error.value = '';
      }
      return true;
    } finally {
      if (currentValidationId === validationId) {
        isValidating.value = false;
      }
    }
  };

  const debouncedValidate = debounce(() => {
    void runValidation().catch(logValidationError);
  }, debounceMs);

  const scheduleValidation = (): void => {
    if (isDestroyed) {
      return;
    }

    if (debounceMs > 0) {
      debouncedValidate();
      return;
    }

    void runValidation().catch(logValidationError);
  };

  if (validateOn === 'change' || validateOn === 'both') {
    stopChangeValidationEffect = effect(() => {
      void value.value;

      if (!changeInitialized) {
        changeInitialized = true;
        return;
      }

      if (suppressNextChangeValidation) {
        suppressNextChangeValidation = false;
        return;
      }

      scheduleValidation();
    });
  }

  const destroy = (): void => {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    validationId += 1;
    debouncedValidate.cancel();
    stopChangeValidationEffect?.();
    stopChangeValidationEffect = undefined;
    isDirty.dispose();
    isPristine.dispose();
    isValid.dispose();
    isValidating.value = false;
  };

  return {
    value,
    error,
    isDirty,
    isTouched,
    isPristine,
    isValid,
    isValidating,
    touch: () => {
      isTouched.value = true;
      if (validateOn === 'blur' || validateOn === 'both') {
        scheduleValidation();
      }
    },
    reset: () => {
      validationId += 1;
      debouncedValidate.cancel();
      if (!Object.is(value.peek(), initial)) {
        suppressNextChangeValidation = true;
      }
      value.value = initial;
      error.value = options.initialError ?? '';
      isTouched.value = false;
      isValidating.value = false;
    },
    validate: async () => {
      debouncedValidate.cancel();
      return runValidation();
    },
    destroy,
  };
};

/**
 * Determines whether a value looks like a writable signal.
 * @internal
 */
const isSignal = (value: unknown): value is Signal<unknown> => {
  return value instanceof Signal;
};

/**
 * Determines whether a value is a computed reactive source.
 * @internal
 */
const isComputedValue = <T>(value: unknown): value is Computed<T> => {
  return value instanceof Computed;
};
