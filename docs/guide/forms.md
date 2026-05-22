# Forms

The forms module provides reactive form state, sync/async validation, cross-field rules, and submit orchestration.

```ts
import { createForm, required, email, minLength } from '@bquery/bquery/forms';
```

## Concepts

A bQuery form is a **graph of signals**. Each field owns its own `value`, `error`, `isTouched`, `isDirty`, `isFocused`, and `isValidating` signal; the parent form derives aggregate signals (`isValid`, `isDirty`, `isSubmitting`, `submitCount`, …) from those. Because everything is signal-based:

- Form fields can be read or rendered anywhere — from raw DOM via `bq-model`, from inside a `component()`, or from a plain `effect()`.
- Validation is automatic and reactive: triggering modes (`'change' | 'blur' | 'both' | 'manual'`) decide *when* validators run, but the resulting `error` signal updates downstream subscribers immediately.
- Async validators return promises and update `isValidating` while in flight; later invocations supersede earlier ones and stale results are ignored, so the final state stays consistent with the most recent input.

There are three entry points, in increasing scope:

1. **`useFormField(initial, options)`** — a single reactive field. Use it for one-off inputs, search boxes, or when you want to compose fields manually.
2. **`createForm({ fields, crossValidators, onSubmit })`** — a full form. Manages submit lifecycle, cross-field rules, and bulk operations (`reset`, `setValues`, `setErrors`).
3. **`useForm` / `useField` / `useFieldArray`** — the same primitives bound to the current `component()` scope, so disposal happens automatically on `disconnected`.

> Validators are plain functions (`(value) => string | true | undefined` or async equivalent). The built-ins (`required()`, `email()`, `minLength(n)`, …) are factories that return such functions, which is why they are always called with `()` even when they take no arguments.

## Standalone fields with `useFormField()`

Use `useFormField()` when you want the same reactive field primitives as `createForm()`,
but without creating a whole form object.

```ts
import { useFormField, required } from '@bquery/bquery/forms';

const emailField = useFormField('', {
  validators: [required()],
  validateOn: 'blur',
});

emailField.value.value = 'ada@example.com';
emailField.touch(); // runs blur-triggered validation
console.log(emailField.isValid.value);
```

`useFormField()` supports:

- `validateOn: 'manual' | 'change' | 'blur' | 'both'`
- `debounceMs` for automatic validation
- external writable signals when you want to reuse existing reactive state
- `validate()` for immediate validation
- `destroy()` to cancel pending validation timers and automatic subscriptions for dynamic fields

## Basic usage

```ts
const form = createForm({
  fields: {
    name: { initialValue: '', validators: [required(), minLength(2)] },
    email: { initialValue: '', validators: [required(), email()] },
  },
  onSubmit: async (values) => {
    await fetch('/api/register', {
      method: 'POST',
      body: JSON.stringify(values),
    });
  },
});
```

## Field state

`createForm()` fields expose reactive primitives for value, error, and dirty/touched state.

```ts
console.log(form.fields.email.value.value);
console.log(form.fields.email.error.value);
console.log(form.fields.email.isTouched.value);
console.log(form.fields.email.isDirty.value);
```

Available helpers:

- `touch()`
- `reset()`
- `value`
- `error`
- `isTouched`
- `isDirty`
- `isPristine`

## Rendering errors with the view module

When you use `@bquery/bquery/view`, the `bq-error` directive can render field errors directly from a form field object or its `error` signal:

```html
<input bq-model="form.fields.email.value" />
<p bq-error="form.fields.email"></p>
```

```ts
import { createForm, email, required } from '@bquery/bquery/forms';
import { mount } from '@bquery/bquery/view';

const form = createForm({
  fields: {
    email: { initialValue: '', validators: [required(), email()] },
  },
});

mount('#app', { form });
```

The message element is hidden automatically while the field has no error.

Helpers available only on values returned by `useFormField()` (not on `createForm().fields.*`):

- `isValid`
- `isValidating`
- `validate()`
- `destroy()`

## Form state

```ts
console.log(form.isValid.value);
console.log(form.isDirty.value);
console.log(form.isSubmitting.value);
```

