/**
 * Reactive form creation and management.
 *
 * @module bquery/forms
 */

import { isPrototypePollutionKey } from '../core/utils/object';
import { isPromise } from '../core/utils/type-guards';
import { computed, effect, signal } from '../reactive/index';
import type { Signal } from '../reactive/index';
import type {
  CrossFieldValidator,
  FieldConfig,
  Form,
  FormChangeListener,
  FormConfig,
  FormErrors,
  FormField,
  FormFields,
  FormSnapshot,
  SetFieldValueOptions,
  ValidationResult,
  Validator,
} from './types';

const isValid = (result: ValidationResult): boolean => result === true || result === undefined;

/** @internal */
const runValidator = async <T>(validator: Validator<T>, value: T): Promise<string | undefined> => {
  const result = validator(value);
  const resolved = isPromise(result) ? await result : result;
  return isValid(resolved) ? undefined : (resolved as string);
};

/** @internal */
type FieldRuntime = {
  field: FormField<unknown>;
  config: FieldConfig<unknown>;
  parse: (raw: unknown) => unknown;
  format: (value: unknown) => unknown;
  blurCount: Signal<number>;
  consumeSilentNotifyWrite: () => boolean;
  consumeSilentValidationWrite: () => boolean;
};

const fieldValidationIds = new WeakMap<FormField<unknown>, number>();

/** @internal */
const createField = <T>(
  config: FieldConfig<T>
): {
  field: FormField<T>;
  initial: T;
  stopDirtyEffect: () => void;
  blurCount: Signal<number>;
  consumeSilentNotifyWrite: () => boolean;
  consumeSilentValidationWrite: () => boolean;
} => {
  const initial = config.initialValue;
  const value = signal<T>(initial);
  const error = signal('');
  const isTouched = signal(false);
  const isValidating = signal(false);
  const isFocused = signal(false);
  const disabled = signal<boolean>(config.disabled === true);
  const dirtySince = signal<number | null>(null);
  const blurCount = signal(0);
  let pendingSilentNotifyWrites = 0;
  let pendingSilentValidationWrites = 0;

  // Track dirtySince reactively so that any write — via setValue, direct
  // .value mutation, or setValues() — keeps the timestamp in sync.
  const stopDirtyEffect = effect(() => {
    const v = value.value;
    if (!Object.is(v, initial)) {
      if (dirtySince.peek() === null) dirtySince.value = Date.now();
    } else if (dirtySince.peek() !== null) {
      dirtySince.value = null;
    }
  });

  const isDirty = computed(() => !Object.is(value.value, initial));
  const isPristine = computed(() => !isDirty.value);

  const setValue = (next: T, options: SetFieldValueOptions = {}): void => {
    if (options.silent) {
      pendingSilentNotifyWrites += 1;
      pendingSilentValidationWrites += 1;
    }
    value.value = next;
    if (options.touch) {
      isTouched.value = true;
    }
  };

  const field: FormField<T> = {
    value,
    error,
    isDirty,
    isTouched,
    isPristine,
    isValidating,
    isFocused,
    disabled,
    dirtySince,
    touch: () => {
      isTouched.value = true;
    },
    reset: () => {
      value.value = initial;
      error.value = '';
      isTouched.value = false;
      isValidating.value = false;
      isFocused.value = false;
      dirtySince.value = null;
      disabled.value = config.disabled === true;
    },
    setValue,
    setError: (message: string) => {
      error.value = message;
    },
    clearError: () => {
      error.value = '';
    },
    focus: () => {
      isFocused.value = true;
    },
    blur: () => {
      isFocused.value = false;
      isTouched.value = true;
      blurCount.value = blurCount.peek() + 1;
    },
  };

  return {
    field,
    initial,
    stopDirtyEffect,
    blurCount,
    consumeSilentNotifyWrite: () => {
      if (pendingSilentNotifyWrites <= 0) return false;
      pendingSilentNotifyWrites -= 1;
      return true;
    },
    consumeSilentValidationWrite: () => {
      if (pendingSilentValidationWrites <= 0) return false;
      pendingSilentValidationWrites -= 1;
      return true;
    },
  };
};

