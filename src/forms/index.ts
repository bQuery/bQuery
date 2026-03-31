/**
 * Form handling module for bQuery.js.
 *
 * Provides a reactive, TypeScript-first form API with field-level
 * and cross-field validation, dirty/touched tracking, and submission
 * handling — all backed by bQuery's signal-based reactivity system.
 *
 * @module bquery/forms
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
 * // Reactive access
 * console.log(form.isValid.value);          // boolean
 * console.log(form.fields.name.error.value); // '' or error message
 *
 * // Submit
 * await form.handleSubmit();
 * ```
 */

export { createForm } from './create-form';

export {
  custom,
  customAsync,
  email,
  matchField,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
  url,
} from './validators';

export type {
  AsyncValidator,
  CrossFieldValidator,
  FieldConfig,
  Form,
  FormConfig,
  FormErrors,
  FormField,
  FormFields,
  SubmitHandler,
  SyncValidator,
  ValidationResult,
  Validator,
} from './types';