Form methods:

- `validateField(name)`
- `validate()`
- `handleSubmit()`
- `reset()`
- `getValues()`
- `setValues(values)` – bulk-set field values from a partial object
- `setErrors(errors)` – bulk-set field error messages (e.g. from server responses)

## Bulk-setting values and errors

Use `setValues()` to programmatically update multiple fields at once,
and `setErrors()` to apply server-side validation errors:

```ts
// Pre-fill from an API response
const userData = await fetch('/api/user/1').then((r) => r.json());
form.setValues({ name: userData.name, email: userData.email });

// Apply server-side validation errors
const result = await submitToServer(form.getValues());
if (result.errors) {
  form.setErrors(result.errors); // { name: 'Already taken', email: 'Invalid' }
}
```

## Cross-field validation

```ts
const passwordForm = createForm({
  fields: {
    password: { initialValue: '', validators: [required()] },
    confirmPassword: { initialValue: '', validators: [required()] },
  },
  crossValidators: [
    (values) =>
      values.password === values.confirmPassword
        ? undefined
        : { confirmPassword: 'Passwords must match' },
  ],
});
```

## Async validation

```ts
import { customAsync } from '@bquery/bquery/forms';

const usernameForm = createForm({
  fields: {
    username: {
      initialValue: '',
      validators: [
        required(),
        customAsync(async (value) => {
          const taken = await fetch(`/api/users/exists?name=${encodeURIComponent(String(value))}`)
            .then((response) => response.json())
            .then((data) => Boolean(data.taken));

          return taken ? 'Username is already taken' : true;
        }),
      ],
    },
  },
});
```

## Built-in validators

- `required()`
- `minLength(length)` / `maxLength(length)`
- `min(value)` / `max(value)`
- `pattern(regex)`
- `email()`
- `url()`
- `matchField(ref)` – compare field value to a reference signal (e.g. password confirmation)
- `custom(fn)`
- `customAsync(fn)`

## matchField validator

The `matchField()` validator compares a field's value against a reference signal.
This is the recommended approach for "confirm password" and similar patterns:

```ts
import { matchField } from '@bquery/bquery/forms';
import { signal } from '@bquery/bquery/reactive';

const password = signal('');
const confirmPassword = signal('');
const validateConfirmPassword = matchField(password, 'Passwords must match');

validateConfirmPassword(confirmPassword.value); // true when the values match
```

::: tip
`matchField()` accepts any object with a `.value` property, so it works with both signals and plain `{ value: T }` objects.
:::

## Complete form example with view bindings

Here is a full registration form combining `createForm()`, validators, and the view module for rendering:

```html
<form id="register-form" bq-on:submit="$event.preventDefault(); form.handleSubmit()">
  <div class="field">
    <label for="name">Name</label>
    <input id="name" bq-model="form.fields.name.value" placeholder="Your name" />
    <p bq-error="form.fields.name" class="error-text"></p>
  </div>

  <div class="field">
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      bq-model="form.fields.email.value"
      placeholder="you@example.com"
    />
    <p bq-error="form.fields.email" class="error-text"></p>
  </div>

  <div class="field">
    <label for="password">Password</label>
    <input id="password" type="password" bq-model="form.fields.password.value" />
    <p bq-error="form.fields.password" class="error-text"></p>
  </div>

  <div class="field">
    <label for="confirm">Confirm Password</label>
    <input id="confirm" type="password" bq-model="form.fields.confirmPassword.value" />
    <p bq-error="form.fields.confirmPassword" class="error-text"></p>
  </div>

  <button type="submit" bq-bind:disabled="form.isSubmitting.value || !form.isValid.value">
    Register
  </button>

  <p bq-show="form.isSubmitting.value">Submitting...</p>
</form>
```

```ts
import { createForm, required, email, minLength } from '@bquery/bquery/forms';
import { mount } from '@bquery/bquery/view';

const form = createForm({
  fields: {
    name: { initialValue: '', validators: [required(), minLength(2)] },
    email: { initialValue: '', validators: [required(), email()] },
    password: { initialValue: '', validators: [required(), minLength(8)] },
    confirmPassword: { initialValue: '', validators: [required()] },
  },
  crossValidators: [
    (values) =>
      values.password === values.confirmPassword
        ? undefined
        : { confirmPassword: 'Passwords must match' },
  ],
  onSubmit: async (values) => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json();
      form.setErrors(data.errors); // apply server-side errors
    }
  },
});

mount('#register-form', { form });
```

