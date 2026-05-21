/**
 * Component-scoped form composables.
 *
 * These wrappers mirror the ergonomics of {@link useSignal} / {@link useComputed} /
 * {@link useEffect} from the component module: any `Form` or `FormField` they
 * create is automatically disposed when the owning component disconnects.
 * `useFieldArray()` still requires a component scope so item factories such as
 * `useField()` can participate in that lifecycle.
 *
 * @module bquery/forms
 */

import { getCurrentScope, isCurrentScopeRendering } from '../component/scope';
import type { MaybeSignal } from '../reactive/index';
import { createFieldArray } from './field-array';
import { createForm } from './create-form';
import { useFormField } from './use-field';
import type {
  FieldArrayConfig,
  Form,
  FormConfig,
  FormFieldArray,
  UseFormFieldOptions,
  UseFormFieldReturn,
} from './types';

const requireScope = (api: string) => {
  const scope = getCurrentScope();
  if (!scope || isCurrentScopeRendering()) {
    throw new Error(
      `bQuery forms: ${api}() must be called inside a component lifecycle hook. Avoid calling it directly from render()`
    );
  }
  return scope;
};

/**
 * Scope-aware wrapper around {@link createForm}.
 *
 * Creates a reactive {@link Form} bound to the current component scope.
 * The form's reactive subscriptions and timers are disposed automatically
 * when the component disconnects.
 *
 * @example
 * ```ts
 * component('login-form', {
 *   connected() {
 *     const form = useForm({
 *       fields: {
 *         email:    { initialValue: '', validators: [required(), email()] },
 *         password: { initialValue: '', validators: [required(), minLength(8)] },
 *       },
 *       onSubmit: async (values) => loginAPI(values),
 *     });
 *     this._form = form;
 *   },
 *   render() { ... },
 * });
 * ```
 */
export const useForm = <T extends Record<string, unknown>>(config: FormConfig<T>): Form<T> => {
  const scope = requireScope('useForm');
  const form = createForm(config);
  scope.addDisposer(() => form.destroy());
  return form;
};

/**
 * Scope-aware wrapper around {@link useFormField}.
 *
 * Creates a standalone reactive form field bound to the current component scope.
 * The field's reactive subscriptions and pending debounce timers are disposed
 * automatically when the component disconnects.
 */
export const useField = <T>(
  initial: MaybeSignal<T>,
  options: UseFormFieldOptions<T> = {}
): UseFormFieldReturn<T> => {
  const scope = requireScope('useField');
  const field = useFormField(initial, options);
  scope.addDisposer(() => field.destroy());
  return field;
};

/**
 * Scope-aware wrapper around {@link createFieldArray}.
 *
 * Creates a dynamic field array for the current component scope. Item fields
 * are created via the supplied `factory`; if those factories are themselves
 * scope-aware (e.g. `useField`), the items participate in the owning
 * component's disposal lifecycle and clean themselves up when the component
 * disconnects.
 *
 * In addition, a single scope disposer is registered that calls
 * `arr.destroy()` on disconnect. This clears any remaining items and disposes
 * the internal reactive primitives (`items`, `length`, `error`) so subscribers
 * to those signals are released and resources are not retained for the
 * lifetime of the component.
 */
export const useFieldArray = <T>(config: FieldArrayConfig<T>): FormFieldArray<T> => {
  const scope = requireScope('useFieldArray');
  const arr = createFieldArray(config);
  scope.addDisposer(() => arr.destroy());
  return arr;
};
