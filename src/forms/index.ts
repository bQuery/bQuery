/**
 * Form handling module for bQuery.js.
 *
 * Provides a reactive, TypeScript-first form API with field-level and
 * cross-field validation, dirty/touched/focus tracking, dynamic field
 * arrays, schema-style declaration, DOM bindings, progressive-enhancement
 * form actions with optimistic updates, and SSR hydration — all backed by
 * bQuery's signal-based reactivity system.
 *
 * Stability: **targeting Stable in 1.15.0**. The 1.13 surface (validators +
 * combinators, schema builder, field arrays, `bindForm`/`bindField`, scope
 * composables, SSR helpers) is frozen for one minor cycle; the `'manual'`
 * `validationStrategy` default and the SSR serialization boundary
 * (functions / `File` are dropped) are documented as guaranteed contracts, and
 * `createFieldArray()`'s stable-key requirement is validated with clear errors.
 * See the {@link https://bquery.js.org/guide/forms | Forms guide} for the
 * exit-criteria checklist and the frozen surface reference.
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
export { optimistic } from './optimistic';
export { FormActionError, formAction, useFormStatus } from './action';

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
  FieldArrayKeyFn,
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
export type {
  OptimisticController,
  OptimisticHandle,
  OptimisticReducer,
} from './optimistic';
export type {
  EnhanceOptions,
  FormAction,
  FormActionContext,
  FormActionOptions,
  FormActionTarget,
  FormStatus,
} from './action';
