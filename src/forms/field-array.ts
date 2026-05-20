/**
 * Reactive dynamic field arrays for repeating form groups.
 *
 * @module bquery/forms
 */

import { isPromise } from '../core/utils/type-guards';
import { computed, signal } from '../reactive/index';
import type { FieldArrayConfig, FormField, FormFieldArray, ValidationResult, Validator } from './types';

const resolveResult = (result: ValidationResult): string | undefined =>
  result === true || result === undefined ? undefined : (result as string);

const destroyItem = <T>(item: FormField<T>): void => {
  const destroyable = item as FormField<T> & {
    destroy?: () => void;
    dispose?: () => void;
  };
  if (typeof destroyable.destroy === 'function') {
    destroyable.destroy();
    return;
  }
  if (typeof destroyable.dispose === 'function') {
    destroyable.dispose();
  }
};

/**
 * Create a reactive array of fields with mutation helpers.
 *
 * Useful for "list of items" UIs such as invoice line items or contact lists.
 * Each item is wrapped in a {@link FormField} via the supplied `factory`.
 *
 * @example
 * ```ts
 * import { createFieldArray, useFormField, required } from '@bquery/bquery/forms';
 *
 * const tags = createFieldArray<string>({
 *   initial: ['react', 'forms'],
 *   factory: (value) => useFormField(value, { validators: [required()] }),
 * });
 *
 * tags.add('reactive');
 * tags.remove(0);
 * tags.move(0, 1);
 * console.log(tags.getValues());
 * ```
 */
export const createFieldArray = <T>(config: FieldArrayConfig<T>): FormFieldArray<T> => {
  const initialItems: readonly T[] = config.initial ?? [];
  const items = signal<readonly FormField<T>[]>(
    initialItems.map((value) => config.factory(value))
  );
  const length = computed(() => items.value.length);
  const error = signal('');

  const add = function (value?: T): FormField<T> {
    if (arguments.length === 0) {
      throw new TypeError('createFieldArray.add() requires a value.');
    }
    const next = config.factory(value as T);
    items.value = [...items.peek(), next];
    return next;
  };

  const insert = (index: number, value: T): FormField<T> => {
    const current = items.peek();
    const clamped = Math.max(0, Math.min(index, current.length));
    const next = config.factory(value);
    const updated = [...current.slice(0, clamped), next, ...current.slice(clamped)];
    items.value = updated;
    return next;
  };

  const remove = (index: number): boolean => {
    const current = items.peek();
    if (index < 0 || index >= current.length) return false;
    destroyItem(current[index]);
    const updated = [...current.slice(0, index), ...current.slice(index + 1)];
    items.value = updated;
    return true;
  };

  const move = (from: number, to: number): void => {
    const current = items.peek();
    if (from < 0 || from >= current.length) return;
    if (to < 0 || to >= current.length) return;
    if (from === to) return;
    const next = current.slice();
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    items.value = next;
  };

  const clear = (): void => {
    for (const item of items.peek()) {
      destroyItem(item);
    }
    items.value = [];
  };

  const getValues = (): T[] => items.value.map((f) => f.value.value);

  const reset = (): void => {
    for (const item of items.peek()) {
      destroyItem(item);
    }
    items.value = initialItems.map((value) => config.factory(value));
    error.value = '';
  };

  const validate = async (): Promise<boolean> => {
    let ok = true;

    // First validate each item's own validators by triggering their fields' setError if a
    // public `validate()` is exposed. The default `FormField` from createForm doesn't expose
    // it, so item validation is the responsibility of the factory (e.g. useFormField).
    for (const item of items.peek()) {
      const itemAny = item as FormField<T> & { validate?: () => Promise<boolean> };
      if (typeof itemAny.validate === 'function') {
        const itemOk = await itemAny.validate();
        if (!itemOk) ok = false;
      }
    }

    const validators: Validator<readonly T[]>[] | undefined = config.validators;
    if (validators && validators.length > 0) {
      const values: readonly T[] = items.peek().map((f) => f.value.peek());
      for (const validator of validators) {
        const result = validator(values);
        const resolved = isPromise(result) ? await result : result;
        const msg = resolveResult(resolved);
        if (msg) {
          error.value = msg;
          return false;
        }
      }
      error.value = '';
    } else {
      error.value = '';
    }

    return ok;
  };

  return {
    items,
    length,
    error,
    add,
    insert,
    remove,
    move,
    clear,
    validate,
    reset,
    getValues,
  };
};