## Tips for beginners

- **Start with `useFormField()`** if you only need a single input validated — it's simpler than `createForm()`
- **Use `bq-error`** to show errors without manual DOM manipulation
- **Validators stack** — you can combine multiple validators on a single field: `[required(), minLength(3), email()]`
- **`form.isValid`** is reactive — use it in effects or bind it to disable buttons
- **`form.reset()`** clears all fields and errors back to initial state
- **Server-side errors** can be applied with `form.setErrors()` after a failed API call

Use forms when you want signal-based state without wiring every input manually.

## What's new in 1.13.0 — Batteries-included tier

The `@bquery/bquery/forms` surface significantly expanded in `1.13.0`. The
additions are 100% backwards-compatible — existing forms keep working
unchanged — but you can now reach for many more first-party primitives:

### Validators & combinators

```ts
import {
  integer, numeric, between, length, oneOf, notOneOf, arrayOf,
  required, email,
  requiredIf, requiredUnless, dateAfter, dateBefore, validDate,
  fileSize, fileType,
  compose, all, not, withMessage,
} from '@bquery/bquery/forms';

const t = (message: string) => message;
const tagsRule  = arrayOf(required('Tag required'));
const ageRule   = compose(required(), integer(), between(18, 120));
const usernameRule = not(oneOf(['admin', 'root']), 'Reserved username');
const localized = withMessage(email(), t('Please enter a valid email'));
```

### Field- and form-level state

Every field now exposes `isValidating`, `isFocused`, `dirtySince`, `disabled`,
`focus()` / `blur()`, `setValue(value, { touch, validate, silent })`,
`setError(message)`, and `clearError()`. Every form exposes `submitCount`,
`lastSubmittedAt`, `submitError`, `isValidating`, `isPristine`, plus
`touchAll()`, `untouchAll()`, `resetField(name)`, `resetErrors()`,
`getDirtyValues()`, and `subscribe(listener)`. `FormConfig` accepts
`onSubmitError`, `onSubmitSuccess`, `validationStrategy`, and
`mode: 'all' | 'first'`.

### Dynamic field arrays

```ts
import { createFieldArray, useFormField, required } from '@bquery/bquery/forms';

const lineItems = createFieldArray({
  initial: [],
  factory: (initial = '') => useFormField(initial, { validators: [required()] }),
});

lineItems.add('Product A');
lineItems.add('Product B');
lineItems.move(0, 1);
```

### Fluent schema builder

```ts
import { createForm, schema, field } from '@bquery/bquery/forms';

const form = createForm({
  ...schema(
    {
      name: field<string>().required().minLength(2),
      email: field<string>().required().email(),
    },
    { name: '', email: '' }
  ),
  onSubmit: save,
});
```

### DOM bindings

```ts
import { bindForm, bindField } from '@bquery/bquery/forms';

const cleanup = bindForm(form, document.querySelector('form')!);
// or per-field:
bindField(form.fields.email, document.querySelector('#email')!);
```

`bindForm` auto-discovers `[name]` inputs, wires `submit`, marks
`aria-invalid`, and renders error text via a configurable `errorSlot` mapper.

### Component-scoped composables

```ts
import { component } from '@bquery/bquery/component';
import { useForm, useField, useFieldArray } from '@bquery/bquery/forms';

component('login-form', {
  connected() {
    const form = useForm({ fields: { … }, onSubmit });
    // auto-disposed on disconnect
  },
});
```

### SSR

```ts
import { serializeFormState, hydrateForm, readSerializedFormState } from '@bquery/bquery/forms';

// Server:
const tag = serializeFormState('login', form.snapshot()); // returns a <script> tag
// Client:
const snapshot = readSerializedFormState('login');
if (snapshot) form.restore(snapshot);
// or simply:
hydrateForm(form, 'login');
```