/** @internal */
const validateSingleField = async <T>(
  field: FormField<T>,
  validators: Validator<T>[] | undefined,
  mode: 'first' | 'all'
): Promise<string> => {
  const currentValidationId = (fieldValidationIds.get(field as FormField<unknown>) ?? 0) + 1;
  fieldValidationIds.set(field as FormField<unknown>, currentValidationId);

  if (field.disabled.peek()) {
    if (fieldValidationIds.get(field as FormField<unknown>) === currentValidationId) {
      field.error.value = '';
    }
    return '';
  }
  if (!validators || validators.length === 0) {
    if (fieldValidationIds.get(field as FormField<unknown>) === currentValidationId) {
      field.error.value = '';
    }
    return '';
  }

  field.isValidating.value = true;
  try {
    const currentValue = field.value.peek();
    if (mode === 'first') {
      for (const validator of validators) {
        const msg = await runValidator(validator, currentValue);
        if (fieldValidationIds.get(field as FormField<unknown>) !== currentValidationId) {
          return field.error.peek();
        }
        if (msg) {
          field.error.value = msg;
          return msg;
        }
      }
      field.error.value = '';
      return '';
    }
    const messages: string[] = [];
    for (const validator of validators) {
      const msg = await runValidator(validator, currentValue);
      if (fieldValidationIds.get(field as FormField<unknown>) !== currentValidationId) {
        return field.error.peek();
      }
      if (msg) messages.push(msg);
    }
    if (messages.length === 0) {
      field.error.value = '';
      return '';
    }
    const joined = messages.join('; ');
    field.error.value = joined;
    return joined;
  } finally {
    if (fieldValidationIds.get(field as FormField<unknown>) === currentValidationId) {
      field.isValidating.value = false;
    }
  }
};

/**
 * Creates a fully reactive form with field-level validation,
 * dirty/touched tracking, cross-field validation, and submission handling.
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
 *     await fetch('/api/register', { method: 'POST', body: JSON.stringify(values) });
 *   },
 * });
 * ```
 */
