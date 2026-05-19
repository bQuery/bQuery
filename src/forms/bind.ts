/**
 * Bridge between reactive {@link Form} / {@link FormField} objects and the DOM.
 *
 * Provides `bindField()` to two-way-bind a single field to an input element,
 * and `bindForm()` to wire an entire `<form>` element to a {@link Form}.
 *
 * @module bquery/forms
 */

import { effect } from '../reactive/index';
import type { BindFieldOptions, BindFormOptions, Form, FormField } from './types';

const isInput = (el: Element): el is HTMLInputElement =>
  el.tagName === 'INPUT';
const isTextarea = (el: Element): el is HTMLTextAreaElement =>
  el.tagName === 'TEXTAREA';
const isSelect = (el: Element): el is HTMLSelectElement =>
  el.tagName === 'SELECT';
const isButton = (el: Element): el is HTMLButtonElement =>
  el.tagName === 'BUTTON';

const defaultGetValue = (element: Element): unknown => {
  if (isInput(element)) {
    if (element.type === 'checkbox') return element.checked;
    if (element.type === 'radio') return element.checked ? element.value : undefined;
    if (element.type === 'number' || element.type === 'range') {
      return element.value === '' ? '' : Number(element.value);
    }
    if (element.type === 'file') return element.files;
    if (element.type === 'date' || element.type === 'datetime-local' || element.type === 'time') {
      return element.value;
    }
    return element.value;
  }
  if (isTextarea(element)) {
    return element.value;
  }
  if (isSelect(element)) {
    if (element.multiple) {
      return Array.from(element.selectedOptions).map((o) => o.value);
    }
    return element.value;
  }
  if ((element as HTMLElement).isContentEditable) {
    return (element as HTMLElement).textContent ?? '';
  }
  const anyEl = element as unknown as { value?: unknown };
  return anyEl.value;
};

const writeValue = (element: Element, value: unknown): void => {
  if (isInput(element)) {
    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
      return;
    }
    if (element.type === 'radio') {
      element.checked = element.value === String(value);
      return;
    }
    if (element.type === 'file') return;
    element.value = value == null ? '' : String(value);
    return;
  }
  if (isTextarea(element)) {
    element.value = value == null ? '' : String(value);
    return;
  }
  if (isSelect(element)) {
    if (element.multiple && Array.isArray(value)) {
      const set = new Set(value.map((v) => String(v)));
      for (const option of Array.from(element.options)) {
        option.selected = set.has(option.value);
      }
      return;
    }
    element.value = value == null ? '' : String(value);
    return;
  }
  if ((element as HTMLElement).isContentEditable) {
    (element as HTMLElement).textContent = value == null ? '' : String(value);
    return;
  }
  try {
    (element as unknown as { value: unknown }).value = value;
  } catch {
    element.setAttribute('value', value == null ? '' : String(value));
  }
};

/**
 * Two-way bind a reactive {@link FormField} to a DOM input element.
 *
 * Supports `<input>` (text, number, checkbox, radio, file, date), `<textarea>`,
 * `<select>` (including `multiple`), `[contenteditable]` elements, and custom
 * Web Components that expose a `.value` property (e.g. `<bq-input>`).
 *
 * Returns a cleanup function that detaches the listeners and the reactive
 * effect that mirrors the field's value into the element.
 *
 * @param field - Reactive field
 * @param element - Target DOM element
 * @param options - Optional binding overrides
 * @returns A cleanup function
 */
