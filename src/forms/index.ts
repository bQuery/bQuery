/**
 * Form handling module for bQuery.js.
 *
 * Provides a reactive, TypeScript-first form API with field-level and
 * cross-field validation, dirty/touched/focus tracking, dynamic field
 * arrays, schema-style declaration, DOM bindings, and SSR hydration —
 * all backed by bQuery's signal-based reactivity system.
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
 *     await fetch('/api/register', { method: 'POST', body: JSON.stringify(values) });
 *   },
 * });
 *
 * console.log(form.isValid.value);
 * await form.handleSubmit();
 * ```
 */

export { createForm } from './create-form';
export { useFormField } from './use-field';
export { createFieldArray } from './field-array';
export { field, schema } from './schema';
export { bindField, bindForm } from './bind';
export { hydrateForm, readSerializedFormState, serializeFormState } from './ssr';
export { useField, useFieldArray, useForm } from './composables';

export {
  all,
  arrayOf,
  between,
  compose,
  custom,
  customAsync,
  dateAfter,
  dateBefore,
  email,
  fileSize,
  fileType,
  integer,
  validDate,
  length,
  matchField,
  max,
  maxLength,
  min,
  minLength,
  not,
  notOneOf,
  numeric,
  oneOf,
  pattern,
  required,
  requiredIf,
  requiredUnless,
  url,
  withMessage,
} from './validators';

export type {
  AsyncValidator,
  BindFieldOptions,
  BindFormOptions,
  CrossFieldValidator,
  FieldArrayConfig,
  FieldConfig,
  Form,
  FormChangeListener,
  FormConfig,
  FormErrors,
  FormField,
  FormFieldArray,
  FormFieldValidationMode,
  FormFields,
  FormSnapshot,
  FormValidationMode,
  FormValidationStrategy,
  SetFieldValueOptions,
  SubmitHandler,
  SyncValidator,
  UseFormFieldOptions,
  UseFormFieldReturn,
  UseFormFieldSetValueOptions,
  ValidationResult,
  Validator,
} from './types';

export type { FieldSchema, SchemaEntry } from './schema';