export const createForm = <T extends Record<string, unknown>>(config: FormConfig<T>): Form<T> => {
  const fieldEntries = Object.entries(config.fields) as [
    keyof T & string,
    FieldConfig<T[keyof T]>,
  ][];

  const fields = {} as FormFields<T>;
  const errors = {} as FormErrors<T>;
  const runtime: Record<string, FieldRuntime> = {};
  const fieldOrder: string[] = [];

  const stopDirtyEffects: Array<() => void> = [];
  for (const [name, fieldConfig] of fieldEntries) {
    const { field, stopDirtyEffect, blurCount, consumeSilentNotifyWrite, consumeSilentValidationWrite } =
      createField(
      fieldConfig as FieldConfig<T[typeof name]>
    );
    const originalSetValue = field.setValue.bind(field);
    field.setValue = (next: T[typeof name], options: SetFieldValueOptions = {}) => {
      originalSetValue(next, options);
      if (options.validate) {
        void validateField(name as keyof T & string);
      }
    };
    (fields as Record<string, FormField>)[name] = field as FormField;
    (errors as Record<string, typeof field.error>)[name] = field.error;
    runtime[name] = {
      field: field as FormField<unknown>,
      config: fieldConfig as FieldConfig<unknown>,
      parse: (fieldConfig as FieldConfig<unknown>).parse ?? ((raw: unknown) => raw),
      format: (fieldConfig as FieldConfig<unknown>).format ?? ((value: unknown) => value),
      blurCount,
      consumeSilentNotifyWrite,
      consumeSilentValidationWrite,
    };
    fieldOrder.push(name);
    stopDirtyEffects.push(stopDirtyEffect);
  }

  const isSubmitting = signal(false);
  const submitCount = signal(0);
  const lastSubmittedAt = signal<number | null>(null);
  const submitError = signal<unknown>(null);

  const mode = config.mode ?? 'first';
  const formStrategy = config.validationStrategy ?? 'manual';

  const isFormValid = computed(() => {
    for (const name of fieldOrder) {
      const f = (fields as Record<string, FormField>)[name];
      if (f.disabled.value) continue;
      if (f.error.value !== '') return false;
    }
    return true;
  });

  const isFormDirty = computed(() => {
    for (const name of fieldOrder) {
      if ((fields as Record<string, FormField>)[name].isDirty.value) return true;
    }
    return false;
  });

  const isFormPristine = computed(() => !isFormDirty.value);

  const isFormValidating = computed(() => {
    for (const name of fieldOrder) {
      if ((fields as Record<string, FormField>)[name].isValidating.value) return true;
    }
    return false;
  });

  // --- functions referenced by effects must be defined first ----------------

  const getValues = (): T => {
    const values = {} as Record<string, unknown>;
    for (const name of fieldOrder) {
      const entry = runtime[name];
      values[name] = entry.format((fields as Record<string, FormField>)[name].value.value);
    }
    return values as T;
  };

  const getValuesUntracked = (): T => {
    const values = {} as Record<string, unknown>;
    for (const name of fieldOrder) {
      const entry = runtime[name];
      values[name] = entry.format((fields as Record<string, FormField>)[name].value.peek());
    }
    return values as T;
  };

  const validateField = async (name: keyof T & string): Promise<void> => {
    const entry = runtime[name as string];
    if (!entry) return;
    await validateSingleField(entry.field, entry.config.validators, mode);
  };

  // --- subscribe() ----------------------------------------------------------

  const listeners = new Set<FormChangeListener<T>>();
  let initialNotifyRun = true;

  const stopValuesEffect = effect(() => {
    for (const name of fieldOrder) {
      void (fields as Record<string, FormField>)[name].value.value;
    }
    if (initialNotifyRun) {
      initialNotifyRun = false;
      return;
    }
    const hasSilentWrite = fieldOrder.some((name) => runtime[name].consumeSilentNotifyWrite());
    if (hasSilentWrite || listeners.size === 0) return;
    const snap = getValuesUntracked();
    for (const listener of listeners) {
      try {
        listener(snap);
      } catch (listenerError) {
        console.error('bQuery forms: form change listener threw', listenerError);
      }
    }
  });

  const subscribe = (listener: FormChangeListener<T>): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  // --- per-field automatic validation ---------------------------------------

  const stopFieldEffects: Array<() => void> = [];
  for (const name of fieldOrder) {
    const entry = runtime[name];
    const fieldStrategy: 'manual' | 'change' | 'blur' | 'both' =
      entry.config.validateOn ??
      (formStrategy === 'onChange'
        ? 'change'
        : formStrategy === 'onBlur'
          ? 'blur'
          : 'manual');
    const debounceMs = Math.max(0, entry.config.debounceMs ?? 0);

    if (fieldStrategy === 'manual') continue;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let firstChangeRun = true;
    let firstBlurRun = true;
    const schedule = (): void => {
      if (debounceMs <= 0) {
        void validateField(name as keyof T & string);
        return;
      }
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void validateField(name as keyof T & string);
      }, debounceMs);
    };

    if (fieldStrategy === 'change' || fieldStrategy === 'both') {
      const stop = effect(() => {
        void entry.field.value.value;
        if (firstChangeRun) {
          firstChangeRun = false;
          return;
        }
        if (entry.consumeSilentValidationWrite()) {
          return;
        }
        schedule();
      });
      stopFieldEffects.push(stop);
    }
    if (fieldStrategy === 'blur' || fieldStrategy === 'both') {
      const stop = effect(() => {
        void entry.blurCount.value;
        if (firstBlurRun) {
          firstBlurRun = false;
          return;
        }
        schedule();
      });
      stopFieldEffects.push(stop);
    }
    stopFieldEffects.push(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
  }

  // --- public API -----------------------------------------------------------

  const validate = async (): Promise<boolean> => {
    let hasError = false;

    for (const name of fieldOrder) {
      const entry = runtime[name];
      const msg = await validateSingleField(entry.field, entry.config.validators, mode);
      if (msg) hasError = true;
    }

    if (config.crossValidators && config.crossValidators.length > 0) {
      const values = getValuesUntracked();
      for (const crossValidator of config.crossValidators as CrossFieldValidator<T>[]) {
        const crossErrors = await crossValidator(values);
        if (crossErrors) {
          for (const [fieldName, msg] of Object.entries(crossErrors) as [
            string,
            string | undefined,
          ][]) {
            if (msg) {
              const f = (fields as Record<string, FormField>)[fieldName];
              if (f && !f.disabled.peek()) {
                if (f.error.peek() === '') f.error.value = msg;
                hasError = true;
              }
            }
          }
        }
      }
    }

    return !hasError;
  };

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting.peek()) return;
    isSubmitting.value = true;
    submitCount.value = submitCount.peek() + 1;
    submitError.value = null;

    try {
      const ok = await validate();
      if (!ok) return;

      if (config.onSubmit) {
        const values = getValuesUntracked();
        try {
          await config.onSubmit(values);
          lastSubmittedAt.value = Date.now();
          if (config.onSubmitSuccess) {
            await config.onSubmitSuccess(values);
          }
        } catch (submitErr) {
          submitError.value = submitErr;
          if (config.onSubmitError) {
            try {
              await config.onSubmitError(submitErr, values);
            } catch (handlerErr) {
              console.error('bQuery forms: onSubmitError handler threw', handlerErr);
            }
          } else {
            throw submitErr;
          }
        }
      } else {
        lastSubmittedAt.value = Date.now();
      }
    } finally {
      isSubmitting.value = false;
    }
  };

  const reset = (): void => {
    for (const name of fieldOrder) {
      (fields as Record<string, FormField>)[name].reset();
    }
  };

  const resetField = (name: keyof T & string): void => {
    const entry = runtime[name as string];
    if (!entry) return;
    entry.field.reset();
  };

  const resetErrors = (): void => {
    for (const name of fieldOrder) {
      (fields as Record<string, FormField>)[name].error.value = '';
    }
  };

  const touchAll = (): void => {
    for (const name of fieldOrder) {
      (fields as Record<string, FormField>)[name].isTouched.value = true;
    }
  };

  const untouchAll = (): void => {
    for (const name of fieldOrder) {
      (fields as Record<string, FormField>)[name].isTouched.value = false;
    }
  };

  const getDirtyValues = (): Partial<T> => {
    const values: Record<string, unknown> = {};
    for (const name of fieldOrder) {
      const f = (fields as Record<string, FormField>)[name];
      if (f.isDirty.value) values[name] = f.value.value;
    }
    return values as Partial<T>;
  };

  const setValues = (values: Partial<T>): void => {
    for (const [name, val] of Object.entries(values)) {
      if (isPrototypePollutionKey(name) || !Object.prototype.hasOwnProperty.call(fields, name)) {
        continue;
      }
      const entry = runtime[name];
      if (!entry) continue;
      const next = entry.parse(val);
      entry.field.value.value = next;
    }
  };

  const setErrors = (errorMap: Partial<Record<keyof T & string, string>>): void => {
    for (const [name, msg] of Object.entries(errorMap)) {
      if (isPrototypePollutionKey(name) || !Object.prototype.hasOwnProperty.call(fields, name)) {
        continue;
      }
      const f = (fields as Record<string, FormField>)[name];
      if (!f) continue;
      f.error.value = (msg as string) ?? '';
    }
  };

  const snapshot = (): FormSnapshot<T> => {
    const values = getValuesUntracked();
    const errs: Record<string, string> = {};
    const touched: Record<string, boolean> = {};
    for (const name of fieldOrder) {
      const f = (fields as Record<string, FormField>)[name];
      const e = f.error.peek();
      const t = f.isTouched.peek();
      if (e !== '') errs[name] = e;
      if (t) touched[name] = true;
    }
    return {
      values,
      errors: errs as Partial<Record<keyof T & string, string>>,
      touched: touched as Partial<Record<keyof T & string, boolean>>,
    };
  };

  const restore = (snap: FormSnapshot<T>): void => {
    setValues(snap.values);
    resetErrors();
    setErrors(snap.errors ?? {});
    for (const name of fieldOrder) {
      const f = (fields as Record<string, FormField>)[name];
      f.isTouched.value = Boolean(snap.touched?.[name as keyof T & string]);
    }
  };

  const toFormData = (): FormData => {
    if (typeof FormData === 'undefined') {
      throw new Error('bQuery forms: FormData is not available in this runtime');
    }
    const fd = new FormData();
    for (const name of fieldOrder) {
      const f = (fields as Record<string, FormField>)[name];
      const raw = f.value.peek();
      if (raw == null) continue;
      if (typeof Blob !== 'undefined' && raw instanceof Blob) {
        fd.append(name, raw);
        continue;
      }
      if (typeof FileList !== 'undefined' && raw instanceof FileList) {
        for (let i = 0; i < raw.length; i += 1) {
          const item = raw.item(i);
          if (item) fd.append(name, item);
        }
        continue;
      }
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof Blob !== 'undefined' && item instanceof Blob) fd.append(name, item);
          else fd.append(name, String(item));
        }
        continue;
      }
      if (typeof raw === 'boolean') {
        if (raw) fd.append(name, 'on');
        continue;
      }
      fd.append(name, String(raw));
    }
    return fd;
  };

  const toJSON = (): T => getValuesUntracked();

  const destroy = (): void => {
    for (const stop of stopFieldEffects) stop();
    stopFieldEffects.length = 0;
    for (const stop of stopDirtyEffects) stop();
    stopDirtyEffects.length = 0;
    stopValuesEffect();
    listeners.clear();
  };

  return {
    fields,
    errors,
    isValid: isFormValid,
    isDirty: isFormDirty,
    isPristine: isFormPristine,
    isValidating: isFormValidating,
    isSubmitting,
    submitCount,
    lastSubmittedAt,
    submitError,
    handleSubmit,
    validateField,
    validate,
    reset,
    resetField,
    resetErrors,
    touchAll,
    untouchAll,
    getValues,
    getDirtyValues,
    setValues,
    setErrors,
    subscribe,
    snapshot,
    restore,
    toFormData,
    toJSON,
    destroy,
  };
};
