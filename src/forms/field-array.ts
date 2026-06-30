/**
 * Reactive dynamic field arrays for repeating form groups.
 *
 * @module bquery/forms
 */

import { isPromise } from '../core/utils/type-guards';
import { computed, signal } from '../reactive/index';
import type {
  FieldArrayConfig,
  FieldArrayKeyFn,
  FormField,
  FormFieldArray,
  ValidationResult,
  Validator,
} from './types';

const resolveResult = (result: ValidationResult): string | undefined =>
  result === true || result === undefined ? undefined : (result as string);

/**
 * Enforce the stable-key contract for a keyed field array. Throws a descriptive
 * error naming the offending key on the first violation (missing or duplicate),
 * so "stable item ids" failures surface where they happen instead of as silent
 * DOM-reuse bugs downstream. No-op when `getKey` is not configured.
 *
 * @internal
 */
const assertStableKeys = <T>(
  items: readonly FormField<T>[],
  getKey: FieldArrayKeyFn<T> | undefined
): void => {
  if (!getKey) return;
  const seen = new Map<string | number, number>();
  for (let index = 0; index < items.length; index += 1) {
    const key = getKey(items[index].value.peek(), index);
    if (
      (typeof key !== 'string' && typeof key !== 'number') ||
      (typeof key === 'string' && key === '') ||
      (typeof key === 'number' && !Number.isFinite(key))
    ) {
      throw new Error(
        `bQuery forms: createFieldArray() getKey returned an invalid key (${String(
          key
        )}) for item at index ${index}. Keys must be a non-empty string or a finite number.`
      );
    }
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new Error(
        `bQuery forms: createFieldArray() requires stable, unique item keys, but getKey returned "${String(
          key
        )}" for both index ${previous} and index ${index}.`
      );
    }
    seen.set(key, index);
  }
};

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
  const { getKey } = config;
  const initialItems: readonly T[] = config.initial ?? [];
  const buildInitial = (): FormField<T>[] => {
    const built = initialItems.map((value) => config.factory(value));
    assertStableKeys(built, getKey);
    return built;
  };
  const items = signal<readonly FormField<T>[]>(buildInitial());
  const length = computed(() => items.value.length);
  const error = signal('');

  const add = function (value: T): FormField<T> {
    if (arguments.length === 0) {
      throw new TypeError('createFieldArray.add() requires a value.');
    }
    const next = config.factory(value as T);
    const updated = [...items.peek(), next];
    assertStableKeys(updated, getKey);
    items.value = updated;
    return next;
  };

  const insert = (index: number, value: T): FormField<T> => {
    const current = items.peek();
    const clamped = Math.max(0, Math.min(index, current.length));
    const next = config.factory(value);
    const updated = [...current.slice(0, clamped), next, ...current.slice(clamped)];
    assertStableKeys(updated, getKey);
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
    items.value = buildInitial();
    error.value = '';
  };

  const keyAt = (index: number): string | number | undefined => {
    if (!getKey) return undefined;
    const current = items.peek();
    if (index < 0 || index >= current.length) return undefined;
    return getKey(current[index].value.peek(), index);
  };

  const keys = (): (string | number)[] => {
    if (!getKey) return [];
    return items.peek().map((item, index) => getKey(item.value.peek(), index));
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

  const destroy = (): void => {
    for (const item of items.peek()) {
      destroyItem(item);
    }
    items.value = [];
    items.dispose();
    length.dispose();
    error.dispose();
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
    keyAt,
    keys,
    destroy,
  };
};