export const bindField = <T>(
  field: FormField<T>,
  element: Element,
  options: BindFieldOptions = {}
): (() => void) => {
  const getValue = options.getValue ?? defaultGetValue;
  let suppressEcho = false;
  const debounceMs = Math.max(0, options.debounceMs ?? 0);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const onInput = (): void => {
    const raw = getValue(element);
    if (raw === undefined && isInput(element) && element.type === 'radio') {
      // unchecked radio — ignore so other group members can set the value
      return;
    }
    suppressEcho = true;
    if (debounceMs > 0) {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        field.value.value = raw as T;
      }, debounceMs);
    } else {
      field.value.value = raw as T;
    }
  };

  const onChange = (): void => {
    onInput();
  };

  const onFocus = (): void => {
    field.focus();
  };

  const onBlur = (): void => {
    field.blur();
  };

  element.addEventListener('input', onInput);
  element.addEventListener('change', onChange);
  element.addEventListener('focus', onFocus, true);
  element.addEventListener('blur', onBlur, true);

  const stopEffect = effect(() => {
    const next = field.value.value;
    if (suppressEcho) {
      suppressEcho = false;
      return;
    }
    writeValue(element, next);
  });

  const stopErrorEffect = effect(() => {
    const err = field.error.value;
    if (err) element.setAttribute('aria-invalid', 'true');
    else element.removeAttribute('aria-invalid');
  });

  const stopDisabledEffect = effect(() => {
    const disabled = field.disabled.value;
    if (isInput(element) || isTextarea(element) || isSelect(element) || isButton(element)) {
      (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement).disabled = disabled;
    } else {
      if (disabled) element.setAttribute('aria-disabled', 'true');
      else element.removeAttribute('aria-disabled');
    }
  });

  return () => {
    element.removeEventListener('input', onInput);
    element.removeEventListener('change', onChange);
    element.removeEventListener('focus', onFocus, true);
    element.removeEventListener('blur', onBlur, true);
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    stopEffect();
    stopErrorEffect();
    stopDisabledEffect();
  };
};

const findInputsByName = (root: HTMLElement): Map<string, Element[]> => {
  const map = new Map<string, Element[]>();
  const elements = root.querySelectorAll<HTMLElement>('[name]');
  for (const el of Array.from(elements)) {
    const name = el.getAttribute('name');
    if (!name) continue;
    const list = map.get(name);
    if (list) list.push(el);
    else map.set(name, [el]);
  }
  return map;
};

/**
 * Wire a {@link Form} to a `<form>` (or any container) element.
 *
 * The binding:
 * - Auto-discovers `[name]` inputs inside the container and calls
 *   {@link bindField} for each matching form field.
 * - Hooks the container's `submit` event to call `form.handleSubmit()`
 *   (preventing the default browser submit).
 * - Mirrors per-field error messages into `[data-bq-error-for="<name>"]`
 *   elements when present, or a custom `errorSlot` lookup function.
 *
 * Returns a cleanup function that detaches every listener and reactive effect.
 *
 * @example
 * ```html
 * <form id="register">
 *   <input name="email" type="email" />
 *   <span data-bq-error-for="email"></span>
 *   <button type="submit">Save</button>
 * </form>
 * ```
 * ```ts
 * const cleanup = bindForm(form, document.getElementById('register')!);
 * ```
 */
export const bindForm = <T extends Record<string, unknown>>(
  form: Form<T>,
  formElement: HTMLElement,
  options: BindFormOptions = {}
): (() => void) => {
  const cleanups: Array<() => void> = [];
  const inputs = findInputsByName(formElement);
  const fieldMap = options.fieldMap ?? {};

  for (const [name, elements] of inputs.entries()) {
    const fieldKey = fieldMap[name] ?? name;
    const field = (form.fields as Record<string, FormField | undefined>)[fieldKey];
    if (!field) continue;

    // Group radio inputs and selects act as a single field via per-element bind.
    for (const element of elements) {
      cleanups.push(bindField(field, element));
    }

    // Error slot wiring
    const cssEscape = (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS?.escape;
    const escapeAttr = (value: string): string =>
      cssEscape ? cssEscape(value) : value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const slotLookup =
      options.errorSlot ??
      ((name: string, root: HTMLElement): HTMLElement | null =>
        root.querySelector<HTMLElement>(`[data-bq-error-for="${escapeAttr(name)}"]`));
    const slot = slotLookup(fieldKey, formElement);
    if (slot) {
      const stop = effect(() => {
        const err = field.error.value;
        slot.textContent = err;
      });
      cleanups.push(stop);
    }
  }

  const onSubmit = (event: Event): void => {
    event.preventDefault();
    void form.handleSubmit();
  };

  formElement.addEventListener('submit', onSubmit);
  cleanups.push(() => formElement.removeEventListener('submit', onSubmit));

  return () => {
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
  };
};
